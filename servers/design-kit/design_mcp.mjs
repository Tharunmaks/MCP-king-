#!/usr/bin/env node
// Design Kit MCP: gives any AI the design system it usually lacks, so generated UIs stop looking generic.
// Accessible colour palettes (contrast checked), type and spacing scales, font pairings,
// ready component recipes and a CSS audit.
//
//   claude mcp add design -- node ~/MCP-king-/servers/design-kit/design_mcp.mjs
//
// Pure computation: no files, no network. Node 18+ on Windows, macOS, Linux, Android (Termux).
import { serve } from '../lib/mcp.mjs';

// ------------------------------------------------------------------ colour maths (sRGB <-> OKLCH)
function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(h)) throw new Error(`not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const delin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToOklch(rgb) {
  const [r, g, b] = rgb.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

function oklchToRgbRaw([L, C, H]) {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(delin);
}

/** OKLCH -> sRGB, reducing chroma until the colour fits in the sRGB gamut. */
function oklch(L, C, H) {
  let c = C;
  for (let i = 0; i < 40; i++) {
    const rgb = oklchToRgbRaw([L, c, H]);
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005)) return toHex(rgb);
    c *= 0.92;
  }
  return toHex(oklchToRgbRaw([L, 0, H]));
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const round2 = (n) => Math.round(n * 100) / 100;

/** Move lightness until text colour `fg` reaches `target` contrast on `bg`. */
function ensureContrast(L, C, H, bg, target) {
  const darker = luminance(bg) > 0.18;
  let l = L;
  for (let i = 0; i < 100; i++) {
    const hex = oklch(l, C, H);
    if (contrast(hex, bg) >= target) return hex;
    l += darker ? -0.01 : 0.01;
    if (l <= 0 || l >= 1) break;
  }
  return darker ? '#000000' : '#ffffff';
}

function palette(seed, mode) {
  const [, C0, H] = rgbToOklch(hexToRgb(seed));
  const C = Math.max(C0, 0.04);
  const n = Math.min(C * 0.12, 0.012); // tinted neutrals
  const dark = mode === 'dark';
  const bg = dark ? oklch(0.17, n, H) : oklch(0.99, n * 0.5, H);
  const surface = dark ? oklch(0.22, n, H) : oklch(1, 0, H);
  const surface2 = dark ? oklch(0.27, n, H) : oklch(0.965, n, H);
  const border = dark ? oklch(0.34, n, H) : oklch(0.9, n, H);
  const text = ensureContrast(dark ? 0.95 : 0.2, n, H, bg, 12);
  const muted = ensureContrast(dark ? 0.75 : 0.48, n, H, bg, 4.6);
  const accent = ensureContrast(dark ? 0.72 : 0.55, C, H, bg, 4.5);
  const onAccent = contrast('#ffffff', accent) >= contrast('#111111', accent) ? '#ffffff' : '#111111';
  const accentSoft = dark ? oklch(0.3, C * 0.45, H) : oklch(0.94, C * 0.35, H);
  const status = (h) => ensureContrast(dark ? 0.75 : 0.52, 0.15, h, bg, 4.5);
  const tokens = {
    bg, surface, 'surface-2': surface2, border, text, 'text-muted': muted,
    accent, 'on-accent': onAccent, 'accent-soft': accentSoft,
    success: status(150), warning: status(70), danger: status(25), info: status(240),
  };
  const checks = {
    'text on bg': round2(contrast(text, bg)),
    'text-muted on bg': round2(contrast(muted, bg)),
    'accent on bg': round2(contrast(accent, bg)),
    'on-accent on accent': round2(contrast(onAccent, accent)),
    'text on surface': round2(contrast(text, surface)),
  };
  return { tokens, checks };
}

function paletteCss(seed) {
  const light = palette(seed, 'light');
  const dark = palette(seed, 'dark');
  const vars = (t) => Object.entries(t).map(([k, v]) => `  --${k}: ${v};`).join('\n');
  return {
    css: `:root {\n${vars(light.tokens)}\n  color-scheme: light;\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n${vars(dark.tokens).replace(/^/gm, '  ')}\n    color-scheme: dark;\n  }\n}\nbody { background: var(--bg); color: var(--text); }`,
    tailwind: `// tailwind.config.js -> theme.extend.colors\n${JSON.stringify(Object.fromEntries(Object.keys(light.tokens).map((k) => [k.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()), `var(--${k})`])), null, 2)}`,
    light, dark,
    wcag: 'All text pairs meet WCAG AA (4.5:1). Body text targets 12:1 or the closest reachable.',
  };
}

