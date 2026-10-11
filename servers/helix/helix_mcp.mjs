#!/usr/bin/env node
// Helix MCP: lets any AI (Claude, ChatGPT, Gemini, Cursor, ...) browse and use the 124,130 procedural
// 3D and 4D models of the Helix engine from Chroma (https://github.com/Tharunmaks/Chroma-node).
//
// Setup (PC, Mac, Linux or Android Termux; Node 18+):
//   git clone https://github.com/Tharunmaks/Chroma-node ~/Chroma-node && (cd ~/Chroma-node && npm install)
//   git clone https://github.com/Tharunmaks/MCP-king- ~/MCP-king-
//   claude mcp add helix -- node ~/MCP-king-/servers/helix/helix_mcp.mjs
//
// Environment: HELIX_HOME (Chroma-node folder, default ~/Chroma-node), HELIX_OUT (where exports are
// written, default ~/helix-models; the server never writes anywhere else).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { serve } from '../lib/mcp.mjs';

const HOME = path.resolve((process.env.HELIX_HOME || '~/Chroma-node').replace(/^~(?=$|[\\/])/, os.homedir()));
const OUT = path.resolve((process.env.HELIX_OUT || '~/helix-models').replace(/^~(?=$|[\\/])/, os.homedir()));
const THREE_VERSION = '0.170.0';

let catalogPromise;
function catalog() {
  catalogPromise ||= import(pathToFileURL(path.join(HOME, 'web/assets/js/helix/catalog.js')).href).catch((e) => {
    catalogPromise = null;
    throw new Error(
      `Helix catalog not found in ${HOME} (${e.code || e.message}). Install it with:\n` +
      '  git clone https://github.com/Tharunmaks/Chroma-node ~/Chroma-node && cd ~/Chroma-node && npm install\n' +
      'or set HELIX_HOME to your Chroma-node folder.',
    );
  });
  return catalogPromise;
}

const describe = (d) => ({ id: d.id, name: d.name, family: d.family.id, dims: d.family.dims, label: d.label, params: d.params });

function helixCode(d) {
  return `import { Helix } from 'helix';\nimport { build } from 'helix/catalog.js';\n\n` +
    `const engine = new Helix(document.querySelector('canvas'), { autoRotate: true, bloom: true });\n` +
    `const model = engine.add(build('${d.family.id}', ${JSON.stringify(d.params)}));\n` +
    (d.family.dims === 4 ? 'engine.onFrame((t, dt) => model.update(dt)); // rotate through the 4th dimension\n' : '') +
    'engine.start();';
}

async function geometry(id, quality) {
  const C = await catalog();
  const d = C.get(id);
  if (!d) throw new Error(`unknown model "${id}". Use search_models or list_families; ids look like "knot/5".`);
  const obj = C.build(d.family.id, d.params, { quality });
  if (d.family.dims === 4) {
    const g = obj.lines.geometry;
    return { d, dims: 4, v4: Array.from(obj.v4, (x) => +x.toFixed(5)), positions: Array.from(g.attributes.position.array, (x) => +x.toFixed(5)), edges: Array.from(g.index.array) };
  }
  const g = obj.geometry;
  return {
    d, dims: 3,
    positions: Array.from(g.attributes.position.array, (x) => +x.toFixed(5)),
    normals: Array.from(g.attributes.normal.array, (x) => +x.toFixed(4)),
    index: g.index ? Array.from(g.index.array) : null,
  };
}

function toObj(geo) {
  const lines = [`# ${geo.d.name} (${geo.d.id}) ${geo.d.label}`, '# exported by Helix MCP from Chroma (github.com/Tharunmaks/Chroma-node)', `o ${geo.d.id.replace('/', '_')}`];
  const p = geo.positions;
  for (let i = 0; i < p.length; i += 3) lines.push(`v ${p[i]} ${p[i + 1]} ${p[i + 2]}`);
  if (geo.dims === 4) {
    lines.push('# 4D model: 3D projection at t=0, exported as edges');
    for (let i = 0; i < geo.edges.length; i += 2) lines.push(`l ${geo.edges[i] + 1} ${geo.edges[i + 1] + 1}`);
  } else {
    const n = geo.normals;
    for (let i = 0; i < n.length; i += 3) lines.push(`vn ${n[i]} ${n[i + 1]} ${n[i + 2]}`);
    const idx = geo.index || [...Array(p.length / 3).keys()];
    for (let i = 0; i < idx.length; i += 3) {
      const [a, b, c] = [idx[i] + 1, idx[i + 1] + 1, idx[i + 2] + 1];
      lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
    }
  }
  return lines.join('\n') + '\n';
}

