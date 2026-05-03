# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this subproject. Workspace-level rules live in [`../CLAUDE.md`](../CLAUDE.md) — read that too.

## Role in the workspace

`ivkjs` is the **shared core** of the Invoker project. Published to npm as `ivkjs` and consumed by three surfaces:

- `obsidian-invoker` — Obsidian plugin
- `invoker-app` — web + Tauri desktop
- `invoker-mcp` — MCP server for AI agents

Changes here don't propagate until republish — consumers install from npm, not a local link. See the workspace CLAUDE.md for the cross-repo change flow.

## Platform-agnostic constraint

**No DOM, no Obsidian, no Tauri, no Node-only APIs** — ivkjs must run in all of them. If a feature needs platform access (real filesystem, CORS-bypassing HTTP, OS-specific behaviour), it belongs in a transport implementation inside a consumer, not here.

The one global API allowed: `fetch` — available in all supported environments (browsers, Node ≥18, Tauri webview, Obsidian).

## Module layout

```
src/
├── index.ts       ← public API barrel (only imports from here are stable)
├── types.ts       ← IvkRequest, IvkResponse, HttpMethod, InvokerSettings, DEFAULT_SETTINGS
├── parser/        ← parseIvk, serializeIvk — pure, no side effects
├── env/           ← EnvManager (variable resolution, debounced auto-save)
├── runner/        ← ScriptRunner (sandbox) + RequestRunner (orchestrates)
└── transport/     ← HttpTransport interface + FetchTransport default
```

Each module exports through its own `index.ts`. Cross-module imports go through those barrels — don't reach into sibling internals.

## Key invariants

**Parser state machine:** `directives → request-line → headers → body → script`. Script blocks count brace depth so nested `{}` inside JS work. Unknown `@directives` are preserved on round-trip (forward compatibility). See [`src/parser/parser.ts`](src/parser/parser.ts).

**Variable resolution priority** (`EnvManager.get`): runtime (set by `> pre` scripts in the current request) > active environment > collection defaults (future). **Undefined names stay literal** — `{{missingVar}}` is sent as-is. This is intentional: fail visibly, never silently empty.

**Script sandbox is `new Function()`, not a security boundary.** Scripts receive:
- `ivk` — `{ env, log, request }` in `pre`; `{ env, log }` in `post`/`test`
- `res` — response object in `post`/`test` (status, body, headers, time)
- `test` / `expect` — test harness in `test` block only

See [`src/runner/script-runner.ts`](src/runner/script-runner.ts).

**Request lifecycle** (`RequestRunner.run`):
1. Clone the request (UI state must not be mutated)
2. Run `> pre` script (may mutate the cloned request directly AND set env vars)
3. Resolve variables in url/headers/body — reads any env vars `pre` just set
4. Send via the injected `HttpTransport`
5. Run `> post` script (may set env vars)
6. Run `> test` script (produces `TestResult[]`)
7. Return `{ response, testResults, logs }`

**Why pre runs before resolve:** the `EnvManager.get` priority docs say "runtime (set by `> pre` of the current request) > active env > defaults" — that's only true if pre runs first. Older versions ran resolve first, so any env var pre set only affected *future* requests; the current request still saw the un-resolved literal `{{X}}`. Fixed in 0.1.2 ([#2](https://github.com/doossee/ivkjs/pull/2)).

**Transport contract:** `send(NormalizedRequest) => Promise<NormalizedResponse>`. Transports never throw on HTTP errors — they return `{ status: 0, error: "..." }` so the runner can surface the failure without unwinding the stack.

## Commands

```bash
npm install
npm test                # vitest run
npm run test:watch
npm run test:coverage   # → coverage/
npm run lint            # ESLint
npm run lint:fix
npm run format          # Prettier
npm run format:check
npm run typecheck       # tsc --noEmit
npm run build           # tsup → dist/ (ESM + CJS + .d.ts)
```

Run a single test file: `npx vitest run src/parser/parser.test.ts`
Run by test name: `npx vitest run -t "parses directives"`

**CI gates (pre-merge):** `format:check` + `lint` + `typecheck` + `test` + `build` + dist-artifact presence check. **Pre-publish gate** (`prepublishOnly`): `lint` + `typecheck` + `test` + `build`.

## Testing policy

**TDD preferred** per `CONTRIBUTING.md` — write the failing test first, then the fix.

Every module has co-located `*.test.ts` files (`parser/parser.test.ts`, `env/env-manager.test.ts`, etc.). Add tests when you add or change behaviour. Snapshot tests exist for parser/serializer round-trips — update them intentionally, never auto-accept changes without checking what's different.

When a downstream consumer has logic that feels test-worthy, prefer pushing the logic down into `ivkjs` and covering it here rather than introducing a test runner in the consumer.

## Release flow

```bash
npm version patch   # or minor, major
git push && git push --tags
```

`.github/workflows/release.yml` publishes to npm on tag push. After release, bump the `ivkjs` dep in each consumer (`obsidian-invoker`, `invoker-app`, `invoker-mcp`) in a follow-up PR per repo.

## Where to find more

- `.ivk` format spec → [`../obsidian-invoker/docs/FORMAT.md`](../obsidian-invoker/docs/FORMAT.md)
- Scripting API reference → [`../obsidian-invoker/docs/SCRIPTING.md`](../obsidian-invoker/docs/SCRIPTING.md)
