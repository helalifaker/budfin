# Command: /update-docs <feature>

## Purpose

Update all project documentation after a feature passes review.
Ensures docs stay in sync with the codebase.

## Trigger

User says: "update docs", "document <feature>", "/update-docs <feature>"
Also invoked automatically by the Orchestrator after Phase 5.

## Protocol

### Step 1: Read Context

```
Read: specs/<feature>.md             → what was built
Read: specs/<feature>-design.md      → component inventory
Read: reviews/<feature>-cr.md        → any doc-related nits
Read: PROJECT.md                     → documentation conventions
Read: CHANGELOG.md                   → current unreleased section
```

### Step 2: Identify What Needs Updating

Scan the implementation for:

- New API endpoints → update `docs/api/`
- New components → update `docs/components/`
- Architecture decisions from spec → add to `docs/adr/`
- New env variables → update `README.md`
- Breaking changes → add to `docs/migrations/`
- Any user-facing change → add to `CHANGELOG.md`

### Step 3: Update Each Doc

Follow the Documentation Agent protocol in `agents/documentor.md`.

### Step 4: Lint Docs

```bash
npx markdownlint docs/ CHANGELOG.md README.md
```

Fix any issues.

### Step 5: Report

Update `status/<feature>.md`:

```markdown
### Phase: DOCS
- Status: COMPLETE
- Files updated: <list of files>
- Markdown lint: clean
```

## Gate

- All identified docs updated
- Markdown lint passes
- CHANGELOG.md has entry under [Unreleased]
- No broken internal links