function toHtml(geo, { background = '#0b0b12', color = '#d9d2ff' } = {}) {
  const data = geo.dims === 4 ? { dims: 4, v4: geo.v4, edges: geo.edges } : { dims: 3, positions: geo.positions, normals: geo.normals, index: geo.index };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${geo.d.name}</title>
<style>html,body{margin:0;height:100%;background:${background};color:#eee;font:14px system-ui,sans-serif;overflow:hidden}
canvas{display:block;width:100%;height:100%;touch-action:none}#t{position:fixed;left:16px;bottom:14px;opacity:.75}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/"}}</script>
</head>
<body>
<canvas id="c"></canvas><div id="t">${geo.d.name} · ${geo.d.label} · Helix (Chroma)</div>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const D = ${JSON.stringify(data)};
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor('${background}');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
camera.position.set(0, 0, 5);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(3, 4, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0x8b5cff, 1.2); rim.position.set(-4, -2, -3); scene.add(rim);
let update = () => {};
if (D.dims === 3) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(D.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(D.normals, 3));
  if (D.index) g.setIndex(D.index);
  scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '${color}', metalness: 0.35, roughness: 0.35, side: THREE.DoubleSide })));
} else {
  const n = D.v4.length / 4, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(D.edges);
  scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true })));
  const A = new THREE.Color('#ff7a1a'), B = new THREE.Color('#8b5cff'), tmp = new THREE.Color();
  const planes = [[0, 3, 0.37], [1, 3, 0.23], [2, 3, 0.29], [0, 2, 0.11]], ang = planes.map(() => 0), w = new Float32Array(D.v4.length);
  update = (dt) => {
    w.set(D.v4);
    planes.forEach(([i, j, s], k) => {
      ang[k] += s * dt; const c = Math.cos(ang[k]), si = Math.sin(ang[k]);
      for (let v = 0; v < w.length; v += 4) { const x = w[v + i], y = w[v + j]; w[v + i] = c * x - si * y; w[v + j] = si * x + c * y; }
    });
    for (let v = 0; v < n; v++) {
      const f = 2.4 / (2.4 - w[v * 4 + 3]) * 0.9;
      pos[v * 3] = w[v * 4] * f; pos[v * 3 + 1] = w[v * 4 + 1] * f; pos[v * 3 + 2] = w[v * 4 + 2] * f;
      tmp.copy(B).lerp(A, (w[v * 4 + 3] + 1) / 2); col[v * 3] = tmp.r; col[v * 3 + 1] = tmp.g; col[v * 3 + 2] = tmp.b;
    }
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.computeBoundingSphere();
  };
  update(0);
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => { update(Math.min(clock.getDelta(), 0.1)); controls.update(); renderer.render(scene, camera); });
</script>
</body>
</html>
`;
}

function safeName(name, fallback) {
  const n = String(name || fallback).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '').slice(0, 80);
  return n || 'model';
}

const GUIDE = `Helix MCP: 124,130 procedural 3D and 4D models from the Helix engine (Chroma, github.com/Tharunmaks/Chroma-node).
Workflow:
1. list_families to see the 15 families (supershapes, torus knots, seashells, polyhedra, 4D polytopes, ...).
2. search_models("knot 3 5") or random_model to pick a model; ids look like "family/index", e.g. "knot/5".
3. get_model(id) for parameters and copy-paste code for a Helix/Chroma page.
4. export_model(id, format) writes a file into ${OUT}:
   - "html": a standalone page (three.js from a CDN) that works on phones and PCs, open it in any browser
   - "obj": a mesh for Blender, Unity, Godot, 3D printing slicers (4D models export their 3D projection as edges)
   - "json": raw geometry for your own code
