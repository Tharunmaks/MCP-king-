---
name: perf-optimizer
description: Use when the user says something is slow, uses too much memory, or wants faster load times.
---

# Performance Optimizer

1. **Measure first.** Get a baseline number (time, memory, Lighthouse score, query time) with a repeatable command.
2. **Profile** to find where time actually goes (profiler, EXPLAIN ANALYZE, browser Performance panel). Don't guess.
3. Fix the biggest cost first. Typical wins: N+1 queries → batch/join; missing DB index; repeated work → cache/memoise; sync I/O in hot paths; huge bundles → code splitting; unoptimised images → modern formats + sizes; layout thrash.
4. Re-measure with the same command and report before/after numbers.
5. Keep readability: no micro-optimisations that save microseconds and cost clarity.

Web: use the Chrome DevTools MCP (`performance_start_trace`) or Lighthouse when available.
