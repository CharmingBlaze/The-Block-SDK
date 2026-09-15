# Cursor review checklist

Use on every Antigravity handoff. Treat submissions as untrusted.

## Scope

- [ ] Only allowed files changed
- [ ] Forbidden files untouched
- [ ] No new dependencies or undeclared public exports
- [ ] No second copy of an existing helper

## Architecture

- [ ] Headless package: no `three`, DOM, `PointerEvent`, canvas
- [ ] Mutations through documented operators/commands
- [ ] Topology ops return complete mappings
- [ ] No mutable unguarded globals
- [ ] No recursive update loops

## Correctness

- [ ] Invalid input rejected without partial mutation
- [ ] Tests assert invariants (IDs, refs, manifold/boundary as specified), not only snapshots
- [ ] Undo/redo and remap tests if the task touches commands
- [ ] Cancellation / illegal lifecycle if state machines added

## Lifecycle / performance

- [ ] dispose/unsubscribe if new services
- [ ] No full-buffer rebuild where incremental was required
- [ ] No unbounded copies of large meshes in tests

## Process

- [ ] Targeted tests run and recorded in the task file
- [ ] Handoff format complete
- [ ] Evidence matrix rows updated only after Cursor confirms

Fix small defects directly. Return `CHANGES_REQUESTED` with file-level instructions when design is unsafe.
