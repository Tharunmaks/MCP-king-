---
name: ui-designer
description: Use when building or restyling any web or mobile UI (pages, components, dashboards, landing pages) so the result looks professionally designed, accessible and responsive.
---

# UI Designer

## Before writing UI
1. If the `design` MCP server is connected: call `design_rules`, then `palette` with the brand colour (or pick one that fits the product), `type_scale`, `font_pairing` for the product's mood, and `component_recipe` for buttons/cards/forms you need.
2. Without it: define CSS variables for bg, surface, border, text, text-muted, accent, on-accent, with a dark-mode override under `prefers-color-scheme: dark`.

## Rules
- Mobile first: 360px, then 768px, then 1280px. No horizontal scroll.
- Neutrals + one accent. Contrast >= 4.5:1 for all text.
- Spacing from the 4px scale (4, 8, 12, 16, 24, 32, 48, 64, 96).
- Two fonts max, 3-5 sizes per screen, body 16-18px / line-height 1.6, max ~68ch line length.
- One primary action per screen. 44px minimum tap targets.
- Every interactive element: hover, focus-visible, active, disabled, loading.
- Design empty, loading and error states.
- Real, specific copy (no lorem ipsum).
- Motion 150-250ms ease-out, transform/opacity only, honour prefers-reduced-motion.

## Finish
- Run `audit_css` (design MCP) on the CSS and fix every issue it reports.
- Check the layout at 360px and in dark mode before saying you're done.
