#!/usr/bin/env node
// Lean Context MCP: cut the tokens an AI coder spends reading your code.
// Instead of reading whole files, the AI asks for a project map, a file outline, one function,
// or compact search hits. Typical saving on a 500-line file: 80-95% of the reading tokens
// (run token_report on your own files to see the real number).
//
//   claude mcp add lean -- node ~/MCP-king-/servers/lean-context/lean_mcp.mjs
//
// Works on Windows, macOS, Linux and Android (Termux) with Node 18+. Read-only: it never writes files.
// Root folder: LEAN_ROOT, or the folder the AI app starts it in. Paths outside the root are refused.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from '../lib/mcp.mjs';

const ROOT = fs.realpathSync(path.resolve(process.env.LEAN_ROOT || process.cwd()));
const SKIP = new Set(['.git', 'node_modules', '.next', '.nuxt', 'dist', 'build', 'out', 'target', '.venv', 'venv', '__pycache__', '.gradle', '.idea', '.vscode', 'coverage', '.cache', 'Pods', 'DerivedData', '.dart_tool', 'vendor', '.turbo', '.svelte-kit', '.expo', 'obj']);
const MAX_FILE = 2 << 20;
const tokens = (s) => Math.ceil(s.length / 4); // rough: ~4 characters per token for code and English

function resolve(p = '.') {
  const abs = path.resolve(ROOT, String(p));
  let real;
  try { real = fs.realpathSync(abs); } catch { throw new Error(`not found: ${p}`); }
  if (real !== ROOT && !real.startsWith(ROOT + path.sep)) throw new Error(`refusing to read outside the project root (${ROOT})`);
  return real;
}
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/') || '.';

function readText(abs) {
  const st = fs.statSync(abs);
  if (!st.isFile()) throw new Error(`${rel(abs)} is not a file`);
  if (st.size > MAX_FILE) throw new Error(`${rel(abs)} is larger than 2 MB; use search or read_lines`);
  const buf = fs.readFileSync(abs);
  if (buf.subarray(0, 8000).includes(0)) throw new Error(`${rel(abs)} looks binary`);
  return buf.toString('utf8');
}