Design tips for AIs: pick one hero model, give it a dark background (#0b0b12) with one accent colour,
use autoRotate plus bloom in Helix, keep text outside the canvas, and respect prefers-reduced-motion.`;

serve({
  name: 'helix',
  version: '1.0.0',
  instructions: GUIDE,
  tools: [
    {
      name: 'helix_guide',
      description: 'How to use Helix MCP: workflow, export formats and 3D design tips. Call this first.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => GUIDE,
    },
    {
      name: 'list_families',
      description: 'List the 15 Helix model families (3D and 4D) with model counts and tweakable parameters.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const C = await catalog();
        return {
          total: C.TOTAL, total3d: C.TOTAL_3D, total4d: C.TOTAL_4D,
          families: C.FAMILIES.map((f) => ({ id: f.id, name: f.name, dims: f.dims, count: f.count, description: f.description, params: (f.params || []).map((p) => p.key) })),
        };
      },
    },
    {
      name: 'search_models',
      description: 'Search Helix models. Words match family names ("seashell", "4d", "polytope"), numbers match parameters ("knot 3 5"). An exact id like "duoprism/42" returns that model.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'e.g. "torus knot 2 7", "seashell", "4d duoprism"' },
          family: { type: 'string', description: 'optional family id to restrict the search' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 12 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
        required: ['query'],
      },
      handler: async ({ query, family, limit = 12, offset = 0 }) => {
        const C = await catalog();
        const found = C.search(query, { family, limit: Math.min(50, Math.max(1, limit)), offset: Math.max(0, offset) });
        return found.length ? found.map(describe) : 'No models matched. Try fewer words, or list_families.';
      },
    },
    {
      name: 'random_model',
      description: 'Pick a deterministic pseudo-random model ("surprise me"). Same seed, same model.',
      inputSchema: { type: 'object', properties: { seed: { type: 'number', description: '0..1; omit for a random one' } } },
      handler: async ({ seed }) => {
        const C = await catalog();
        const s = typeof seed === 'number' && seed >= 0 && seed < 1 ? seed : Math.random();
        return describe(C.random(s));
      },
    },
    {
      name: 'get_model',
      description: 'Details for one model id ("family/index"): parameters, label, and copy-paste JavaScript for a Helix/Chroma page.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async ({ id }) => {
        const C = await catalog();
        const d = C.get(id);
        if (!d) throw new Error(`unknown model "${id}"`);
        return { ...describe(d), family_description: d.family.description, helix_code: helixCode(d), tip: 'Use export_model(id, "html") for a page that runs anywhere without Chroma.' };
      },
    },
    {
      name: 'export_model',
      description: `Export a model to a file in ${OUT}: "html" (standalone viewer for phone/PC browsers), "obj" (Blender/Unity/Godot/3D print) or "json" (raw geometry). Returns the file path.`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'model id, e.g. "shell/120"' },
          format: { type: 'string', enum: ['html', 'obj', 'json'], default: 'html' },
          quality: { type: 'string', enum: ['low', 'high'], default: 'high' },
          name: { type: 'string', description: 'optional file name (no folders)' },
          background: { type: 'string', description: 'html only: CSS colour, default #0b0b12' },
          color: { type: 'string', description: 'html only: mesh colour, default #d9d2ff' },
        },
        required: ['id'],
      },
      handler: async ({ id, format = 'html', quality = 'high', name, background, color }) => {
        if (!['html', 'obj', 'json'].includes(format)) throw new Error('format must be html, obj or json');
        const isColor = (c) => c === undefined || /^#[0-9a-fA-F]{3,8}$/.test(c);
        if (!isColor(background) || !isColor(color)) throw new Error('colours must be hex like #ff7a1a');
        const geo = await geometry(id, quality === 'low' ? 'low' : 'high');
        const body = format === 'obj' ? toObj(geo) : format === 'json' ? JSON.stringify(geo.dims === 4 ? { id: geo.d.id, dims: 4, v4: geo.v4, edges: geo.edges } : { id: geo.d.id, dims: 3, positions: geo.positions, normals: geo.normals, index: geo.index }) : toHtml(geo, { background, color });
        fs.mkdirSync(OUT, { recursive: true });
        const file = path.join(OUT, `${safeName(name, geo.d.id.replace('/', '-'))}${name && name.endsWith('.' + format) ? '' : '.' + format}`);
        if (path.dirname(file) !== OUT) throw new Error('refusing to write outside ' + OUT);
        fs.writeFileSync(file, body);
        return { file, bytes: Buffer.byteLength(body), vertices: geo.positions.length / 3, model: describe(geo.d) };
      },
    },
  ],
});
