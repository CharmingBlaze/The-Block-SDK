# System Architecture: modeling-kit

> Generated automatically by **Async IDE Living Repo Wiki** on 2026-09-20.

## Overview
Private workspace for The Block SDK. Public packages publish as @modeling-kit/*.

## Technology Stack
- **Runtime & Language**: TypeScript / Node.js
- **Core Frameworks**: Node.js Standard Modules
- **Test Runner**: Vitest

## Core Subsystems & Directory Layout
- `/apps`: Subsystem source tree.
- `/docs`: Subsystem source tree.
- `/generated`: Subsystem source tree.
- `/packages`: Subsystem source tree.
- `/scripts`: Subsystem source tree.
- `/tasks`: Subsystem source tree.
- `/test-results`: Subsystem source tree.
- `/tests`: Subsystem source tree.

## Architectural Principles
1. **Local-First & Safe**: All persistence, indexes, and session anchors remain within workspace `.async/` or user cache.
2. **Atomic Patches**: Multi-file code modifications apply atomically with rollback on failure.
3. **Anti-Drift Anchoring**: Agent reasoning is anchored to specified constraints, milestones, and factual memory.
4. **English Default**: Code, comments, documentation, and agent outputs default to clean, idiomatic English.