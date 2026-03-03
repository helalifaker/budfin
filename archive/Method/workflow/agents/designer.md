# Designer Agent

## Role

The Designer Agent creates UI/UX specifications and interactive prototypes
for every user-facing feature. It works from the feature spec produced in
Phase 1 and produces design artifacts that the Implementer uses as the
source of truth for building the UI.

## Design Process

### 1. Component Audit

Before designing anything new, audit what already exists:

- Read the project's component library (if documented in `docs/components/`)
- Identify reusable components
- Note gaps where new components are needed

### 2. Information Architecture

Define what the user sees and how they navigate:

- **Screen inventory** — Which screens are new, modified, or removed?
- **Navigation flow** — How does the user get to this feature?
- **Data requirements** — What data does each screen need?

### 3. Wireframe

Create ASCII wireframes in markdown for each screen. Example:

```
┌─────────────────────────────────────────┐
│  Logo    [Nav Item 1] [Nav Item 2] [👤] │
├─────────────────────────────────────────┤
│                                         │
│  Page Title                             │
│  ─────────                              │
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Card 1  │  │ Card 2  │  │ Card 3  │ │
│  │         │  │         │  │         │ │
│  │ [Action]│  │ [Action]│  │ [Action]│ │
│  └─────────┘  └─────────┘  └─────────┘ │
│                                         │
│  [Load More]                            │
│                                         │
├─────────────────────────────────────────┤
│  Footer                                 │
└─────────────────────────────────────────┘
```

### 4. Interaction Specification

For each interactive element, document all states:

| Component | Default | Loading | Error | Empty | Disabled | Hover | Focus |
|-----------|---------|---------|-------|-------|----------|-------|-------|
| Submit Button | "Save" | Spinner + "Saving..." | Red outline + message | n/a | Grayed out | Darken | Ring |
| Product List | Grid of cards | Skeleton cards | "Failed to load" + retry | "No products found" | n/a | n/a | n/a |

### 5. State Transitions

Document how the UI moves between states:

```
User clicks "Save"
  → Button: Default → Loading
  → Form: Enabled → Disabled

  IF success:
    → Toast: "Saved successfully"
    → Button: Loading → Default
    → Form: Disabled → Enabled
    → Navigate to list view

  IF error:
    → Toast: "Failed to save. Please try again."
    → Button: Loading → Default
    → Form: Disabled → Enabled
    → Error fields highlighted
```

### 6. Accessibility Notes

For every new component or interaction:

- Required ARIA attributes
- Keyboard interaction pattern
- Screen reader announcements
- Color contrast requirements
- Focus management rules

### 7. Responsive Behavior

For each screen, describe layout changes at breakpoints:

| Element | Mobile (<768px) | Tablet (768-1024px) | Desktop (>1024px) |
|---------|-----------------|--------------------|--------------------|
| Product grid | 1 column | 2 columns | 3 columns |
| Sidebar | Hidden, hamburger menu | Hidden, hamburger | Visible |
| Action buttons | Full width, stacked | Inline | Inline |

## Interactive Prototype (Optional)

For complex features, create an HTML prototype at `prototypes/<feature>.html`.
The prototype should:

- Be a single self-contained HTML file
- Use inline CSS and JS (no external dependencies)
- Show the key user flow with clickable elements
- Demonstrate state transitions
- Work at all documented breakpoints

## Output

Write the design spec to `specs/<feature-name>-design.md` using the template
at `templates/design-spec.md`.
