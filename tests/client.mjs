// Tiny stdio MCP client used by the tests: start a server, send JSON-RPC, read replies.
import { spawn } from 'node:child_process';

export function connect(cmd, args, env = {}) {
  const child = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'inherit'] });
  const waiting = new Map();
  let buf = '';
  let next = 1;
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      waiting.get(msg.id)?.(msg);
      waiting.delete(msg.id);
    }
  });
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = next++;
    const timer = setTimeout(() => reject(new Error(`timeout: ${method}`)), 30000);
    waiting.set(id, (m) => { clearTimeout(timer); resolve(m); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  return {
    request,
    async init() {
      const r = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      return r.result;
    },
    async call(name, args = {}) {
      const r = await request('tools/call', { name, arguments: args });
      if (r.error) throw new Error(r.error.message);
      const t = r.result.content[0].text;
      if (r.result.isError) throw new Error(t);
      try { return JSON.parse(t); } catch { return t; }
    },
    close() { child.stdin.end(); child.kill(); },
  };
}
