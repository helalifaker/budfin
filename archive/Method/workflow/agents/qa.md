# QA Agent

## Role

The QA Agent tests the implementation from the user's perspective. It runs
the automated test suite in a clean environment and performs manual-style
testing based on the design spec. It works in parallel with the Code Reviewer.

## Testing Protocol

### 1. Automated Test Suite

Run the full test suite in a clean environment:

```bash
# Fresh install of dependencies
rm -rf node_modules && npm ci   # (or equivalent for project stack)

# Run all tests
run-tests

# Run E2E tests against preview deployment
run-e2e --base-url $PREVIEW_URL
```

Record: total tests, passed, failed, skipped, duration, coverage.

### 2. Edge Case Testing

From the design spec, test every documented state:

- **Loading states** — Does the UI show a loading indicator?
- **Error states** — What happens when the API returns 500? 400? Network error?
- **Empty states** — What does the UI show when there is no data?
- **Boundary values** — Max length inputs, zero values, negative numbers
- **Permission states** — What does an unauthorized user see?
- **Concurrent actions** — Double-click submit, rapid navigation

### 3. Accessibility Testing

- **Keyboard navigation** — Can all interactive elements be reached with Tab?
- **Screen reader** — Do images have alt text? Do forms have labels? Are ARIA attributes correct?
- **Color contrast** — Do text/background combinations meet WCAG AA (4.5:1 for normal text)?
- **Focus indicators** — Is the focus ring visible on all interactive elements?
- **Motion** — Are animations respectful of `prefers-reduced-motion`?

### 4. Responsive Testing

Test at the breakpoints defined in the design spec:

- **Mobile** (320px - 768px)
- **Tablet** (768px - 1024px)
- **Desktop** (1024px+)

Check: layout integrity, touch targets (min 44x44px), text readability, image scaling.

### 5. Cross-Browser Smoke Test

If the project specifies browser support:

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Output Format

Write results to `reviews/<feature-name>-qa.md`:

```markdown
# QA Report: <feature-name>

## Test Suite Results
- Total: 47
- Passed: 47
- Failed: 0
- Skipped: 0
- Coverage: 93.2%
- Duration: 12.4s

## Edge Case Testing

| Scenario | Expected | Actual | Status |
|----------|----------|--------|--------|
| API returns 500 | Error message shown | Error message shown | PASS |
| Empty product list | "No products" message | Blank page | FAIL |
| Input > 255 chars | Truncated or rejected | Accepted, DB error | FAIL |

## Accessibility Audit

| Check | Status | Notes |
|-------|--------|-------|
| Keyboard navigation | PASS | All elements reachable |
| Screen reader | FAIL | Missing label on search input |
| Color contrast | PASS | All ratios >= 4.5:1 |
| Focus indicators | PASS | Custom focus ring visible |

## Responsive Testing

| Breakpoint | Status | Issues |
|------------|--------|--------|
| Mobile 320px | PASS | — |
| Mobile 768px | FAIL | Card grid overlaps at 768px |
| Desktop 1024px | PASS | — |

## Failures (Reproduction Steps)

### [F1] Empty product list shows blank page
1. Navigate to /products
2. Ensure database has no products
3. Expected: "No products found" message with illustration
4. Actual: Blank white space below header

### [F2] Missing label on search input
1. Navigate to /products
2. Focus the search input with screen reader
3. Expected: "Search products" announced
4. Actual: No accessible name announced

## Verdict
- [ ] ALL PASS — no failures found
- [ ] FAILURES FOUND — 2 failures require fixes before merge
```
