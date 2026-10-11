import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './client.mjs';

const server = path.join(path.dirname(fileURLToPath(import.meta.url)), '../servers/design-kit/design_mcp.mjs');

test('design-kit MCP', async () => {
  const s = connect('node', [server]);
  try {
    assert.equal((await s.init()).serverInfo.name, 'design-kit');
    const tools = (await s.request('tools/list', {})).result.tools.map((t) => t.name);
    assert.deepEqual(tools, ['design_rules', 'palette', 'contrast', 'type_scale', 'spacing_scale', 'font_pairing', 'component_recipe', 'audit_css']);
    assert.match(await s.call('design_rules'), /SPACING/);
    for (const brand of ['#6d28d9', '#facc15', '#00ff00', '#0f172a', '#ffffff', '#e11d48', '#0ea5e9']) {
      const p = await s.call('palette', { brand });
      for (const mode of ['light', 'dark']) {
        for (const [pair, ratio] of Object.entries(p[mode].checks)) assert.ok(ratio >= 4.5, `${brand} ${mode} ${pair} = ${ratio}`);
      }
      assert.match(p.css, /prefers-color-scheme: dark/);
    }
    assert.equal((await s.call('contrast', { foreground: '#000', background: '#fff' })).ratio, '21:1');
    assert.match((await s.call('type_scale', {})).tokens['3xl'], /^clamp\(/);
    assert.match((await s.call('font_pairing', { style: 'technical' })).link, /Space\+Grotesk/);
    assert.match((await s.call('component_recipe', { name: 'hero' })).css, /\.hero/);
    const bad = await s.call('audit_css', { css: '.a{color:#777;background:#888;font-size:13px;outline:none;transition:all 1s;padding:7px}' });
    assert.ok(bad.issues.some((i) => /Low contrast/.test(i)));
    assert.ok(bad.issues.some((i) => /focus/.test(i)));
    assert.ok(bad.issues.some((i) => /4px grid/.test(i)));
    await assert.rejects(s.call('palette', { brand: 'purple' }), /not a hex colour/);
  } finally {
    s.close();
  }
});
