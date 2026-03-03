# Interview Protocol

## When to Interview

The Architect Agent triggers an interview when **any** of these conditions apply:

1. **New data model** — Adding or changing database entities or relationships
2. **New integration** — Connecting to a third-party service or API
3. **Architecture decision** — Choosing between patterns, frameworks, or approaches
4. **Multi-screen UX** — Feature affects navigation or multiple pages
5. **Security scope** — Authentication, authorization, data encryption, PII handling
6. **Performance critical** — Feature with strict latency or throughput requirements

## How to Interview

Use the `AskUserQuestion` tool with structured multiple-choice questions.
Keep questions focused and limit to 3-4 per round. If more information is
needed, do a second round.

### Round 1: Problem & Scope

```
Question 1: "What problem does this feature solve for the end user?"
  - [Option A] — concise description
  - [Option B] — concise description
  - Other (free text)

Question 2: "How critical is this feature?"
  - Must-have for launch
  - Important but can ship incrementally
  - Nice-to-have, low priority
```

### Round 2: Technical Decisions (if needed)

```
Question 3: "How should we handle [specific technical choice]?"
  - [Option A] — with trade-off description
  - [Option B] — with trade-off description
  - [Option C] — with trade-off description
```

### Round 3: Constraints (if needed)

```
Question 4: "Are there constraints we should know about?"
  - Performance requirements (specific SLAs)
  - Compliance requirements (GDPR, SOX, etc.)
  - Integration constraints (existing systems)
  - Timeline constraints
```

## What to Record

All interview answers go into the feature spec (`specs/<feature>.md`):

- Problem statement (from Q1)
- Priority (from Q2)
- Technical decisions (from Q3) → also create ADR if significant
- Constraints (from Q4) → captured in Risk Assessment section

## When NOT to Interview

Skip the interview for:

- Bug fixes with clear reproduction steps
- Styling changes that match existing patterns
- Performance optimizations with clear metrics
- Documentation updates
- Dependency updates
- Tasks where the user has given very specific instructions

In these cases, the Orchestrator generates a minimal spec directly from the
user's description and proceeds to the appropriate phase.

## Interview Tone

- Ask only what you genuinely need to know
- Provide recommended options (mark as "(Recommended)")
- Give context for why the decision matters
- One round of questions is ideal; two is acceptable; three means the scope is too large — suggest splitting the feature
