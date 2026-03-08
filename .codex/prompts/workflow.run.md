---
name: workflow:run
description: >
    Full Epic driver. Drives the complete lifecycle for a single BudFin Epic: health check ->
    spec -> stories -> implement all stories -> review -> visual audit -> merge -> rollup.
    Self-healing with auto-fix, stuck detection, and PR conversation resolution.
    Usage - /workflow:run [epic-issue-number]
argument-hint: '[epic-issue-number]'
---

Parse the argument:

- `epic-issue-number`: GitHub issue number of the Epic to implement (e.g., 5)

If missing, ask the user: "Which Epic issue number should I run? (Check /workflow:status for available Epics)"

---

## CHECKPOINT 1: ORIENTATION

1. Read `.claude/workflow/STATUS.md` to determine current phase.
2. Display inline status:
    ```
    >>> Phase [N] -- [PHASE_NAME] | Epic #[N] -- [EPIC_NAME]
    ```
3. Validate phase >= 4:
    - If earlier: error and stop:
        ```
        Error: /workflow:run requires Phase 4 (SPECIFY) or later.
        Current phase is [N] -- [NAME].
        Complete earlier phase work first, then run /workflow:advance.
        ```

---

## CHECKPOINT 2: HEALTH CHECK (auto-fix mode)

Run health check before any feature work:

```bash
pnpm lint 2>&1
pnpm typecheck 2>&1
```

- If clean: display `Health: clean`
- If auto-fixable issues found: run `/fix:all` internally, commit `fix(health): resolve pre-epic health issues`
- If unfixable blockers remain after auto-fix: report and STOP
- Display: `Health: [clean | N issues auto-fixed]`

---

## PHASE 4 (SPECIFY)

**4a. Check if spec exists**:

```bash
ls docs/specs/epic-$EPIC_NUMBER/ 2>/dev/null
```

If no spec: run the full `plan:spec` workflow for this Epic interactively.

**4b. Check if stories exist**:

```bash
gh issue list --label "story" --json number,title,body --state open 2>/dev/null | \
  grep "Parent Epic.*#$EPIC_NUMBER"
```

If no stories: run the full `plan:stories` workflow to create all story issues.

**4c. Gate**: spec approved + stories created.

**4d. Advance to Phase 5**:
Run `workflow:advance` logic -- gate-check Phase 4, advance STATUS.md to Phase 5.

Display: `>>> Phase 5 -- TDD RED | [N] stories queued`

**4e. Fall through to Phase 5 logic below.**

---

## PHASE 5-6 (IMPLEMENT)

Run the full `impl:epic` workflow:

1. Load all open stories for this Epic in dependency order
2. For each story:
    - Display: `>>> Story [X/N]: #[number] -- [title]`
    - Run `impl:story` swarm (RED -> GREEN -> draft PR)
    - **HEALTH CHECK after each story**: `pnpm lint && pnpm typecheck`
        - If auto-fixable: run `/fix:all`, commit `fix(health): post-story cleanup`
        - If blocker: retry ONCE with `/fix:all`, then STOP if still blocked
3. Gate: all stories have draft PRs with passing tests
4. Advance to Phase 7

Display: `>>> Phase 7 -- REVIEW | [N] PRs to merge`

---

## PHASE 7 (REVIEW + MERGE)

Use `pr:drive` loop logic for each PR in dependency order. For each PR:

### Step 7a: CI CHECK

```bash
gh pr checks $PR_NUMBER --watch
```

- If failing: auto-fix (format -> lint -> types -> tests -> build)
- Commit `fix(ci): resolve failures for PR #$PR_NUMBER`
- Re-check CI (loop, max 3 cycles)
- **Stuck detection**: 2 identical CI fingerprints -> STOP with diagnostics

### Step 7b: REVIEW AGENTS (if CI green)

Spawn 3 agents in parallel, loading each repo-local brief first:

1. **workflow-reviewer** -- `.codex/agents/workflow-reviewer.md` -- code quality, security, financial precision
2. **workflow-qa** -- `.codex/agents/workflow-qa.md` -- AC coverage, edge cases, coverage >= 80%
3. **workflow-documentor** -- `.codex/agents/workflow-documentor.md` -- CHANGELOG, docs, traceability

