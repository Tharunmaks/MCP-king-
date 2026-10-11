# MCP King

A website plus three MCP servers for people who code with AI (Claude, ChatGPT, Gemini, Cursor, Codex, Grok, Kimi…) on **iPhone, Android, Windows, macOS and Linux**.

- **Server directory:** 110 hand-picked servers. Each one gives the exact setup for your app and device: a `claude mcp add` command, JSON for Claude Desktop, Cursor, Gemini CLI, Windsurf or Cline, `.vscode/mcp.json`, Codex `config.toml`, or a connector URL for phone apps.
- **Live registry:** search the official [MCP Registry](https://registry.modelcontextprotocol.io) from the page. It has thousands more servers, and each one comes with generated setup commands.
- **Token saver:** the Lean Context server plus `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` rules files.
- **Rules and skills:** 6 rules files and 13 `SKILL.md` skills that you can copy, download or install all at once.
- **Phone guide:** which servers work in phone apps, Termux setup for Android, and how to share a PC server with your phone.

## Open the website

It's a static site with no build step. Any of these works:

- **GitHub Pages:** go to the repo's Settings → Pages → *Deploy from a branch*, pick this branch and the `/ (root)` folder. The site appears at `https://tharunmaks.github.io/MCP-king-/`.
- **Locally:** run `python3 -m http.server 8000` in this folder and open http://127.0.0.1:8000. You can also open `index.html` directly in a browser.

## The MCP servers in this repo

All three need only **Node.js 18+** and have no npm dependencies. They work on Windows, macOS, Linux and Android (Termux).

```sh
git clone https://github.com/Tharunmaks/MCP-king- ~/MCP-king-
```

### Lean Context: spend fewer tokens (`servers/lean-context`)
```sh
claude mcp add --scope user lean -- node ~/MCP-king-/servers/lean-context/lean_mcp.mjs
```
Instead of reading whole files, the AI asks for exactly what it needs:

| tool | what it does |
|---|---|
| `lean_rules` | token-saving rules for the AI |
| `project_map` | compact tree with line counts (skips node_modules, build output, .git) |
| `outline` | functions, classes and headings with line ranges (JS/TS, Python, Go, Rust, Java/Kotlin/C#/Swift/Dart, C/C++, PHP, Ruby, shell, Lua, Markdown, CSS) |
| `read_symbol` | one function or class by name |
| `read_lines` | a line range (at most 400 lines per call) |
| `search` | compact `file:line: text` hits (uses ripgrep when it's installed) |
| `git_brief` | branch, changed files, diff stat and recent commits |
| `token_report` | estimated tokens for the whole file compared with its outline |

Measured on real files (outline + one function compared with reading the whole file): 87% fewer tokens on `Chroma-node/web/assets/js/helix/catalog.js`, 89% on `Stream-/craft/expertcraft_mcp.py`, and 85% on `Stream-/mcp/expertstream_mcp.py`. Your saving over a whole session will be smaller, because answers, edits and tool definitions also use tokens.

Lean Context is read-only. It serves files only from the folder where your AI app starts it (or from `LEAN_ROOT`).

### Design Kit: better-looking UIs (`servers/design-kit`)
```sh
claude mcp add --scope user design -- node ~/MCP-king-/servers/design-kit/design_mcp.mjs
```
`design_rules`, `palette` (light and dark tokens from one brand colour, built in OKLCH and checked against WCAG AA), `contrast`, `type_scale` (fluid `clamp()`), `spacing_scale`, `font_pairing` (8 Google Font pairings), `component_recipe` (button, card, navbar, hero, form, pricing, modal, empty state) and `audit_css`. This website's own colours come from its `palette` tool.

### Helix 3D/4D: 124,130 procedural models (`servers/helix`)
This server uses the Helix engine from [Chroma-node](https://github.com/Tharunmaks/Chroma-node):
```sh
git clone https://github.com/Tharunmaks/Chroma-node ~/Chroma-node && (cd ~/Chroma-node && npm install)
claude mcp add --scope user helix -- node ~/MCP-king-/servers/helix/helix_mcp.mjs
```
Its tools are `helix_guide`, `list_families`, `search_models`, `random_model`, `get_model` (which returns parameters plus code for Helix pages) and `export_model`. Export formats:
- `html`: a standalone viewer that works in phone and PC browsers. 4D models rotate through the fourth dimension.
- `obj`: for Blender, Unity, Godot or 3D printing.
- `json`: raw geometry for your own code.

Files are written only to `HELIX_OUT` (default `~/helix-models`). Set `HELIX_HOME` if Chroma-node is somewhere other than `~/Chroma-node`.

### Using these servers from a phone app
Every server also speaks MCP over HTTP:
```sh
node ~/MCP-king-/servers/design-kit/design_mcp.mjs --http 8787          # prints http://127.0.0.1:8787/s/<secret>/mcp
cloudflared tunnel --url http://127.0.0.1:8787                           # gives a free https address
```
Then add `https://<address>/s/<secret>/mcp` as a custom connector in the Claude app or ChatGPT. The secret in the link works as the password, so keep the link private. Other options: `--host 0.0.0.0` makes the server reachable from your Wi-Fi, and `--secret` sets a fixed secret.

### Also from Tharunmaks (listed on the site)
- **Expert Craft** (`Stream-/craft`) builds language models from scratch, from 1M to 70B parameters, on free compute.
- **ExpertStream** (`Stream-/mcp`) runs GGUF models locally and comes with 251 agents.

## Rules and skills
- `rules/`: `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, a Cursor rule, Copilot instructions, and design rules you can paste into any AI.
- `skills/`: token-saver, ui-designer, helix-3d, bug-hunter, test-writer, code-reviewer, commit-message, security-audit, api-designer, docs-writer, mobile-app-builder, refactor-safely and perf-optimizer.

To install every skill for Claude Code:
```sh
mkdir -p ~/.claude/skills && cp -r ~/MCP-king-/skills/* ~/.claude/skills/
```
After you edit `rules/` or `skills/`, run `node scripts/build-library.mjs` to refresh `data/library.js`, which is what the website reads.

## Development
```sh
npm test                      # MCP protocol tests for all three servers (Helix test needs Chroma-node; set HELIX_HOME)
npm run serve                 # then, in another terminal:
npm run check:site            # Playwright: no console errors, no sideways scroll at 360px, valid setup for every server × app × device
```

To add a server, add an entry to `data/catalog.js`. The format is documented at the top of that file.

## About the "1 million MCP servers" idea
Nobody has published a million real MCP servers. Public directories list thousands to tens of thousands. This site lists only servers that actually exist: 110 hand-picked ones, plus everything in the live official registry, plus links to Smithery, Glama, PulseMCP, mcp.so, the Docker MCP Catalog and awesome-mcp-servers. One more thing to know: adding more servers to your AI *increases* token use, because every connected server's tool list is sent with every message. Connect only the servers you're using.

MIT licensed.
