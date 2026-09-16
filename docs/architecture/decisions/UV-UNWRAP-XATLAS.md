# ADR: Automatic chart unwrap uses xatlas via watlas

**Status:** Accepted  
**Date:** 2026-09-16  
**Feature name:** Automatic chart unwrap

## Decision

Use [watlas](https://github.com/toji/watlas) 1.0.1 as the first `UvUnwrapBackend`. watlas is a WebAssembly wrapper for [xatlas](https://github.com/jpcy/xatlas).

Do not describe this feature as LSCM or ABF++. xatlas is a chart-based atlas generator (thekla_atlas lineage). Exact LSCM and ABF++ remain separate deferred backends.

## Why xatlas / watlas

- Charts and packs triangle meshes in Node, browsers, and workers.
- Returns original-vertex `xref` mapping and preserves triangle count.
- MIT licensed; no Blockbench code.
- Avoids shipping a from-scratch parameterization solver.

## Why LSCM and ABF++ are deferred

Exact least-squares conformal mapping and ABF++ would require a different library (for example [OpenABF](https://github.com/educelab/OpenABF)), a custom WASM build, Eigen, pin constraints, and extra packaging work. They are not required to ship automatic chart unwrap.

## Consequences

- Public API talks about automatic chart unwrap, projections, and packing.
- `UvUnwrapBackend` hides watlas. Hosts never receive WASM objects.
- `respectExistingSeams` and `preserveExistingCharts` are unsupported in v1 (watlas has no seam-edge list; input UVs are per-vertex).
- `parameterizeUvCharts` is a documented no-op because xatlas `computeCharts` already parameterizes.
- `packUvCharts` re-runs generate; native `packCharts` needs a live Atlas that this SDK does not keep.
- Pin-constrained parameterization is not claimed.
- OpenABF may be added later as another backend if quality or algorithm selection requires it.