// ------------------------------------------------------------------ scales and fonts
function typeScale(base = 16, ratio = 1.25, min_vw = 360, max_vw = 1280) {
  const names = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
  const out = {};
  names.forEach((name, i) => {
    const step = i - 2;
    const max = base * ratio ** step;
    const min = step > 0 ? base * Math.max(1.125, ratio * 0.9) ** step : max; // large sizes shrink on phones
    const slope = (max - min) / (max_vw - min_vw);
    const intercept = min - slope * min_vw;
    out[name] = min === max ? `${round2(max / 16)}rem` : `clamp(${round2(min / 16)}rem, ${round2(intercept / 16)}rem + ${round2(slope * 100)}vw, ${round2(max / 16)}rem)`;
  });
  return {
    tokens: out,
    css: `:root {\n${Object.entries(out).map(([k, v]) => `  --text-${k}: ${v};`).join('\n')}\n  --leading-tight: 1.15;\n  --leading-body: 1.6;\n  --measure: 68ch;\n}`,
    rules: ['Body text 16-18px, line-height 1.5-1.7, at most ~70 characters per line.', 'Headings: tight line-height (1.1-1.2) and slightly negative letter-spacing (-0.01em to -0.03em).', 'Use 3-5 sizes on one screen, not all of them.'],
  };
}

const SPACING = { 0: '0', 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 5: '1.5rem', 6: '2rem', 7: '3rem', 8: '4rem', 9: '6rem', 10: '8rem' };

