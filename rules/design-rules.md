# Design rules for any AI (paste into your chat or rules file)

When you build any user interface, follow these rules:

1. **Mobile first.** Design for 360px wide first, then 768px and 1280px. No horizontal scrolling.
2. **One accent colour** plus tinted neutrals. Accent only for primary buttons, links and key highlights. Define colours as CSS variables, with a dark mode.
3. **Contrast:** every text/background pair at least 4.5:1 (WCAG AA).
4. **Spacing scale only:** 4, 8, 12, 16, 24, 32, 48, 64, 96 px. Related things closer together than unrelated things.
5. **Typography:** max two font families, 3-5 sizes per screen, body 16-18px with 1.5-1.7 line height, lines under ~70 characters. Headings tight (1.1-1.2) with slightly negative letter spacing.
6. **One primary action per screen.** Secondary actions are ghost or text buttons.
7. **States:** hover, focus-visible (clear 2px outline), active, disabled, loading, empty and error states for everything interactive.
8. **Touch:** tap targets at least 44x44px.
9. **Depth:** subtle borders and background steps rather than heavy shadows. One border radius reused everywhere.
10. **Motion:** 150-250ms ease-out, opacity/transform only, respect prefers-reduced-motion.
11. **Real content:** realistic copy and numbers, never lorem ipsum.
12. **Accessibility:** semantic HTML, labels on inputs, alt text, keyboard navigation, lang attribute.

Before you finish, review the page at 360px and in dark mode and fix anything that breaks these rules.