Provide each agent with PR diff, story number, Epic number, changed files.

- If blockers: auto-fix, re-run agents (max 2 cycles)
- **Stuck detection**: 2 identical review fingerprints -> STOP

### Step 7c: PR CONVERSATION RESOLUTION

```bash
gh api repos/{owner}/{repo}/pulls/$PR_NUMBER/reviews --jq '[.[] | select(.state == "CHANGES_REQUESTED")] | length'
gh api repos/{owner}/{repo}/pulls/$PR_NUMBER/comments --jq '[.[] | select(.in_reply_to_id == null)] | length'
```

- Check: all review threads resolved
- If unresolved: list threads, attempt to address each finding, re-check
- Gate: 0 unresolved conversations, no CHANGES_REQUESTED reviews pending

### Step 7d: VISUAL UI/UX AUDIT (frontend stories only)

Detect frontend changes in PR diff:

```bash
gh pr diff $PR_NUMBER --name-only | grep '\.tsx$'
```

If frontend changes found:

1. Start dev server: `pnpm dev` (wait for localhost:3000)
2. Navigate to affected routes via Chrome automation (`Playwright browser navigation`)
3. Take screenshots of key components (`Playwright screenshots and interaction`)
4. Read accessibility tree (`Playwright accessibility snapshot`)
5. Test keyboard navigation (Tab, Enter, Escape via `Playwright screenshots and interaction`)
6. Compare against UI/UX spec (`docs/ui-ux-spec/NN-module.md`):
    - Correct shell (PlanningShell vs ManagementShell)
    - CSS tokens used (not hardcoded colors)
    - Component structure matches spec
    - ARIA roles present
    - Keyboard navigation works
7. Report: PASS or list visual findings
8. Stop dev server

Visual audit findings are **warnings, not blockers**. Log in post-epic report but do not block merge.

If no frontend changes: skip this step.

### Step 7e: MERGE

```bash
gh pr ready $PR_NUMBER
```

Final pre-flight:

```bash
pnpm test && pnpm typecheck && pnpm lint
```

Squash merge:

```bash
gh pr merge $PR_NUMBER --squash --delete-branch
```

Verify story issue closed:

```bash
gh issue view $STORY_NUMBER --json state --jq '.state'
```

If not closed: `gh issue close $STORY_NUMBER --comment "Closed by merge of PR #$PR_NUMBER."`

### Step 7f: INTER-PR HEALTH CHECK

After each PR merge, check for regressions:

```bash
git pull origin main && pnpm test
```

If failing: auto-fix with `/fix:all`, commit, continue.

---

## CHECKPOINT 3: EPIC ROLLUP

1. Verify ALL stories for Epic are closed:
    ```bash
    gh issue list --label "story" --search "Part of Epic #$EPIC_NUMBER" --json number,state --state all
    ```
2. Comment on Epic issue: `gh issue comment $EPIC_NUMBER --body "All N stories merged -- Epic #$EPIC_NUMBER complete."`
3. Close Epic issue: `gh issue close $EPIC_NUMBER`
4. Add done label: `gh issue edit $EPIC_NUMBER --add-label "done"`
5. Update STATUS.md: mark Epic complete in Feature Progress table
6. Auto-select next Epic (dependency order + MoSCoW priority)

---

## CHECKPOINT 4: POST-EPIC REPORT

Display summary:

```
=== Epic #$EPIC_NUMBER Complete ===

Stories merged:       N
PRs merged:           N
Health issues fixed:  N
Visual audit findings: N (warnings only)
Coverage:             N%

Next Epic: #[N] -- [Name]
Command:   /workflow:run [next-epic-#]
```

---

## Zero-Prompt Mode

When invoked as /workflow:run, all sub-workflows run without confirmation prompts.
The user has expressed intent by running the full driver.

Suppressed prompts:

- impl:epic "Ready to implement N stories?" -> auto-yes
- workflow:advance "Which Epic next?" -> auto-advance, show next epic

---

## Error Handling

If `gh` is not authenticated:

- Display the error
- Guide the user to run `gh auth login`
- Stop

If no Epic found with issue number `$EPIC_NUMBER`:

```
No Epic found with issue number #$EPIC_NUMBER.
Run /workflow:status to see all Epics and their issue numbers.
```
