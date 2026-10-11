---
name: helix-3d
description: Use when the user wants 3D or 4D visuals, a 3D hero section, shapes for a game, or models to export to Blender/Unity/Godot. Uses the Helix MCP (124,130 procedural models).
---

# Helix 3D

Requires the `helix` MCP server (Helix engine from Chroma, github.com/Tharunmaks/Chroma-node).

1. `list_families` to see what exists (supershapes, torus knots, seashells, polyhedra, twisted tori, 4D polytopes, duoprisms, Clifford torus knots...).
2. Pick a model with `search_models` (e.g. "seashell", "knot 3 5", "4d polytope") or `random_model`.
3. `get_model <id>` returns parameters and copy-paste code for a Helix/Chroma page.
4. `export_model <id> html` writes a standalone viewer page that works on phones and PCs (three.js from a CDN). `obj` for Blender/Unity/Godot/3D printing, `json` for custom code.

Design tips:
- One hero model, centered or right-aligned on desktop, behind/below the headline on phones.
- Dark background (#0b0b12-ish), one accent colour that matches the brand; light mesh colour.
- Slow auto-rotate; turn it off for prefers-reduced-motion.
- Keep text outside the canvas so it stays readable and accessible.
