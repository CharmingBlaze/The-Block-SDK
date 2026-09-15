# Task packet template

Copy to `tasks/<TASK-ID>.md` (and optionally `tasks/active/` while in flight). Do not start work from this template alone.

```markdown
# <TASK-ID>: <Title>

Status: DRAFT
Owner: Antigravity
Reviewer: Cursor
Branch: agent/<TASK-ID>

## Specification requirements

- REQ-000 (section)

## Goal

One vertical slice. Not a subsystem.

## Current verified behavior

What tests already prove.

## Allowed files

- packages/<pkg>/src/<file>.ts

## Forbidden files

- packages/<other>/**
- pnpm-lock.yaml
- docs/architecture/modeling-operator-specification.md

## Existing APIs to reuse

- symbol names and paths

## Dependencies permitted

- None (default)

## Implementation constraints

- Headless packages: no `three`, no DOM
- Mutations through existing operators/commands
- No new public exports unless listed above

## Acceptance criteria

- …

## Required tests

- packages/<pkg>/tests/<file>.test.ts

## Verification commands

- pnpm exec vitest run packages/<pkg>/tests/<file>.test.ts

## Lifecycle requirements

- dispose/unsubscribe if new services; else N/A

## Performance requirements

- …

## Handoff requirements

Use this report (repository file or PR body). Conversation memory is not a handoff.

```text
Task:
Requirement IDs:
Branch:
Commits:

Implemented:
- ...

Files changed:
- ...

Files inspected but not changed:
- ...

Public API changes:
- None

Shared contract changes:
- None

Dependencies added:
- None

Verification:
- <command>: PASS/FAIL

New tests:
- ...

Lifecycle and cleanup:
- ...

Performance impact:
- ...

Known limitations:
- ...

Blockers:
- ...

Ready for Cursor review:
- YES/NO
```

## Blockers

- None
```
