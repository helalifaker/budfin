# Command: /tdd-red <feature>

## Purpose

Write all failing tests for a feature before any implementation code exists.
This is the "Red" phase of TDD — confirm the tests are real by verifying they fail.

## Trigger

User says: "write tests for <feature>", "tdd red", "/tdd-red <feature>"
Also invoked automatically by the Orchestrator after Phase 2 (Design).

## Protocol

### Step 1: Read Specifications

```
Read: specs/<feature>.md          → acceptance criteria
Read: specs/<feature>-design.md   → UI states, interactions, components
Read: PROJECT.md                  → testing conventions, commands
```

### Step 2: Plan Tests

Create a test plan document (not committed, just for agent reasoning):

```markdown
## Test Plan: <feature>

### Unit Tests
- [ ] <function>: returns correct value for valid input
- [ ] <function>: throws error for invalid input
- [ ] <function>: handles edge case X

### Integration Tests
- [ ] POST /api/<resource>: creates resource with valid data (201)
- [ ] POST /api/<resource>: rejects invalid data (400)
- [ ] POST /api/<resource>: requires authentication (401)
- [ ] GET /api/<resource>: returns paginated list
- [ ] GET /api/<resource>/:id: returns 404 for missing resource

### E2E Tests
- [ ] User can complete the happy path flow
- [ ] User sees error message on failure
- [ ] User sees empty state when no data exists
- [ ] Keyboard navigation works for all interactive elements
```

### Step 3: Write Tests

Write each test following the project's conventions. Structure:

```
// Arrange — set up preconditions
// Act — perform the action
// Assert — verify the outcome
```

Every test MUST be specific and falsifiable. Bad tests:

```javascript
// BAD: tests nothing meaningful
it('should work', () => {
  expect(true).toBe(true);
});

// BAD: tests implementation, not behavior
it('should call the database', () => {
  expect(db.query).toHaveBeenCalled();
});
```

Good tests:

```javascript
// GOOD: tests specific behavior
it('should return 400 when product name exceeds 255 characters', async () => {
  const response = await api.post('/products', {
    name: 'a'.repeat(256),
    price: 999,
  });
  expect(response.status).toBe(400);
  expect(response.body.error).toBe('VALIDATION_ERROR');
});
```

### Step 4: Verify Red State

Run the test suite and confirm ALL new tests fail:

```bash
run-tests
```

Expected output: All new tests FAIL. If any test passes, investigate:

- Is it testing something that already exists? → Remove or modify
- Is the assertion vacuously true? → Fix the assertion
- Is a mock returning a default that satisfies the test? → Fix the mock

### Step 5: Report

Update `status/<feature>.md`:

```markdown
### Phase: CONTRACT (TDD Red)
- Status: COMPLETE
- Tests written: <count>
- Unit: <count>
- Integration: <count>
- E2E: <count>
- All tests confirmed FAILING
```

## Gate

- All test files exist in the correct location
- All tests run without syntax errors
- All tests FAIL (zero passing among new tests)
- Test count >= acceptance criteria count from spec
