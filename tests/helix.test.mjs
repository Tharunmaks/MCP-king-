// Needs a Chroma-node checkout with `npm install` done; set HELIX_HOME to it. Skips otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './client.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const home = process.env.HELIX_HOME || path.join(os.homedir(), 'Chroma-node');
const available = fs.existsSync(path.join(home, 'web/assets/js/helix/catalog.js')) && fs.existsSync(path.join(home, 'node_modules/three'));

test('helix MCP', { skip: !available && `no Chroma-node at ${home}` }, async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'helix-'));
  const s = connect('node', [path.join(here, '../servers/helix/helix_mcp.mjs')], { HELIX_HOME: home, HELIX_OUT: out });
  try {
    const info = await s.init();
    assert.equal(info.serverInfo.name, 'helix');
    const fams = await s.call('list_families');
    assert.equal(fams.total, 124130);
    assert.equal(fams.families.length, 15);
    const found = await s.call('search_models', { query: 'knot 3 5', limit: 3 });
    assert.ok(found.length > 0 && found[0].family === 'knot');
    const m = await s.call('get_model', { id: 'polytope/3' });
    assert.equal(m.dims, 4);
    assert.match(m.helix_code, /model\.update\(dt\)/);
    for (const [id, format] of [['shell/120', 'obj'], ['polytope/3', 'obj'], ['knot/5', 'html'], ['clifford/7', 'html'], ['supershape/77', 'json']]) {
      const r = await s.call('export_model', { id, format, quality: 'low' });
      assert.ok(fs.statSync(r.file).size > 100, `${id}.${format}`);
      assert.equal(path.dirname(r.file), out);
    }
    const obj = fs.readFileSync(path.join(out, 'shell-120.obj'), 'utf8');
    assert.match(obj, /^f \d+\/\/\d+ /m);
    const evil = await s.call('export_model', { id: 'knot/5', format: 'obj', name: '../../evil' });
    assert.equal(path.dirname(evil.file), out);
    await assert.rejects(s.call('get_model', { id: 'nope/1' }), /unknown model/);
  } finally {
    s.close();
  }
});
