import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './client.mjs';

const server = path.join(path.dirname(fileURLToPath(import.meta.url)), '../servers/lean-context/lean_mcp.mjs');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lean-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.mkdirSync(path.join(dir, 'node_modules/junk'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'node_modules/junk/index.js'), 'const needle = 1;\n');
  const fns = Array.from({ length: 30 }, (_, i) => `export function fn${i}(a, b) {\n  const x = a + b * ${i};\n  if (x > 10) {\n    return x - 1;\n  }\n  return x;\n}\n`).join('\n');
  fs.writeFileSync(path.join(dir, 'src/math.js'), `// math helpers\nconst twice = (n) => n * 2;\n\n${fns}\nexport class Calc {\n  add(a, b) {\n    return a + b; // needle\n  }\n}\n`);
  fs.writeFileSync(path.join(dir, 'src/app.py'), 'import os\n\nclass App:\n    def run(self):\n        return 1\n\n    def stop(self):\n        return 2\n\ndef main():\n    App().run()\n');
  fs.writeFileSync(path.join(dir, 'README.md'), '# Title\n\nintro\n\n## Install\n\nsteps\n\n## Use\n\nmore\n');
  return dir;
}

for (const noRg of [false, true]) {
  test(`lean-context MCP${noRg ? ' (built-in search)' : ''}`, async () => {
    const dir = fixture();
    const s = connect('node', [server], { LEAN_ROOT: dir, ...(noRg ? { LEAN_NO_RG: '1' } : {}) });
    try {
      assert.equal((await s.init()).serverInfo.name, 'lean-context');
      const map = await s.call('project_map', {});
      assert.match(map, /math\.js \(\d+\)/);
      assert.doesNotMatch(map, /node_modules/);
      const o = await s.call('outline', { path: 'src/math.js' });
      assert.match(o, /^2-2 {2}const twice/m);
      assert.match(o, /^4-10 {2}export function fn0/m);
      assert.match(o, /class Calc/);
      const sym = await s.call('read_symbol', { path: 'src/math.js', name: 'fn3' });
      assert.match(sym, /a \+ b \* 3/);
      assert.doesNotMatch(sym, /fn4/);
      const py = await s.call('read_symbol', { path: 'src/app.py', name: 'App' });
      assert.match(py, /def stop/);
      assert.doesNotMatch(py, /def main/);
      const md = await s.call('read_symbol', { path: 'README.md', name: 'Install' });
      assert.match(md, /steps/);
      assert.doesNotMatch(md, /more/);
      const hits = await s.call('search', { pattern: 'needle' });
      assert.match(hits, /src\/math\.js:\d+:/);
      assert.doesNotMatch(hits, /node_modules/);
      assert.match(await s.call('read_lines', { path: 'src/app.py', start: 3, end: 4 }), /^3\tclass App:/m);
      const rep = await s.call('token_report', { path: 'src/math.js' });
      assert.ok(parseInt(rep.saving_outline_plus_one_symbol) > 50, JSON.stringify(rep));
      await assert.rejects(s.call('read_lines', { path: '../../../etc/passwd' }), /outside|not found/);
      await assert.rejects(s.call('outline', { path: '/etc/hostname' }), /outside|not found/);
      assert.match(await s.call('git_brief', {}), /not a git repository|branch:/);
    } finally {
      s.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}