// ------------------------------------------------------------------ outline
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'else', 'do', 'try', 'with', 'new', 'typeof', 'await', 'sizeof', 'elif']);
const LANGS = [
  { ext: ['py', 'pyi'], indent: true, re: [/^(\s*)(?:async\s+)?def\s+(\w+)/, /^(\s*)class\s+(\w+)/] },
  { ext: ['rb'], indent: true, re: [/^(\s*)def\s+(?:self\.)?([\w?!=]+)/, /^(\s*)(?:class|module)\s+([\w:]+)/] },
  { ext: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'mts', 'cts', 'vue', 'svelte'], re: [
    /^(\s*)(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)/,
    /^(\s*)(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/,
    /^(\s*)(?:export\s+)?(?:declare\s+)?(?:interface|type|enum)\s+(\w+)/,
    /^(\s*)(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*(?::[^=]+)?=>/,
    /^(\s*)(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/,
    /^()(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::[^=]+)?=\s*[{[]\s*$/,
    /^(\s+)(?:(?:public|private|protected|static|readonly|override|async|get|set)\s+)*\*?(\w+)\s*(?:<[^>]*>)?\([^)]*\)\s*(?::\s*[^{]+)?\{\s*$/,
  ] },
  { ext: ['go'], re: [/^()func\s+(?:\([^)]*\)\s*)?(\w+)/, /^()type\s+(\w+)/] },
  { ext: ['rs'], re: [/^(\s*)(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+(\w+)/, /^(\s*)(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|trait|mod|union)\s+(\w+)/, /^(\s*)impl(?:<[^>]*>)?\s+([\w:<>, ]+?)\s*\{/] },
  { ext: ['java', 'kt', 'kts', 'cs', 'scala', 'swift', 'dart', 'groovy'], re: [
    /^(\s*)(?:[\w@]+\s+)*(?:class|interface|enum|struct|object|record|protocol|extension|trait|mixin)\s+(\w+)/,
    /^(\s*)(?:[\w@]+\s+)*(?:fun|func|def)\s+(?:<[^>]*>\s*)?(?:[\w.]+\.)?(\w+)/,
    /^(\s*)(?:(?:public|private|protected|internal|static|final|abstract|override|async|virtual|synchronized|suspend)\s+)+[\w<>\[\],.? ]+\s+(\w+)\s*\([^;]*$/,
  ] },
  { ext: ['c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'hh', 'm', 'mm'], re: [/^()(?:[\w*&:<>,]+\s+)+\**&?([\w:~]+)\s*\([^;]*$/, /^(\s*)(?:typedef\s+)?(?:struct|class|enum|union|namespace)\s+(\w+)/] },
  { ext: ['php'], re: [/^(\s*)(?:[\w]+\s+)*function\s+(\w+)/, /^(\s*)(?:abstract\s+|final\s+)?(?:class|interface|trait|enum)\s+(\w+)/] },
  { ext: ['sh', 'bash', 'zsh'], re: [/^()(?:function\s+)?([\w-]+)\s*\(\)\s*\{?/] },
  { ext: ['lua'], re: [/^(\s*)(?:local\s+)?function\s+([\w.:]+)/] },
  { ext: ['md', 'mdx', 'markdown'], heading: true, re: [/^()(#{1,6}\s+.+)$/] },
  { ext: ['css', 'scss', 'less'], re: [/^()([^\s@][^{;]*?)\s*\{\s*$/, /^()(@media[^{]+)\{/] },
];
const langFor = (file) => LANGS.find((l) => l.ext.includes(path.extname(file).slice(1).toLowerCase()));

function braceEnd(lines, start) {
  let depth = 0;
  let opened = false;
  for (let i = start; i < lines.length; i++) {
    const s = lines[i].replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '').replace(/\/\/.*$/, '');
    for (const ch of s) {
      if (ch === '{') { depth++; opened = true; } else if (ch === '}') depth--;
    }
    if (opened && depth <= 0) return i;
    if (!opened) {
      // a one-line declaration (`const f = (x) => x * 2;`) or a signature continuing on the next lines
      const t = s.trim();
      const next = (lines[i + 1] || '').trim();
      if (i > start + 6) return null;
      if (!/[(,=>:]$/.test(t) && !next.startsWith('{') && !/^[.)?:]/.test(next)) return i;
    }
  }
  return null;
}

function indentEnd(lines, start, indent) {
  let last = start;
  for (let i = start + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const ind = lines[i].match(/^\s*/)[0].length;
    if (ind <= indent && !/^\s*[)\]}]/.test(lines[i])) break;
    last = i;
  }
  return last;
}

function outlineOf(file, src) {
  const lang = langFor(file);
  if (!lang) return null;
  const lines = src.split('\n');
  const syms = [];
  lines.forEach((line, i) => {
    for (const re of lang.re) {
      const m = line.match(re);
      if (!m) continue;
      const name = m[2].trim();
      if (KEYWORDS.has(name)) break;
      syms.push({ name, line: i + 1, indent: m[1].length, sig: line.trim().slice(0, 160) });
      break;
    }
  });
  for (let k = 0; k < syms.length; k++) {
    const s = syms[k];
    let end = null;
    if (lang.heading) {
      const level = s.name.match(/^#+/)[0].length;
      const next = syms.slice(k + 1).find((o) => o.name.match(/^#+/)[0].length <= level);
      end = (next ? next.line - 1 : lines.length) - 1;
    } else if (lang.indent) end = indentEnd(lines, s.line - 1, s.indent);
    else end = braceEnd(lines, s.line - 1);
    if (end == null) {
      const next = syms.slice(k + 1).find((o) => o.indent <= s.indent);
      end = (next ? next.line - 1 : lines.length) - 1;
    }
    s.end = Math.max(s.line, end + 1);
  }
  return { lines: lines.length, symbols: syms };
}

function formatOutline(file, o) {
  if (!o) return `${file}: no outline for this file type; use read_lines or search.`;
  if (!o.symbols.length) return `${file} (${o.lines} lines): no symbols found; use read_lines.`;
  return `${file} (${o.lines} lines)\n` + o.symbols.map((s) => `${' '.repeat(Math.min(s.indent, 12))}${s.line}-${s.end}  ${s.sig}`).join('\n');
}

// ------------------------------------------------------------------ walking and search
function* walk(dir, depth = Infinity) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  entries.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
  for (const e of entries) {
    if (SKIP.has(e.name) || (e.name.startsWith('.') && e.name !== '.github' && e.name !== '.claude')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield { abs, dir: true };
      if (depth > 1) yield* walk(abs, depth - 1);
    } else if (e.isFile()) yield { abs, dir: false };
  }
}

function globToRe(glob) {
  const re = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\/?/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\?/g, '.').replace(/\u0000/g, '(?:.*/)?');
  return new RegExp(`(^|/)${re}$`, 'i');
}

function hasRipgrep() {
  try { execFileSync('rg', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; }
}
const RG = process.env.LEAN_NO_RG ? false : hasRipgrep();

function search({ pattern, path: p = '.', glob, regex = false, max_results = 40, ignore_case = true }) {
  const base = resolve(p);
  const max = Math.min(200, Math.max(1, max_results));
  const hits = [];
  if (RG) {
    const args = ['--line-number', '--no-heading', '--color', 'never', '--max-columns', '200', '--max-columns-preview', '-m', '20'];
    if (!regex) args.push('--fixed-strings');
    if (ignore_case) args.push('--ignore-case');
    if (glob) args.push('--glob', glob);
    for (const s of SKIP) args.push('--glob', `!${s}`);
    args.push('--', pattern, base);
    let out = '';
    try { out = execFileSync('rg', args, { encoding: 'utf8', maxBuffer: 32 << 20 }); } catch (e) { out = e.stdout || ''; if (e.status > 1) throw new Error(e.stderr || 'search failed'); }
    for (const line of out.split('\n')) {
      if (!line) continue;
      const m = line.match(/^(.*?):(\d+):(.*)$/);
      if (m) hits.push(`${rel(m[1])}:${m[2]}: ${m[3].trim().slice(0, 200)}`);
      if (hits.length >= max) break;
    }
  } else {
    const re = regex ? new RegExp(pattern, ignore_case ? 'i' : '') : null;
    const needle = ignore_case ? pattern.toLowerCase() : pattern;
    const gre = glob ? globToRe(glob) : null;
    const files = fs.statSync(base).isFile() ? [{ abs: base }] : [...walk(base)].filter((e) => !e.dir);
    for (const { abs } of files) {
      if (gre && !gre.test(rel(abs))) continue;
      let src;
      try { src = readText(abs); } catch { continue; }
      const lines = src.split('\n');
      for (let i = 0; i < lines.length && hits.length < max; i++) {
        const l = lines[i];
        if (re ? re.test(l) : (ignore_case ? l.toLowerCase() : l).includes(needle)) hits.push(`${rel(abs)}:${i + 1}: ${l.trim().slice(0, 200)}`);
      }
      if (hits.length >= max) break;
    }
  }
  return hits.length ? hits.join('\n') + (hits.length >= max ? `\n(stopped at ${max} hits; narrow the pattern or path)` : '') : 'no matches';
}

function git(args) {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
}

// ------------------------------------------------------------------ rules for the AI
const RULES = `Lean Context rules (follow these to save tokens):
1. Start with project_map, not by listing or reading files one by one.
2. Before reading a file, call outline. Then read_symbol for the one function you need, or read_lines for a small range.
3. Use search to find where something is used instead of opening files to look.
4. Never re-read a file you already read in this conversation unless it changed.
5. Use git_brief to see what changed instead of reading diffs of whole files.
6. Answer briefly: no restating the question, no summary of what you are about to do, no closing recap.
7. When editing, change only the lines needed; do not print the whole file back.`;

serve({
  name: 'lean-context',
  version: '1.0.0',
  instructions: RULES,
  tools: [
    {
      name: 'lean_rules',
      description: 'Token-saving rules for this project. Call once at the start of a task.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => `${RULES}\nProject root: ${ROOT}\nSearch engine: ${RG ? 'ripgrep' : 'built-in'}`,
    },
    {
      name: 'project_map',
      description: 'Compact tree of the project with line counts (skips node_modules, build output, .git). Much cheaper than listing folders one by one.',
      inputSchema: { type: 'object', properties: { path: { type: 'string', default: '.' }, depth: { type: 'integer', minimum: 1, maximum: 8, default: 3 }, max_entries: { type: 'integer', minimum: 10, maximum: 1000, default: 300 } } },
      handler: async ({ path: p = '.', depth = 3, max_entries = 300 }) => {
        const base = resolve(p);
        const out = [];
        let n = 0;
        for (const e of walk(base, depth)) {
          if (++n > max_entries) { out.push(`... more entries; raise max_entries or map a sub-folder`); break; }
          const r = path.relative(base, e.abs).split(path.sep);
          const pad = '  '.repeat(r.length - 1);
          if (e.dir) { out.push(`${pad}${r.at(-1)}/`); continue; }
          let info = '';
          try {
            const st = fs.statSync(e.abs);
            if (st.size < MAX_FILE) {
              const b = fs.readFileSync(e.abs);
              info = b.subarray(0, 8000).includes(0) ? ` (${Math.round(st.size / 1024)} KB binary)` : ` (${b.toString('utf8').split('\n').length})`;
            } else info = ` (${Math.round(st.size / 1048576)} MB)`;
          } catch {}
          out.push(`${pad}${r.at(-1)}${info}`);
        }
        return `${rel(base)}/  (numbers are line counts)\n${out.join('\n')}`;
      },
    },
    {
      name: 'outline',
      description: 'Functions, classes, types and headings of a file with line ranges (start-end). Use before reading any file.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      handler: async ({ path: p }) => {
        const abs = resolve(p);
        return formatOutline(rel(abs), outlineOf(abs, readText(abs)));
      },
    },
    {
      name: 'read_symbol',
      description: 'Read just one function/class/heading section from a file by name, with line numbers.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, name: { type: 'string', description: 'symbol name, e.g. "handleLogin" or "User"' } }, required: ['path', 'name'] },
      handler: async ({ path: p, name }) => {
        const abs = resolve(p);
        const src = readText(abs);
        const o = outlineOf(abs, src);
        if (!o) throw new Error('no outline for this file type; use read_lines');
        const want = String(name).toLowerCase();
        const matches = o.symbols.filter((s) => s.name.toLowerCase() === want || s.name.toLowerCase().replace(/^#+\s*/, '') === want);
        if (!matches.length) {
          const near = o.symbols.filter((s) => s.name.toLowerCase().includes(want)).slice(0, 10).map((s) => `${s.name} (line ${s.line})`);
          throw new Error(`"${name}" not found in ${rel(abs)}${near.length ? '. Close matches: ' + near.join(', ') : ''}`);
        }
        const lines = src.split('\n');
        return matches.slice(0, 3).map((s) => {
          const end = Math.min(s.end, s.line + 399);
          const body = lines.slice(s.line - 1, end).map((l, i) => `${s.line + i}\t${l}`).join('\n');
          return `${rel(abs)}:${s.line}-${s.end}\n${body}${end < s.end ? `\n... (truncated; read_lines ${end + 1}-${s.end})` : ''}`;
        }).join('\n\n');
      },
    },
    {
      name: 'read_lines',
      description: 'Read a line range of a file with line numbers (max 400 lines per call).',
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, start: { type: 'integer', minimum: 1, default: 1 }, end: { type: 'integer', minimum: 1 } }, required: ['path'] },
      handler: async ({ path: p, start = 1, end }) => {
        const abs = resolve(p);
        const lines = readText(abs).split('\n');
        const s = Math.max(1, start);
        const e = Math.min(lines.length, end || s + 199, s + 399);
        return `${rel(abs)}:${s}-${e} of ${lines.length}\n` + lines.slice(s - 1, e).map((l, i) => `${s + i}\t${l}`).join('\n');
      },
    },
    {
      name: 'search',
      description: 'Find text in the project. Returns compact "file:line: text" hits (uses ripgrep when installed).',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          path: { type: 'string', default: '.' },
          glob: { type: 'string', description: 'e.g. "*.ts" or "src/**/*.py"' },
          regex: { type: 'boolean', default: false },
          ignore_case: { type: 'boolean', default: true },
          max_results: { type: 'integer', minimum: 1, maximum: 200, default: 40 },
        },
        required: ['pattern'],
      },
      handler: async (args) => search(args),
    },
    {
      name: 'git_brief',
      description: 'Compact git state: branch, changed files, diff stats and the last commits. Cheaper than reading diffs.',
      inputSchema: { type: 'object', properties: { commits: { type: 'integer', minimum: 0, maximum: 30, default: 5 } } },
      handler: async ({ commits = 5 }) => {
        const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
        if (branch === null) return 'not a git repository (or git is not installed)';
        return [
          `branch: ${branch}`,
          `status:\n${git(['status', '--short']) || '(clean)'}`,
          `diff stat:\n${git(['diff', '--stat', 'HEAD']) || '(no changes)'}`,
          commits ? `recent commits:\n${git(['log', '--oneline', `-${commits}`]) || '(none)'}` : '',
        ].filter(Boolean).join('\n\n');
      },
    },
    {
      name: 'token_report',
      description: 'Estimate the tokens of reading a file whole vs reading its outline, to show the saving.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      handler: async ({ path: p }) => {
        const abs = resolve(p);
        const src = readText(abs);
        const full = tokens(src);
        const o = outlineOf(abs, src);
        if (!o) return { file: rel(abs), full_tokens: full, note: 'no outline for this file type' };
        const ol = tokens(formatOutline(rel(abs), o));
        const top = o.symbols.filter((s) => s.indent === 0);
        const big = (top.length ? top : o.symbols).reduce((m, s) => (!m || s.end - s.line > m.end - m.line ? s : m), null);
        const oneSymbol = big ? tokens(src.split('\n').slice(big.line - 1, big.end).join('\n')) : 0;
        return {
          file: rel(abs),
          full_tokens: full,
          outline_tokens: ol,
          outline_plus_largest_top_level_symbol_tokens: ol + oneSymbol,
          saving_with_outline_only: `${Math.max(0, Math.round((1 - ol / full) * 100))}%`,
          saving_outline_plus_one_symbol: `${Math.max(0, Math.round((1 - (ol + oneSymbol) / full) * 100))}%`,
          method: 'estimate: about 4 characters per token',
        };
      },
    },
  ],
});
