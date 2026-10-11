// Minimal Model Context Protocol server runtime (no dependencies, Node 18+).
// Transports: stdio (newline-delimited JSON-RPC) and streamable HTTP (POST JSON-RPC, JSON reply).
//
//   serve({ name, version, instructions, tools })
//   tools: [{ name, description, inputSchema, handler: async (args) => string | object }]
//
// Command-line flags understood by every MCP King server:
//   --http PORT        serve MCP over HTTP at http://HOST:PORT/s/<secret>/mcp (secret printed on start)
//   --host ADDR        bind address for --http (default 127.0.0.1; use 0.0.0.0 to reach it from your phone on Wi-Fi)
//   --secret TEXT      fixed secret instead of a random one (or MCP_SECRET env)
import http from 'node:http';
import crypto from 'node:crypto';
import readline from 'node:readline';

const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

export function flag(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

export function text(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function makeHandler({ name, version, instructions, tools }) {
  const byName = new Map(tools.map((t) => [t.name, t]));
  return async function handle(msg) {
    const { id, method, params = {} } = msg || {};
    const reply = (result) => ({ jsonrpc: '2.0', id, result });
    const fail = (code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
    if (!msg || msg.jsonrpc !== '2.0' || typeof method !== 'string') return fail(-32600, 'invalid request');
    const isNotification = id === undefined;
    try {
      switch (method) {
        case 'initialize': {
          const asked = params.protocolVersion;
          return reply({
            protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name, version },
            instructions,
          });
        }
        case 'ping':
          return reply({});
        case 'tools/list':
          return reply({ tools: tools.map(({ name: n, description, inputSchema }) => ({ name: n, description, inputSchema })) });
        case 'tools/call': {
          const tool = byName.get(params.name);
          if (!tool) return fail(-32602, `unknown tool: ${params.name}`);
          try {
            const out = await tool.handler(params.arguments || {});
            return reply({ content: [{ type: 'text', text: text(out) }] });
          } catch (e) {
            return reply({ content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
          }
        }
        case 'resources/list':
          return reply({ resources: [] });
        case 'prompts/list':
          return reply({ prompts: [] });
        default:
          if (isNotification) return null; // notifications/initialized, notifications/cancelled, ...
          return fail(-32601, `method not found: ${method}`);
      }
    } catch (e) {
      return fail(-32603, e.message);
    }
  };
}

async function dispatch(handle, body) {
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handle))).filter(Boolean);
    return out.length ? out : null;
  }
  return handle(body);
}

function serveStdio(handle) {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }) + '\n');
      return;
    }
    const res = await dispatch(handle, msg);
    if (res) process.stdout.write(JSON.stringify(res) + '\n');
  });
  rl.on('close', () => process.exit(0));
}

function serveHttp(handle, { name, port, host, secret }) {
  const path = `/s/${secret}/mcp`;
  const server = http.createServer((req, res) => {
    const send = (code, body, type = 'application/json') => {
      res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return send(204, '');
    const url = req.url.split('?')[0];
    if (url === '/health') return send(200, { ok: true, name });
    if (url !== path) return send(404, { error: 'not found' });
    if (req.method === 'GET') return send(405, { error: 'this server does not open server-sent event streams; POST JSON-RPC instead' });
    if (req.method === 'DELETE') return send(200, {});
    if (req.method !== 'POST') return send(405, { error: 'method not allowed' });
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 4 << 20) { send(413, { error: 'body too large' }); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', async () => {
      if (res.writableEnded) return;
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); }
      const out = await dispatch(handle, body);
      if (!out) return send(202, '');
      send(200, out);
    });
  });
  server.listen(port, host, () => {
    const shown = host === '0.0.0.0' ? '<this-computer-ip>' : host;
    process.stderr.write(
      `${name} MCP over HTTP\n  URL: http://${shown}:${port}${path}\n` +
      '  Keep the URL private: the secret inside it is the password.\n' +
      `  Phone apps need https: run  cloudflared tunnel --url http://127.0.0.1:${port}  and use  https://<given-address>${path}\n`,
    );
  });
}

export function serve(def) {
  const handle = makeHandler(def);
  const port = flag('--http');
  if (port) {
    const secret = flag('--secret', process.env.MCP_SECRET || crypto.randomBytes(12).toString('hex'));
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(secret)) throw new Error('--secret must be 8-128 letters, digits, _ or -');
    serveHttp(handle, { name: def.name, port: Number(port), host: flag('--host', '127.0.0.1'), secret });
  } else {
    serveStdio(handle);
  }
  return handle;
}

