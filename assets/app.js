/* MCP King website. No framework, no build step. Data: data/catalog.js, data/library.js, and the official MCP Registry API. */
(() => {
  'use strict';

  const CATALOG = window.CATALOG || [];
  const LIBRARY = window.LIBRARY || { rules: [], skills: [] };
  const REGISTRY = 'https://registry.modelcontextprotocol.io/v0/servers';
  const REPO = 'https://github.com/Tharunmaks/MCP-king-';

  const CLIENTS = [
    { id: 'claude-code', label: 'Claude Code', local: true },
    { id: 'claude-desktop', label: 'Claude Desktop', local: true, desktopOnly: true },
    { id: 'claude-app', label: 'Claude app / claude.ai', local: false },
    { id: 'chatgpt', label: 'ChatGPT', local: false },
    { id: 'gemini-cli', label: 'Gemini CLI', local: true },
    { id: 'cursor', label: 'Cursor', local: true, desktopOnly: true },
    { id: 'vscode', label: 'VS Code + Copilot', local: true, desktopOnly: true },
    { id: 'windsurf', label: 'Windsurf', local: true, desktopOnly: true },
    { id: 'codex', label: 'Codex CLI', local: true },
    { id: 'cline', label: 'Cline / Roo Code', local: true, desktopOnly: true },
    { id: 'other', label: 'Grok, Kimi or another app', local: true },
  ];
  const DEVICES = [
    { id: 'windows', label: 'Windows PC' },
    { id: 'macos', label: 'Mac' },
    { id: 'linux', label: 'Linux' },
    { id: 'android', label: 'Android phone' },
    { id: 'ios', label: 'iPhone / iPad' },
  ];
  const HOMES = { windows: 'C:/Users/YOU', macos: '/Users/YOU', linux: '/home/YOU', android: '/data/data/com.termux/files/home', ios: '/Users/YOU' };

  // ------------------------------------------------------------------ helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, attrs = {}, ...kids) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return node;
  };
  const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : null; } catch { return null; } };

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }
  async function copy(text, what = 'Copied') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = el('textarea', { style: 'position:fixed;opacity:0;top:0;left:0' });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
    }
    toast(`${what} ✓`);
  }
  function download(name, text) {
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/markdown' })), download: name });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // ------------------------------------------------------------------ state
  const state = {
    client: store.get('mk-client', 'claude-code'),
    device: store.get('mk-device', guessDevice()),
    cat: 'All',
    q: '',
    phone: false,
    nokey: false,
  };
  if (!CLIENTS.some((c) => c.id === state.client)) state.client = 'claude-code';
  if (!DEVICES.some((d) => d.id === state.device)) state.device = 'linux';
  function guessDevice() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    if (/Windows/.test(ua)) return 'windows';
    if (/Mac/.test(ua)) return 'macos';
    return 'linux';
  }
  const client = () => CLIENTS.find((c) => c.id === state.client);

  // ------------------------------------------------------------------ config generation
  const envEntries = (s) => Object.entries((s.stdio && s.stdio.env) || {});
  const needsKey = (s) => {
    const remoteOk = s.remote && s.remote.auth !== 'key';
    const stdioOk = s.stdio && envEntries(s).length === 0;
    return !(remoteOk || stdioOk);
  };
  const slug = (s) => String(s.id || s.name).toLowerCase().replace(/^.*\//, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'server';
  const isSse = (url) => /\/sse\/?(\?|$)/.test(url);

  function stdioSpec(s, device) {
    if (!s.stdio) return null;
    let cmd = s.stdio.cmd;
    let args = s.stdio.args.map((a) => a.replaceAll('{HOME}', HOMES[device]));
    if (device === 'windows') {
      if (cmd === 'python3') cmd = 'python';
      args = args.map((a) => (a.startsWith('C:/') ? a.replaceAll('/', '\\') : a));
      if (cmd === 'npx') { args = ['/c', 'npx', ...args]; cmd = 'cmd'; }
    }
    // keep example values (URLs, hosts, modes); turn descriptions of secrets into <placeholders>
    const keep = (k, v) => /^[\w.:/@+-]+$/.test(v) && !/key|token|secret|password/i.test(k);
    const env = Object.fromEntries(envEntries(s).map(([k, v]) => [k, keep(k, v) ? v : `<${v}>`]));
    return { cmd, args, env };
  }
  function shq(a) {
    return /^[\w@%+=:,./\\~$-]+$/.test(a) ? a : `"${a.replace(/(["\\$`])/g, '\\$1')}"`;
  }
  const shellArgs = (s, device) => s.stdio.args.map((a) => a.replaceAll('{HOME}', device === 'windows' ? '$HOME' : '~'));

  function jsonServers(key, name, body) {
    return JSON.stringify({ [key]: { [name]: body } }, null, 2);
  }
  const stdioJson = (spec, extra = {}) => ({ ...extra, command: spec.cmd, args: spec.args, ...(Object.keys(spec.env).length ? { env: spec.env } : {}) });
  const tomlStr = (v) => JSON.stringify(v);

  const CONFIG_FILES = {
    'claude-desktop': { windows: '%APPDATA%\\Claude\\claude_desktop_config.json', macos: '~/Library/Application Support/Claude/claude_desktop_config.json', linux: '~/.config/Claude/claude_desktop_config.json' },
    'gemini-cli': '~/.gemini/settings.json (all projects) or .gemini/settings.json (this project)',
    cursor: '~/.cursor/mcp.json (all projects) or .cursor/mcp.json (this project)',
    vscode: '.vscode/mcp.json in your project (or run "MCP: Add Server" from the Command Palette)',
    windsurf: '~/.codeium/windsurf/mcp_config.json',
    codex: '~/.codex/config.toml',
    cline: 'Cline → MCP Servers → Configure → cline_mcp_settings.json',
    other: "the app's MCP settings (often mcp.json or settings.json)",
  };

  /** Returns { mode: 'local'|'remote'|'none', blocks: [{label, code}], notes: [], ok: bool } */
  function setupFor(s, clientId = state.client, device = state.device) {
    const c = CLIENTS.find((x) => x.id === clientId);
    const name = slug(s);
    const notes = [];
    const blocks = [];
    const phoneOnly = !c.local || device === 'ios';
    const preferRemote = phoneOnly || !s.stdio;
    const remoteUrl = s.remote && s.remote.url;

    if (device === 'ios' && c.local) notes.push(`${c.label} does not run on iPhone/iPad. On iOS use the Claude app or ChatGPT with a server that has a URL.`);
    if (device === 'android' && c.desktopOnly) notes.push(`${c.label} is not available on Android. On Android install Termux and use Claude Code, Gemini CLI or Codex inside it, or use the Claude/ChatGPT apps with URL servers.`);

    if (preferRemote && remoteUrl) {
      const url = remoteUrl;
      const sse = isSse(url);
      switch (clientId) {
        case 'claude-code':
          blocks.push({ label: 'Run in your terminal', code: `claude mcp add --scope user --transport ${sse ? 'sse' : 'http'} ${name} ${shq(url)}` });
          if (s.remote.auth === 'oauth') notes.push('Then type /mcp inside Claude Code and choose the server to log in.');
          break;
        case 'claude-desktop':
        case 'claude-app':
          blocks.push({ label: 'Connector URL', code: url });
          notes.push('Open claude.ai (or the desktop app) → Settings → Connectors → Add custom connector, paste the URL and save. Connectors you add on claude.ai also appear in the Claude iPhone and Android apps.');
          if (s.remote.auth === 'oauth') notes.push('You will be asked to sign in to the service the first time.');
          break;
        case 'chatgpt':
          blocks.push({ label: 'Connector URL', code: url });
          notes.push('On chatgpt.com: Settings → Apps & Connectors → Advanced settings → turn on Developer mode, then Create a connector with this URL. Availability depends on your ChatGPT plan.');
          break;
        case 'gemini-cli':
          blocks.push({ label: `Add to ${CONFIG_FILES['gemini-cli']}`, code: jsonServers('mcpServers', name, sse ? { url } : { httpUrl: url }) });
          break;
        case 'cursor':
          blocks.push({ label: `Add to ${CONFIG_FILES.cursor}`, code: jsonServers('mcpServers', name, { url }) });
          break;
        case 'vscode':
          blocks.push({ label: `Add to ${CONFIG_FILES.vscode}`, code: jsonServers('servers', name, { type: sse ? 'sse' : 'http', url }) });
          break;
        case 'windsurf':
          blocks.push({ label: `Add to ${CONFIG_FILES.windsurf}`, code: jsonServers('mcpServers', name, { serverUrl: url }) });
          break;
        case 'codex':
          blocks.push({ label: `Add to ${CONFIG_FILES.codex}`, code: `[mcp_servers.${name}]\ncommand = "npx"\nargs = ["-y", "mcp-remote", ${tomlStr(url)}]` });
          notes.push('mcp-remote bridges a URL server to apps that only run local commands (needs Node.js).');
          break;
        default:
          blocks.push({ label: `Add to ${CONFIG_FILES[clientId] || CONFIG_FILES.other}`, code: jsonServers('mcpServers', name, { command: 'npx', args: ['-y', 'mcp-remote', url] }) });
          notes.push('mcp-remote bridges a URL server to apps that only run local commands (needs Node.js). If your app accepts URLs directly, use the URL instead.');
          if (clientId === 'other') notes.push('Grok and Kimi: pick the Grok or Kimi model inside an MCP-capable app (Cursor, Cline, Kimi CLI, OpenCode, LM Studio, Cherry Studio…) and add the server there.');
      }
      if (s.remote.auth === 'key') notes.push('Replace YOUR_KEY in the URL with your own API key, and keep that URL private.');
      return { mode: 'remote', blocks, notes, ok: !(device === 'ios' && c.local) };
    }

    if (!s.stdio) {
      if (s.note) notes.push(s.note);
      return { mode: 'none', blocks, notes, ok: true };
    }

    if (phoneOnly) {
      notes.push(`${s.name} runs as a local program, so a phone app cannot start it by itself. Run it on your computer (or Android Termux) and share it as a URL:`);
      if (s.phone) {
        blocks.push({ label: 'On your PC: start it with a public https link (built in)', code: s.phone });
        notes.push('It prints a https://…/s/<secret>/mcp link. Add that link as a custom connector. Keep it private: the secret is the password.');
      } else if (s.own) {
        blocks.push({ label: 'On your PC: start it in HTTP mode', code: `${s.stdio.cmd} ${shellArgs(s, 'linux').join(' ')} --http 8787` });
        blocks.push({ label: 'In a second terminal: get a free https link', code: 'cloudflared tunnel --url http://127.0.0.1:8787' });
        notes.push('Use https://<cloudflare-address>/s/<secret>/mcp (the secret is printed by the first command) as the connector URL.');
      } else {
        const cmd = [s.stdio.cmd, ...shellArgs(s, 'linux')].map(shq).join(' ');
        blocks.push({ label: 'On your PC: wrap it as an HTTP server', code: `npx -y supergateway --stdio ${shq(cmd)} --outputTransport streamableHttp --port 8000` });
        blocks.push({ label: 'In a second terminal: get a free https link', code: 'cloudflared tunnel --url http://localhost:8000' });
        notes.push('Use https://<cloudflare-address>/mcp as the connector URL. Warning: anyone who has that link can use the server, so stop it when you are done and never do this for servers that hold private data.');
      }
      if (s.setup) blocks.unshift({ label: 'First, once', code: s.setup });
      return { mode: 'local', blocks, notes, ok: false };
    }

    const spec = stdioSpec(s, device);
    if (s.setup) blocks.push({ label: 'First, once', code: device === 'windows' ? s.setup.replaceAll('~/', '$HOME/').replaceAll(' ~', ' $HOME') : s.setup });
    switch (clientId) {
      case 'claude-code': {
        const env = Object.entries(spec.env).map(([k, v]) => `-e ${k}=${shq(v)} `).join('');
        let args = shellArgs(s, device);
        let cmd = s.stdio.cmd;
        if (device === 'windows' && cmd === 'npx') { args = ['/c', 'npx', ...args]; cmd = 'cmd'; }
        if (device === 'windows' && cmd === 'python3') cmd = 'python';
        blocks.push({ label: 'Run in your terminal', code: `claude mcp add --scope user ${env}${name} -- ${[cmd, ...args].map(shq).join(' ')}` });
        notes.push('--scope user makes it available in every project. Check it with: claude mcp list');
        break;
      }
      case 'claude-desktop': {
        const file = CONFIG_FILES['claude-desktop'][device] || CONFIG_FILES['claude-desktop'].macos;
        blocks.push({ label: `Add to ${file}`, code: jsonServers('mcpServers', name, stdioJson(spec)) });
        notes.push('Open it from Settings → Developer → Edit Config, merge this entry into "mcpServers", save, then fully quit and reopen Claude.');
        break;
      }
      case 'vscode':
        blocks.push({ label: `Add to ${CONFIG_FILES.vscode}`, code: jsonServers('servers', name, stdioJson(spec, { type: 'stdio' })) });
        break;
      case 'codex': {
        const env = Object.keys(spec.env).length ? `\nenv = { ${Object.entries(spec.env).map(([k, v]) => `${k} = ${tomlStr(v)}`).join(', ')} }` : '';
        blocks.push({ label: `Add to ${CONFIG_FILES.codex}`, code: `[mcp_servers.${name}]\ncommand = ${tomlStr(spec.cmd)}\nargs = [${spec.args.map(tomlStr).join(', ')}]${env}` });
        break;
      }
      default:
        blocks.push({ label: `Add to ${CONFIG_FILES[clientId] || CONFIG_FILES.other}`, code: jsonServers('mcpServers', name, stdioJson(spec)) });
        if (clientId === 'other') notes.push('This "mcpServers" JSON is the common format. Grok and Kimi: choose the Grok or Kimi model inside an MCP-capable app (Cursor, Cline, Kimi CLI, OpenCode, LM Studio, Cherry Studio…) and paste it there.');
    }
    if (/YOU/.test(JSON.stringify(spec.args)) && clientId !== 'claude-code') notes.push('Replace YOU with your user name.');
    if (Object.keys(spec.env).length) notes.push('Replace the <…> values with your own keys. Never share them or commit them to git.');
    if (device === 'android') {
      const need = { npx: 'pkg install nodejs', node: 'pkg install nodejs', uvx: 'pkg install python && pip install uv', python3: 'pkg install python', docker: null };
      if (need[s.stdio.cmd] === null) notes.push('Docker does not run in Termux; use this server from a PC, or its URL version if it has one.');
      else if (need[s.stdio.cmd]) notes.push(`In Termux, install the runtime first: ${need[s.stdio.cmd]}`);
    }
    if (s.stdio.cmd === 'uvx' && device !== 'android') notes.push('Needs uv: https://docs.astral.sh/uv/ (one-line install).');
    if (s.stdio.cmd === 'docker') notes.push('Needs Docker Desktop (or Docker Engine) running.');
    if (s.note) notes.push(s.note);
    return { mode: 'local', blocks, notes, ok: !(device === 'ios') && !(device === 'android' && c.desktopOnly) };
  }

  function primaryCopy(s) {
    const r = setupFor(s);
    if (!r.blocks.length) return null;
    return r.blocks.map((b) => (r.blocks.length > 1 ? `# ${b.label}\n${b.code}` : b.code)).join('\n\n');
  }

  function aiPrompt(s, clientId = state.client, device = state.device) {
    const r = setupFor(s, clientId, device);
    const how = r.blocks.map((b) => `${b.label}:\n${b.code}`).join('\n\n');
    const agent = ['claude-code', 'codex', 'gemini-cli'].includes(clientId);
    return agent
      ? `Install the "${s.name}" MCP server for me and confirm it is connected.\n\n${how}\n\nProject page: ${s.repo || ''}\nAfter it is connected, use its tools whenever they help with my tasks.`
      : `I'm adding the "${s.name}" MCP server (${s.repo || ''}). Once it's connected, use its tools whenever they help with my tasks.`;
  }

  // ------------------------------------------------------------------ cards
  function badges(s) {
    const b = [];
    if (s.remote) b.push(el('span', { class: 'badge phone', title: 'Has a URL: works in phone apps' }, 'Phone ready'));
    else if (s.own) b.push(el('span', { class: 'badge phone', title: 'Run on your PC, use from your phone via a link' }, 'Phone via PC'));
    if (s.stdio) b.push(el('span', { class: 'badge', title: 'Runs on your computer' }, 'Local'));
    if (needsKey(s)) b.push(el('span', { class: 'badge key', title: 'Needs an API key or account' }, 'Key needed'));
    if ((s.tags || []).includes('token-saver')) b.push(el('span', { class: 'badge tok' }, 'Saves tokens'));
    if (s.registry) b.push(el('span', { class: 'badge', title: 'From the official MCP Registry, not reviewed here' }, 'Registry'));
    return b;
  }

  function card(s) {
    const actions = [];
    const setupText = primaryCopy(s);
    if (setupText) actions.push(el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => copy(setupText, `${s.name} setup copied`) }, 'Copy setup'));
    actions.push(el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => openDetails(s) }, 'Details'));
    const repo = safeUrl(s.repo);
    if (repo) actions.push(el('a', { class: 'btn btn-ghost btn-sm', href: repo, target: '_blank', rel: 'noopener' }, 'Project ↗'));
    return el('article', { class: `card${s.own ? ' own' : ''}` },
      el('div', { class: 'card-top' },
        el('div', {}, el('h3', { text: s.name }), el('p', { class: 'by', text: s.by || '' })),
        s.cat ? el('span', { class: 'badge cat', text: s.cat }) : null),
      el('p', { class: 'desc', text: s.desc || 'No description.' }),
      el('div', { class: 'badges' }, badges(s)),
      el('div', { class: 'card-actions' }, actions));
  }

  // ------------------------------------------------------------------ details dialog
  function codeBlock(label, code) {
    return el('div', {},
      el('h3', { text: label }),
      el('div', { class: 'code-block' },
        el('pre', { class: 'code', text: code }),
        el('button', { class: 'btn btn-ghost btn-sm copy', type: 'button', onclick: () => copy(code) }, 'Copy')));
  }
  function openDetails(s) {
    const dlg = $('#details');
    $('#d-title').textContent = s.name;
    $('#d-by').textContent = [s.by, s.cat].filter(Boolean).join(' · ');
    const body = $('#d-body');
    body.replaceChildren();
    body.append(el('p', { text: s.desc || '' }));
    if (s.registry) body.append(el('p', { class: 'notice', text: 'Published to the official MCP Registry by its author and not reviewed by MCP King. Check the project page and only give it the access it needs.' }));

    const picker = el('select', { 'aria-label': 'Show setup for app' }, CLIENTS.map((c) => el('option', { value: c.id, selected: c.id === state.client }, c.label)));
    const devPicker = el('select', { 'aria-label': 'Show setup for device' }, DEVICES.map((d) => el('option', { value: d.id, selected: d.id === state.device }, d.label)));
    const out = el('div');
    const render = () => {
      const r = setupFor(s, picker.value, devPicker.value);
      out.replaceChildren();
      if (!r.blocks.length && !r.notes.length) out.append(el('p', { class: 'notice', text: 'See the project page for setup steps.' }));
      for (const b of r.blocks) out.append(codeBlock(b.label, b.code));
      for (const n of r.notes) out.append(el('p', { class: `notice${r.ok ? ' ok' : ''}`, text: n }));
      if (s.stdio && s.remote) {
        out.append(el('p', { class: 'fine', text: r.mode === 'remote' ? 'This server can also run locally on a computer (pick a desktop app above).' : 'This server also has a URL version for phone apps (pick Claude app or ChatGPT above).' }));
      }
    };
    picker.addEventListener('change', render);
    devPicker.addEventListener('change', render);
    body.append(el('div', { class: 'setup', style: 'margin-top:.5rem' }, el('label', {}, 'App', picker), el('label', {}, 'Device', devPicker)));
    body.append(out);
    render();
    body.append(el('h3', { text: 'Tell your AI' }));
    body.append(el('p', { class: 'fine', text: 'Paste this into Claude Code, Codex or Gemini CLI and it will install the server itself.' }));
    body.append(el('div', { class: 'card-actions' },
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => copy(aiPrompt(s, picker.value, devPicker.value), 'AI prompt copied') }, 'Copy AI prompt'),
      safeUrl(s.repo) ? el('a', { class: 'btn btn-ghost', href: safeUrl(s.repo), target: '_blank', rel: 'noopener' }, 'Project page ↗') : null));
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }
  $('#d-close').addEventListener('click', () => $('#details').close());
  $('#details').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  // ------------------------------------------------------------------ setup bar
  function fillSetup() {
    const cs = $('#client');
    const ds = $('#device');
    cs.replaceChildren(...CLIENTS.map((c) => el('option', { value: c.id, selected: c.id === state.client }, c.label)));
    ds.replaceChildren(...DEVICES.map((d) => el('option', { value: d.id, selected: d.id === state.device }, d.label)));
    const onChange = () => {
      state.client = cs.value;
      state.device = ds.value;
      store.set('mk-client', state.client);
      store.set('mk-device', state.device);
      updateSetupNote();
      renderAll();
    };
    cs.addEventListener('change', onChange);
    ds.addEventListener('change', onChange);
    updateSetupNote();
  }
  function updateSetupNote() {
    const c = client();
    const d = state.device;
    let note = '';
    if (d === 'ios' && c.local) note = `${c.label} doesn't run on iPhone. Pick "Claude app" or "ChatGPT" to see servers you can add by URL.`;
    else if (d === 'android' && c.desktopOnly) note = `${c.label} isn't on Android. Use Termux with Claude Code, Gemini CLI or Codex, or the Claude/ChatGPT apps.`;
    else if (!c.local) note = 'Phone and web apps connect to servers by URL. Turn on "Works in phone apps" below to see only those.';
    else if (d === 'android') note = 'Android: install Termux (from F-Droid), then pkg install nodejs python git, then npm i -g @anthropic-ai/claude-code (or Gemini CLI).';
    else note = `Commands below are written for ${c.label} on ${DEVICES.find((x) => x.id === d).label}.`;
    $('#setup-note').textContent = note;
    const lean = CATALOG.find((s) => s.id === 'lean');
    if (lean) $('#lean-cmd').textContent = primaryCopy(lean) || '';
  }

  // ------------------------------------------------------------------ directory
  const CATS = ['All', ...new Set(CATALOG.map((s) => s.cat))];
  function renderCats() {
    $('#cats').replaceChildren(...CATS.map((c) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(c === state.cat),
      onclick: () => { state.cat = c; renderCats(); renderGrid(); },
    }, c)));
  }
  function matches(s) {
    if (state.cat !== 'All' && s.cat !== state.cat) return false;
    if (state.phone && !s.remote) return false;
    if (state.nokey && needsKey(s)) return false;
    if (!state.q) return true;
    const hay = `${s.name} ${s.by} ${s.cat} ${s.desc} ${(s.tags || []).join(' ')} ${s.id}`.toLowerCase();
    return state.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w) || (w === 'token' && hay.includes('token-saver')));
  }
  function renderGrid() {
    const list = CATALOG.filter(matches);
    $('#grid').replaceChildren(...list.map(card));
    $('#count').textContent = list.length
      ? `${list.length} of ${CATALOG.length} servers`
      : `No servers match. Try the live registry below, which has thousands more.`;
  }
  function renderFeatured() {
    $('#featured-grid').replaceChildren(...CATALOG.filter((s) => s.own).map(card));
  }
  function renderAll() {
    renderFeatured();
    renderGrid();
    renderRegistry();
  }

  let qTimer;
  $('#q').addEventListener('input', (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = e.target.value.trim(); renderGrid(); }, 120); });
  $('#f-phone').addEventListener('change', (e) => { state.phone = e.target.checked; renderGrid(); });
  $('#f-nokey').addEventListener('change', (e) => { state.nokey = e.target.checked; renderGrid(); });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-filter-tag]');
    if (t) { state.q = 'token'; $('#q').value = 'token'; state.cat = 'All'; renderCats(); renderGrid(); }
  });

  // ------------------------------------------------------------------ live registry
  const reg = { items: [], cursor: null, q: '', loading: false, started: false, error: null };
  function fromRegistry(entry) {
    const sv = entry.server || entry;
    const s = { registry: true, id: sv.name, name: sv.title || sv.name.split('/').pop(), by: sv.name, desc: sv.description, repo: (sv.repository && sv.repository.url) || sv.websiteUrl, cat: '' };
    const remote = (sv.remotes || []).find((r) => safeUrl(r.url));
    if (remote) {
      const headers = remote.headers || [];
      s.remote = { url: remote.url, auth: headers.some((h) => h.isRequired || h.isSecret) || /\{[^}]+\}/.test(remote.url) ? 'key' : 'none' };
    }
    const pkg = (sv.packages || []).find((p) => ['npm', 'pypi', 'oci'].includes(p.registryType) && (!p.transport || p.transport.type === 'stdio'));
    if (pkg) {
      const id = pkg.identifier;
      const extra = [];
      for (const a of pkg.packageArguments || []) {
        const v = a.value || a.default || (a.valueHint ? `<${a.valueHint}>` : null);
        if (a.type === 'named' && a.name) extra.push(a.name, ...(v && v !== 'true' ? [v] : []));
        else if (v) extra.push(v);
      }
      const env = Object.fromEntries((pkg.environmentVariables || []).filter((e) => e.isRequired || e.isSecret).map((e) => [e.name, (e.description || e.name).slice(0, 60)]));
      if (pkg.registryType === 'npm') s.stdio = { cmd: 'npx', args: ['-y', id, ...extra], env };
      else if (pkg.registryType === 'pypi') s.stdio = { cmd: 'uvx', args: [id, ...extra], env };
      else s.stdio = { cmd: 'docker', args: ['run', '-i', '--rm', ...Object.keys(env).flatMap((k) => ['-e', k]), id, ...extra], env };
    }
    return s;
  }
  async function loadRegistry(more = false) {
    if (reg.loading) return;
    reg.loading = true;
    reg.error = null;
    if (!more) { reg.items = []; reg.cursor = null; }
    renderRegistry(true);
    const params = new URLSearchParams({ limit: '24', version: 'latest' });
    if (reg.q) params.set('search', reg.q);
    if (more && reg.cursor) params.set('cursor', reg.cursor);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(`${REGISTRY}?${params}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`registry answered ${res.status}`);
      const data = await res.json();
      const seen = new Set(reg.items.map((s) => s.id));
      for (const entry of data.servers || []) {
        const s = fromRegistry(entry);
        if (!seen.has(s.id)) { seen.add(s.id); reg.items.push(s); }
      }
      reg.cursor = (data.metadata && data.metadata.nextCursor) || null;
    } catch (e) {
      reg.error = e.name === 'AbortError' ? 'The registry took too long to answer.' : `Could not reach the registry (${e.message}).`;
    }
    reg.loading = false;
    renderRegistry();
  }
  function renderRegistry(loading = false) {
    if (!reg.started) return;
    const grid = $('#reg-grid');
    const cards = reg.items.map(card);
    if (loading) for (let i = 0; i < 3; i++) cards.push(el('div', { class: 'skeleton', 'aria-hidden': 'true' }));
    grid.replaceChildren(...cards);
    $('#reg-more').hidden = loading || !reg.cursor;
    $('#reg-count').textContent = reg.error
      ? `${reg.error} Check your connection and try again, or use the directories below.`
      : loading ? 'Loading from the official MCP Registry…'
      : reg.items.length ? `Showing ${reg.items.length} servers${reg.q ? ` for "${reg.q}"` : ''}${reg.cursor ? ' (more available)' : ''}.`
      : `Nothing found${reg.q ? ` for "${reg.q}"` : ''}.`;
  }
  $('#reg-form').addEventListener('submit', (e) => { e.preventDefault(); reg.q = $('#reg-q').value.trim(); reg.started = true; loadRegistry(); });
  $('#reg-more').addEventListener('click', () => loadRegistry(true));
  const startRegistry = () => { if (!reg.started) { reg.started = true; loadRegistry(); } };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => { if (entries.some((x) => x.isIntersecting)) { startRegistry(); io.disconnect(); } }, { rootMargin: '400px' });
    io.observe($('#registry'));
  } else startRegistry();

  // ------------------------------------------------------------------ library
  function libCard(title, sub, body, filename, extra) {
    return el('article', { class: 'card' },
      el('h3', { text: title }),
      sub ? el('p', { class: 'by', text: sub }) : null,
      extra ? el('p', { class: 'desc', text: extra }) : null,
      el('div', { class: 'card-actions' },
        el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => copy(body, `${filename} copied`) }, 'Copy'),
        el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => download(filename, body) }, 'Download'),
        el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => viewText(title, sub, body) }, 'View')));
  }
  function viewText(title, sub, body) {
    $('#d-title').textContent = title;
    $('#d-by').textContent = sub || '';
    $('#d-body').replaceChildren(codeBlock('Contents', body));
    $('#details').showModal();
  }
  function renderLibrary() {
    $('#panel-rules').replaceChildren(...LIBRARY.rules.map((r) => libCard(r.title, `Save as: ${r.save}`, r.body, r.file, `For: ${r.ai}`)));
    $('#skills-grid').replaceChildren(...LIBRARY.skills.map((s) => libCard(s.name, `~/.claude/skills/${s.name}/SKILL.md`, s.body, 'SKILL.md', s.desc)));
    $('#stat-rules').textContent = LIBRARY.rules.length;
    $('#stat-skills').textContent = LIBRARY.skills.length;
  }
  function setupTabs(list) {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const select = (tab) => {
      for (const t of tabs) {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      }
    };
    list.addEventListener('click', (e) => { const t = e.target.closest('[role="tab"]'); if (t) select(t); });
    list.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0 || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      select(next);
    });
  }
  document.addEventListener('click', (e) => {
    const r = e.target.closest('[data-copy-rule]');
    if (r) { const rule = LIBRARY.rules.find((x) => x.file === r.dataset.copyRule); if (rule) copy(rule.body, `${rule.file} copied`); }
    const f = e.target.closest('[data-copy-from]');
    if (f) copy(document.getElementById(f.dataset.copyFrom).textContent);
  });

  // ------------------------------------------------------------------ device guide
  const GUIDES = {
    ios: `<h3>iPhone and iPad</h3>
<p>iOS apps cannot start programs, so on iPhone you use <strong>servers that have a URL</strong> (marked "Phone ready").</p>
<ol>
<li><strong>Claude app:</strong> on claude.ai (any browser) open Settings → Connectors → <em>Add custom connector</em>, paste the server URL. It then appears in the Claude iPhone app under the tools (sliders) menu in a chat.</li>
<li><strong>ChatGPT:</strong> on chatgpt.com open Settings → Apps &amp; Connectors → Advanced → Developer mode, then create a connector with the URL.</li>
<li><strong>Local-only servers</strong> (like Lean Context or Expert Craft): run them on your computer in HTTP mode and connect your phone to the link they print. Each card's Details shows the exact commands when you pick "Claude app".</li>
<li>Rules and skills: paste a rules file into a Claude Project's instructions, or upload a skill as a .zip in Settings → Capabilities → Skills.</li>
</ol>`,
    android: `<h3>Android</h3>
<p>Android can do everything: URL servers in the Claude and ChatGPT apps, <strong>and</strong> local servers through Termux.</p>
<ol>
<li>Install <a href="https://f-droid.org/packages/com.termux/" rel="noopener">Termux from F-Droid</a> (the Play Store version is outdated).</li>
<li>In Termux: <code>pkg update &amp;&amp; pkg install nodejs python git</code></li>
<li>Install an AI coder: <code>npm i -g @anthropic-ai/claude-code</code> (Claude Code) or <code>npm i -g @google/gemini-cli</code> (Gemini CLI).</li>
<li>Get this project's servers: <code>git clone https://github.com/Tharunmaks/MCP-king- ~/MCP-king-</code></li>
<li>Pick "Claude Code" + "Android phone" at the top of this page: every card now shows Termux-ready commands.</li>
</ol>
<p class="fine">Servers that need Docker don't run in Termux; use their URL version or a PC.</p>`,
    windows: `<h3>Windows</h3>
<ol>
<li>Install <a href="https://nodejs.org" rel="noopener">Node.js LTS</a> (gives you <code>npx</code>) and, for Python servers, <a href="https://docs.astral.sh/uv/" rel="noopener">uv</a> (gives you <code>uvx</code>). Optional: Git and Docker Desktop.</li>
<li>Claude Code: <code>npm i -g @anthropic-ai/claude-code</code>, then use the commands from the cards in PowerShell.</li>
<li>Claude Desktop, Cursor, VS Code, Windsurf: paste the JSON from a card into the file it names. Windows needs <code>cmd /c npx</code> instead of plain <code>npx</code>; the generated configs already do this.</li>
<li>Paths in JSON: replace <code>YOU</code> with your Windows user name.</li>
</ol>`,
    macos: `<h3>Mac</h3>
<ol>
<li>Install Node.js (<code>brew install node</code>) and uv (<code>brew install uv</code>) for Python servers.</li>
<li>Claude Code: <code>npm i -g @anthropic-ai/claude-code</code>, then run the commands from the cards.</li>
<li>Claude Desktop: Settings → Developer → Edit Config, paste the JSON from a card, then quit and reopen Claude.</li>
<li>iOS developers: add XcodeBuildMCP, iOS Simulator and Mobile MCP from the Mobile dev category.</li>
</ol>`,
    linux: `<h3>Linux</h3>
<ol>
<li>Install Node.js 18+ and uv (<code>curl -LsSf https://astral.sh/uv/install.sh | sh</code>).</li>
<li>Claude Code: <code>npm i -g @anthropic-ai/claude-code</code>; Gemini CLI: <code>npm i -g @google/gemini-cli</code>; Codex: <code>npm i -g @openai/codex</code>.</li>
<li>Run the commands from the cards. Check connected servers with <code>claude mcp list</code> or <code>/mcp</code>.</li>
<li>Claude Desktop has no official Linux build; use Claude Code, Cursor, VS Code or Gemini CLI.</li>
</ol>`,
  };
  function renderDevices() {
    const tabs = $('#device-tabs');
    const order = ['ios', 'android', 'windows', 'macos', 'linux'];
    const current = order.includes(state.device) ? state.device : 'windows';
    tabs.replaceChildren(...order.map((id) => el('button', {
      role: 'tab', type: 'button', id: `dev-${id}`, 'aria-selected': String(id === current), 'aria-controls': 'device-panel', tabindex: id === current ? '0' : '-1',
      onclick: (e) => { for (const t of tabs.children) { const on = t === e.currentTarget; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; } $('#device-panel').innerHTML = GUIDES[id]; },
    }, DEVICES.find((d) => d.id === id).label)));
    $('#device-panel').innerHTML = GUIDES[current];
    tabs.addEventListener('keydown', (e) => {
      const list = [...tabs.children];
      const i = list.indexOf(document.activeElement);
      if (i < 0 || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const next = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
      next.focus();
      next.click();
    });
  }

  // ------------------------------------------------------------------ chrome
  $('#theme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('mk-theme', next);
  });
  const menuBtn = $('#menu-btn');
  menuBtn.addEventListener('click', () => {
    const open = $('#menu').classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  $('#menu').addEventListener('click', (e) => { if (e.target.closest('a')) { $('#menu').classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); } });

  // ------------------------------------------------------------------ start
  $('#stat-curated').textContent = CATALOG.length;
  fillSetup();
  renderCats();
  renderAll();
  renderLibrary();
  setupTabs($('.tabs[aria-label="Library"]'));
  renderDevices();
  window.MCPKING = { setupFor, CATALOG, CLIENTS, DEVICES, fromRegistry, REPO };
})();
