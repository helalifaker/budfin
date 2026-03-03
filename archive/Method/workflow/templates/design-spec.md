# Design Spec: [FEATURE_NAME]

## Status: DRAFT | APPROVED
## Author: Designer Agent
## Date: [YYYY-MM-DD]
## Related Spec: specs/[feature-name].md

---

## Component Inventory

### New Components

| Component | Type | Description |
|-----------|------|-------------|
| | Page / Section / Widget / Form / Modal | |

### Reused Components

| Component | Modifications Needed |
|-----------|---------------------|
| | None / [describe change] |

## Wireframes

### Screen: [Name]

```
┌─────────────────────────────────────────┐
│                                         │
│  [ASCII wireframe here]                 │
│                                         │
└─────────────────────────────────────────┘
```

### Screen: [Name]

```
┌─────────────────────────────────────────┐
│                                         │
│  [ASCII wireframe here]                 │
│                                         │
└─────────────────────────────────────────┘
```

## Interaction Specification

### Component: [Name]

| State | Visual | Behavior |
|-------|--------|----------|
| Default | [description] | [description] |
| Loading | [description] | [description] |
| Error | [description] | [description] |
| Empty | [description] | [description] |
| Disabled | [description] | [description] |
| Hover | [description] | [description] |
| Focus | [description] | [description] |

## State Transitions

```
[Event]
  → [Component]: [from state] → [to state]

  IF [condition]:
    → [outcome]

  IF [condition]:
    → [outcome]
```

## Accessibility Requirements

| Component | ARIA Role | Keyboard | Screen Reader | Contrast |
|-----------|-----------|----------|---------------|----------|
| | | | | |

## Responsive Behavior

| Element | Mobile (<768px) | Tablet (768-1024px) | Desktop (>1024px) |
|---------|-----------------|--------------------|--------------------|
| | | | |

## Interactive Prototype

- [ ] Prototype created at `prototypes/[feature-name].html`
- [ ] Covers primary user flow
- [ ] Shows all documented states
- [ ] Works at all breakpoints

---

## Approval

- [ ] Reviewed by human
- [ ] All states documented
- [ ] Accessibility requirements defined
- [ ] Ready for TDD Red phase
