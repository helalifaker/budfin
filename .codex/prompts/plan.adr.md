---
name: plan:adr
description: >
    Record an architectural decision for BudFin. Prompts for context, decision, consequences,
    and alternatives. Saves to docs/adr/ADR-NNN-<slug>.md and links in
    docs/tdd/09_decisions_log.md. Commits the ADR. Available in any phase.
    Usage - /plan:adr "[decision title]"
argument-hint: '"[decision title]"'
allowed-tools: Read, Write, Edit, Bash
---

Parse the argument:

- `decision-title`: the decision title in quotes (e.g., "Use @react-pdf/renderer instead of Puppeteer")

If the argument is missing, ask the user: "What is the title of the architectural decision you want to record?"

## Step 1: Find Next ADR Number

```bash
ls docs/adr/ 2>/dev/null | grep -E "^ADR-[0-9]+" | sort | tail -1
```

Increment the highest number by 1. If no ADRs exist, start at ADR-001.

Format: zero-padded 3 digits (e.g., ADR-018).

Derive the slug: lowercase kebab-case of decision-title.
Example: "Use @react-pdf/renderer instead of Puppeteer" → `use-react-pdf-renderer-instead-of-puppeteer`

## Step 2: Gather ADR Content

Ask the user for each section in order. Wait for response before proceeding to the next.

**Section 1: Context**
"Describe the situation that led to this decision — what problem were you solving? (2-5 sentences)"

**Section 2: Decision**
"State the decision clearly. Start with 'We will...' (1-3 sentences)"

**Section 3: Consequences — Positive**
"List the positive outcomes of this decision (bullet points)"

**Section 4: Consequences — Negative**
"List the negative outcomes or trade-offs (bullet points)"

**Section 5: Consequences — Neutral**
"List any neutral observations (bullet points, or press Enter to skip)"

**Section 6: Alternatives Considered**
"List the alternatives you considered and why you rejected them (table format or bullet points)"

After each section, display the content and ask: "Is this correct? (yes to continue / no to redo)"

## Step 3: Create the ADR File

```bash
mkdir -p docs/adr
```

Use the template at `.claude/workflow/templates/adr.md`. Create the file at:
`docs/adr/ADR-[NNN]-[slug].md`

Pre-fill all fields:

- ADR number and title from arguments
- Date: today's date (YYYY-MM-DD)
- Status: Accepted
- All sections from user input

## Step 4: Link in Decisions Log

Read `docs/tdd/09_decisions_log.md`. Find the ADR table and add a new row:

```markdown
| ADR-[NNN] | [Decision title] | Accepted | YYYY-MM-DD |
```

If the decisions log does not have a table, create a new entry in the existing format.

## Step 5: Commit the ADR

```bash
git add docs/adr/ADR-[NNN]-[slug].md docs/tdd/09_decisions_log.md
git commit -m "docs(adr): add ADR-[NNN] — [decision title]"
```

## Step 6: Confirm

Display:

```
ADR recorded: docs/adr/ADR-[NNN]-[slug].md
Linked in: docs/tdd/09_decisions_log.md
Committed: docs(adr): add ADR-[NNN] — [decision title]
```

## Error Handling

If the ADR template is missing at `.claude/workflow/templates/adr.md`:
Create a minimal ADR with the standard sections (Context, Decision, Consequences, Alternatives).
Do not fail silently — warn the user that the template was missing.