const FONTS = {
  modern: { heading: 'Inter Tight', body: 'Inter', mono: 'JetBrains Mono', note: 'Clean SaaS / dashboards.' },
  friendly: { heading: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans', mono: 'Fira Code', note: 'Approachable products and apps.' },
  editorial: { heading: 'Fraunces', body: 'Source Serif 4', mono: 'IBM Plex Mono', note: 'Blogs, magazines, long reading.' },
  technical: { heading: 'Space Grotesk', body: 'IBM Plex Sans', mono: 'IBM Plex Mono', note: 'Developer tools, docs, AI products.' },
  luxury: { heading: 'Playfair Display', body: 'Lato', mono: 'DM Mono', note: 'Fashion, hospitality, premium brands.' },
  playful: { heading: 'Bricolage Grotesque', body: 'DM Sans', mono: 'DM Mono', note: 'Consumer apps, games, creators.' },
  minimal: { heading: 'Manrope', body: 'Manrope', mono: 'Roboto Mono', note: 'Portfolios and landing pages.' },
  futuristic: { heading: 'Sora', body: 'Outfit', mono: 'Space Mono', note: '3D, crypto, sci-fi, launches.' },
};
function fontLink(f) {
  const fam = [...new Set([f.heading, f.body, f.mono])].map((n) => `family=${n.replace(/ /g, '+')}:wght@400;500;600;700`).join('&');
  return `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?${fam}&display=swap" rel="stylesheet">`;
}

// ------------------------------------------------------------------ rules and recipes
const RULES = `Design rules for AI-built interfaces (follow all of them):
LAYOUT  Mobile first; test at 360px, 768px, 1280px. One clear primary action per screen. Max content width ~1200px, text ~68ch.
SPACING Only use the spacing scale (4px steps: 4, 8, 12, 16, 24, 32, 48, 64, 96). Group related items closer than unrelated ones.
TYPE    One or two font families. 3-5 sizes per screen from the type scale. Strong size/weight contrast between heading and body.
COLOUR  Neutrals + ONE accent colour. Accent only for primary actions, links and key highlights. Every text pair >= 4.5:1 contrast.
        Use the palette tool for light AND dark mode tokens; never hard-code hex values in components.
DEPTH   Prefer borders and subtle background steps over heavy shadows. Radius: pick one (6px, 10px or 16px) and reuse it.
STATES  Every interactive element has hover, focus-visible (2px outline with offset), active, disabled and loading states.
TOUCH   Tap targets at least 44x44px; 8px between targets. No hover-only information.
MOTION  150-250ms ease-out for UI; respect prefers-reduced-motion. Animate opacity and transform only.
CONTENT Real-looking copy, not lorem ipsum. Concrete numbers. Empty, loading and error states designed, not forgotten.
IMAGES  Fixed aspect-ratio boxes so layout does not jump; alt text on every meaningful image; lazy-load below the fold.
A11Y    Semantic HTML (header, nav, main, button, label). Visible labels on inputs. Keyboard reachable. lang attribute set.
POLISH  Align to a grid, consistent icon size/stroke (e.g. Lucide 20px, 1.75 stroke), no orphaned single words in headlines.`;

const BASE_CSS = `*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:var(--font-body, system-ui, sans-serif);font-size:var(--text-base, 1rem);line-height:1.6;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}`;

const RECIPES = {
  button: {
    html: `<button class="btn btn-primary">Get started</button>\n<button class="btn btn-ghost">Learn more</button>`,
    css: `.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:44px;padding:0 1.25rem;border-radius:10px;border:1px solid transparent;font:600 0.95rem/1 inherit;cursor:pointer;transition:background .15s ease-out,transform .15s ease-out}
.btn:active{transform:translateY(1px)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-primary{background:var(--accent);color:var(--on-accent)}
.btn-primary:hover{filter:brightness(1.08)}
.btn-ghost{background:transparent;color:var(--text);border-color:var(--border)}
.btn-ghost:hover{background:var(--surface-2)}`,
  },
  card: {
    html: `<article class="card">\n  <img class="card-media" src="cover.jpg" alt="Describe the image" loading="lazy">\n  <div class="card-body">\n    <h3>Card title</h3>\n    <p>One or two lines that explain the value.</p>\n    <a class="card-link" href="#">Read more →</a>\n  </div>\n</article>`,
    css: `.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;transition:border-color .2s ease-out,transform .2s ease-out}
.card:hover{border-color:var(--accent);transform:translateY(-2px)}
.card-media{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:var(--surface-2)}
.card-body{padding:1.25rem}
.card-body h3{margin:0 0 .25rem;font-size:1.125rem;line-height:1.3}
.card-body p{margin:0 0 .75rem;color:var(--text-muted)}
.card-link{color:var(--accent);font-weight:600;text-decoration:none}`,
  },
  navbar: {
    html: `<header class="nav">\n  <a class="nav-brand" href="/">Brand</a>\n  <nav aria-label="Main">\n    <a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#docs">Docs</a>\n  </nav>\n  <a class="btn btn-primary" href="#start">Sign up</a>\n</header>`,
    css: `.nav{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:1.5rem;padding:.75rem clamp(1rem,4vw,2rem);background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav-brand{font-weight:700;color:var(--text);text-decoration:none;margin-right:auto}
.nav nav{display:flex;gap:1.25rem}
.nav nav a{color:var(--text-muted);text-decoration:none}
.nav nav a:hover{color:var(--text)}
@media (max-width:640px){.nav nav{display:none}}`,
  },
  hero: {
    html: `<section class="hero">\n  <p class="eyebrow">New · v2.0</p>\n  <h1>Say the one thing your product does, clearly.</h1>\n  <p class="lead">A sentence of supporting detail with a concrete number: setup in 2 minutes.</p>\n  <div class="hero-actions"><a class="btn btn-primary" href="#start">Start free</a><a class="btn btn-ghost" href="#demo">Watch demo</a></div>\n</section>`,
    css: `.hero{max-width:56rem;margin:0 auto;padding:clamp(4rem,12vw,8rem) 1rem clamp(3rem,8vw,6rem);text-align:center}
.eyebrow{display:inline-block;margin:0 0 1rem;padding:.25rem .75rem;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:.85rem;font-weight:600}
.hero h1{margin:0 0 1rem;font-size:clamp(2.25rem,6vw,4rem);line-height:1.08;letter-spacing:-0.03em;text-wrap:balance}
.lead{margin:0 auto 2rem;max-width:40rem;font-size:clamp(1.05rem,2vw,1.25rem);color:var(--text-muted)}
.hero-actions{display:flex;flex-wrap:wrap;gap:.75rem;justify-content:center}`,
  },
  form: {
    html: `<form class="form" novalidate>\n  <label for="email">Email</label>\n  <input id="email" name="email" type="email" autocomplete="email" required placeholder="you@example.com">\n  <p class="hint">We never share it.</p>\n  <button class="btn btn-primary" type="submit">Continue</button>\n</form>`,
    css: `.form{display:grid;gap:.5rem;max-width:24rem}
.form label{font-weight:600;font-size:.9rem}
.form input{min-height:44px;padding:0 .875rem;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit}
.form input:focus-visible{outline:2px solid var(--accent);outline-offset:1px;border-color:var(--accent)}
.form input[aria-invalid="true"]{border-color:var(--danger)}
.hint{margin:0 0 .5rem;font-size:.85rem;color:var(--text-muted)}`,
  },
  pricing: {
    html: `<section class="pricing">\n  <div class="plan"><h3>Free</h3><p class="price">$0</p><ul><li>1 project</li><li>Community support</li></ul><a class="btn btn-ghost" href="#">Start</a></div>\n  <div class="plan plan-featured"><h3>Pro</h3><p class="price">$12<span>/mo</span></p><ul><li>Unlimited projects</li><li>Priority support</li></ul><a class="btn btn-primary" href="#">Go Pro</a></div>\n</section>`,
    css: `.pricing{display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:1rem;max-width:52rem;margin:0 auto;padding:1rem}
.plan{display:flex;flex-direction:column;gap:.75rem;padding:1.5rem;border:1px solid var(--border);border-radius:16px;background:var(--surface)}
.plan-featured{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.plan h3{margin:0}
.price{margin:0;font-size:2.5rem;font-weight:700;letter-spacing:-0.02em}
.price span{font-size:1rem;font-weight:500;color:var(--text-muted)}
.plan ul{margin:0 0 auto;padding-left:1.1rem;color:var(--text-muted)}`,
  },
  modal: {
    html: `<dialog class="modal" id="confirm" aria-labelledby="confirm-title">\n  <h2 id="confirm-title">Delete project?</h2>\n  <p>This cannot be undone.</p>\n  <form method="dialog" class="modal-actions"><button class="btn btn-ghost" value="cancel">Cancel</button><button class="btn btn-primary" value="ok">Delete</button></form>\n</dialog>\n<!-- open with document.getElementById('confirm').showModal() -->`,
    css: `.modal{max-width:min(28rem,calc(100vw - 2rem));padding:1.5rem;border:1px solid var(--border);border-radius:16px;background:var(--surface);color:var(--text)}
.modal::backdrop{background:rgb(0 0 0 / .5);backdrop-filter:blur(2px)}
.modal h2{margin:0 0 .5rem;font-size:1.25rem}
.modal-actions{display:flex;justify-content:flex-end;gap:.5rem;margin-top:1.5rem}`,
  },
  'empty-state': {
    html: `<div class="empty">\n  <div class="empty-icon" aria-hidden="true">✦</div>\n  <h3>No projects yet</h3>\n  <p>Create your first project to see it here.</p>\n  <a class="btn btn-primary" href="#new">New project</a>\n</div>`,
    css: `.empty{display:grid;justify-items:center;gap:.5rem;padding:3rem 1rem;text-align:center;border:1px dashed var(--border);border-radius:16px}
.empty-icon{display:grid;place-items:center;width:3rem;height:3rem;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:1.25rem}
.empty h3{margin:.5rem 0 0}
.empty p{margin:0 0 .75rem;color:var(--text-muted)}`,
  },
};

// ------------------------------------------------------------------ CSS audit
function auditCss(css) {
  const issues = [];
  const colors = new Set((css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) || []).map((c) => c.toLowerCase()));
  if (colors.size > 12) issues.push(`${colors.size} different hard-coded colours: move them into ~10 CSS variables (palette tool).`);
  const sizes = new Set((css.match(/font-size\s*:\s*([^;}{]+)/g) || []).map((s) => s.split(':')[1].trim()));
  if (sizes.size > 8) issues.push(`${sizes.size} different font sizes: use a type scale (type_scale tool) with 5-9 steps.`);
  const pxFonts = (css.match(/font-size\s*:\s*\d+px/g) || []).length;
  if (pxFonts) issues.push(`${pxFonts} font sizes in px: use rem so users' text size settings work.`);
  const imp = (css.match(/!important/g) || []).length;
  if (imp > 3) issues.push(`${imp} !important: fix specificity instead.`);
  const z = [...new Set((css.match(/z-index\s*:\s*(-?\d+)/g) || []).map((s) => +s.split(':')[1]))];
  if (z.some((v) => v > 1000)) issues.push(`z-index up to ${Math.max(...z)}: use a small scale (1, 10, 20, 50, 100).`);
  if (/(animation|transition)\s*:/.test(css) && !/prefers-reduced-motion/.test(css)) issues.push('Animations without a prefers-reduced-motion rule.');
  if (/outline\s*:\s*(none|0)/.test(css) && !/focus-visible/.test(css)) issues.push('Focus outline removed with no :focus-visible replacement (keyboard users get lost).');
  if (!/@media/.test(css)) issues.push('No @media queries: check the layout at 360px (phones).');
  if (!/prefers-color-scheme|data-theme/.test(css)) issues.push('No dark mode: palette tool gives light and dark tokens.');
  const spacings = (css.match(/(?:margin|padding|gap)[a-z-]*\s*:\s*([^;}{]+)/g) || []).flatMap((s) => s.split(':')[1].match(/\d+(?:\.\d+)?px/g) || []).map((v) => parseFloat(v));
  const off = [...new Set(spacings.filter((v) => v % 4 !== 0 && v !== 1 && v !== 2))];
  if (off.length) issues.push(`Spacing values off the 4px grid: ${off.slice(0, 10).join('px, ')}px.`);
  const rules = css.match(/[^{}]+\{[^{}]*\}/g) || [];
  for (const r of rules) {
    const fg = r.match(/(?:^|[;{\s])color\s*:\s*(#[0-9a-fA-F]{3,8})\b/);
    const bg = r.match(/background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})\b/);
    if (fg && bg) {
      const ratio = contrast(fg[1], bg[1]);
      if (ratio < 4.5) issues.push(`Low contrast ${round2(ratio)}:1 in "${r.split('{')[0].trim().slice(0, 60)}" (${fg[1]} on ${bg[1]}); needs 4.5:1.`);
    }
  }
  return issues.length ? { score: Math.max(0, 100 - issues.length * 10), issues } : { score: 100, issues: [], note: 'No problems found by the automatic checks. Still review it at 360px and in dark mode.' };
}

// ------------------------------------------------------------------ server
serve({
  name: 'design-kit',
  version: '1.0.0',
  instructions: 'Call design_rules before building UI. Use palette, type_scale and component_recipe instead of inventing colours and sizes; run audit_css on the result.',
  tools: [
    {
      name: 'design_rules',
      description: 'Professional UI design rules (layout, spacing, type, colour, states, touch, motion, accessibility). Call before building any interface.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => `${RULES}\n\nBase CSS to start every project with:\n${BASE_CSS}`,
    },
    {
      name: 'palette',
      description: 'Accessible light + dark colour tokens from one brand colour (OKLCH, contrast-checked to WCAG AA). Returns CSS variables and a Tailwind snippet.',
      inputSchema: { type: 'object', properties: { brand: { type: 'string', description: 'hex colour, e.g. "#6d28d9"' } }, required: ['brand'] },
      handler: async ({ brand }) => paletteCss(brand),
    },
    {
      name: 'contrast',
      description: 'WCAG contrast ratio between two hex colours, with AA/AAA pass/fail.',
      inputSchema: { type: 'object', properties: { foreground: { type: 'string' }, background: { type: 'string' } }, required: ['foreground', 'background'] },
      handler: async ({ foreground, background }) => {
        const r = contrast(foreground, background);
        return { ratio: `${round2(r)}:1`, 'AA normal text (4.5)': r >= 4.5, 'AA large text (3)': r >= 3, 'AAA normal text (7)': r >= 7 };
      },
    },
    {
      name: 'type_scale',
      description: 'Fluid type scale (CSS clamp) that shrinks headings on phones and grows on desktops.',
      inputSchema: { type: 'object', properties: { base: { type: 'number', default: 16, minimum: 12, maximum: 24 }, ratio: { type: 'number', default: 1.25, minimum: 1.067, maximum: 1.618, description: '1.2 calm, 1.25 balanced, 1.333 bold, 1.5 dramatic' } } },
      handler: async ({ base = 16, ratio = 1.25 }) => typeScale(Math.min(24, Math.max(12, base)), Math.min(1.618, Math.max(1.067, ratio))),
    },
    {
      name: 'spacing_scale',
      description: 'The 4px-based spacing scale as CSS variables.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => ({ tokens: SPACING, css: `:root {\n${Object.entries(SPACING).map(([k, v]) => `  --space-${k}: ${v};`).join('\n')}\n  --radius: 10px;\n  --radius-lg: 16px;\n}` }),
    },
    {
      name: 'font_pairing',
      description: `Google Font pairings that work together, with the <link> tag. Styles: ${Object.keys(FONTS).join(', ')}.`,
      inputSchema: { type: 'object', properties: { style: { type: 'string', enum: Object.keys(FONTS) } } },
      handler: async ({ style }) => {
        if (!style) return Object.fromEntries(Object.entries(FONTS).map(([k, f]) => [k, `${f.heading} / ${f.body} — ${f.note}`]));
        const f = FONTS[style];
        if (!f) throw new Error(`style must be one of: ${Object.keys(FONTS).join(', ')}`);
        return { ...f, link: fontLink(f), css: `:root {\n  --font-heading: '${f.heading}', system-ui, sans-serif;\n  --font-body: '${f.body}', system-ui, sans-serif;\n  --font-mono: '${f.mono}', ui-monospace, monospace;\n}\nh1,h2,h3,h4{font-family:var(--font-heading)}` };
      },
    },
    {
      name: 'component_recipe',
      description: `Accessible, mobile-first HTML + CSS for a component using the palette tokens. Components: ${Object.keys(RECIPES).join(', ')}.`,
      inputSchema: { type: 'object', properties: { name: { type: 'string', enum: Object.keys(RECIPES) } }, required: ['name'] },
      handler: async ({ name }) => {
        const r = RECIPES[name];
        if (!r) throw new Error(`component must be one of: ${Object.keys(RECIPES).join(', ')}`);
        return { ...r, needs: 'CSS variables from the palette tool (--bg, --surface, --text, --accent, ...). Buttons use the button recipe.' };
      },
    },
    {
      name: 'audit_css',
      description: 'Check CSS for common design problems: too many colours or font sizes, px fonts, low contrast, missing focus styles, no reduced-motion, off-grid spacing, no dark mode, no responsive rules.',
      inputSchema: { type: 'object', properties: { css: { type: 'string' } }, required: ['css'] },
      handler: async ({ css }) => auditCss(String(css).slice(0, 500000)),
    },
  ],
});

