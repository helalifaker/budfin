# Command: /tdd-green <feature>

## Purpose

Implement the minimum code to make all failing tests pass. This is the "Green"
phase of TDD — write just enough to satisfy the tests, then refactor.

## Trigger

User says: "implement <feature>", "make tests pass", "/tdd-green <feature>"
Also invoked automatically by the Orchestrator after Phase 3.

## Protocol

### Step 1: Read Context

```
Read: specs/<feature>.md            → what to build
Read: specs/<feature>-design.md     → how it should look/behave
Read: PROJECT.md                    → stack, conventions, commands
Read: status/<feature>.md           → current state, test inventory
```

### Step 2: Prioritize Tests

Sort failing tests by dependency (implement foundations first):

1. Data models / types / schemas
2. Utility functions and helpers
3. Business logic
4. API endpoints / routes
5. UI components
6. E2E flows

### Step 3: Red-Green-Refactor Loop

For each test (one at a time):

```
1. Run test suite → note the first failing test
2. Write MINIMUM code to pass that test
3. Run test suite → confirm target test passes
4. Check: did any other test break? → fix before continuing
5. Look for refactoring opportunities:
   - Extract duplicate logic
   - Improve naming
   - Simplify conditionals
   - Run tests again → must stay green
6. Move to next failing test
```

### Step 4: Quality Checks

After all tests pass:

```bash
run-tests          # All green
run-lint           # Zero warnings
run-typecheck      # Zero errors
run-coverage       # >= 90%
```

If coverage < 90%, identify uncovered lines and add tests OR add
justification for why they are untestable.

If lint or type errors, fix them without breaking tests.

### Step 5: Report

Update `status/<feature>.md`:

```markdown
### Phase: IMPLEMENT (TDD Green)
- Status: COMPLETE
- Tests: <passing>/<total> passing
- Coverage: <percentage>%
- Lint: clean
- Types: clean
```

## Gate

- All tests pass (zero failures)
- Lint: zero warnings
- Type check: zero errors
- Coverage: >= 90%
