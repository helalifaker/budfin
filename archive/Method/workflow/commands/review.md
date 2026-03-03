# Command: /review <feature>

## Purpose

Run code review and QA testing in parallel. Both must pass for the feature
to advance to the documentation phase.

## Trigger

User says: "review <feature>", "check <feature>", "/review <feature>"
Also invoked automatically by the Orchestrator after Phase 4.

## Protocol

### Step 1: Spawn Both Agents in Parallel

Use the Task tool to launch both agents simultaneously:

**Agent 1: Code Reviewer**
```
You are the Code Reviewer Agent. Review the implementation for feature "<feature>".

Read:
- agents/reviewer.md for your full protocol
- specs/<feature>.md for the feature requirements
- PROJECT.md for project conventions

Review all changed/new files in the feature branch.
Write findings to reviews/<feature>-cr.md.
```

**Agent 2: QA Agent**
```
You are the QA Agent. Test the implementation for feature "<feature>".

Read:
- agents/qa.md for your full protocol
- specs/<feature>-design.md for UI states and edge cases
- PROJECT.md for test commands

Run the full test suite and perform edge case testing.
Write results to reviews/<feature>-qa.md.
```

### Step 2: Wait for Both to Complete

The Orchestrator waits for both Task results.

### Step 3: Evaluate Gate

Read both reports and determine outcome:

```
IF reviews/<feature>-cr.md has ZERO blockers
   AND reviews/<feature>-qa.md has ZERO failures:
   → ADVANCE to Phase 6 (Docs)

ELIF reviews/<feature>-cr.md has blockers:
   → RETURN to Phase 4 (Implementer fixes blockers)
   → List specific blockers for the Implementer

ELIF reviews/<feature>-qa.md has failures:
   → RETURN to Phase 4 (Implementer fixes failures)
   → List specific failures with reproduction steps
```

### Step 4: Report

Update `status/<feature>.md`:

```markdown
### Phase: REVIEW
- Status: COMPLETE (or FAILED — returned to IMPLEMENT)
- Code Review: APPROVED / CHANGES REQUESTED (<count> blockers)
- QA: ALL PASS / FAILURES FOUND (<count> failures)
```

## Gate

- Code Review: zero blockers
- QA: zero failures
- Both review files exist and are complete
