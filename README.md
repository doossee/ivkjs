<div align="center">

# ⚡ ivkjs

**The core of the Invoker API client.**
Parser, script sandbox, environment manager, and HTTP runner for the `.ivk` file format.

[![npm](https://img.shields.io/npm/v/ivkjs.svg?style=flat-square)](https://www.npmjs.com/package/ivkjs)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/doossee/ivkjs/ci.yml?branch=main&style=flat-square&label=ci)](https://github.com/doossee/ivkjs/actions)

</div>

---

`ivkjs` is the framework-agnostic core of the [Invoker](https://github.com/doossee/obsidian-invoker) project. It parses `.ivk` request files, resolves `{{variables}}` from environments, runs pre/post/test scripts in a sandbox, and executes HTTP requests via a pluggable transport. Use it to build API clients, documentation tools, or CI test runners on top of the `.ivk` format.

## Install

```bash
npm install ivkjs
```

## Usage

```typescript
import { parseIvk, EnvManager, RequestRunner, FetchTransport, type InvokerSettings } from 'ivkjs';

const settings: InvokerSettings = {
  environments: [
    { name: 'dev', variables: { baseUrl: 'https://api.example.com', phone: '998901234567' } },
  ],
  activeEnvironmentIndex: 0,
  timeout: 30000,
};

const env = new EnvManager(() => settings);
const runner = new RequestRunner(env, new FetchTransport());

const request = parseIvk(`
@name Login

POST {{baseUrl}}/login
Content-Type: application/json

{ "phone": "{{phone}}" }

> post {
  ivk.env.set("token", res.body.token);
}
`);

const { response, testResults, logs } = await runner.run(request);
console.log(response.status, response.body);
```

## Public API

### Parser

- `parseIvk(text: string): IvkRequest`
- `serializeIvk(request: IvkRequest): string`

### Env

- `new EnvManager(getSettings)` — construct with a function returning current settings
- `env.get(name)`, `env.set(name, value)`, `env.resolveVariables(text)`
- `env.setSaveCallback(fn)` — debounced auto-save hook

### Runners

- `new ScriptRunner(env)` — executes pre/post/test scripts
- `new RequestRunner(env, transport)` — orchestrates variable resolution, scripts, and HTTP

### Transport

- `HttpTransport` interface — implement `send(request) => response`
- `FetchTransport` — built-in browser/Node implementation

Implement your own transport for surfaces that need to bypass CORS (like Tauri's HTTP plugin or Obsidian's `requestUrl`).

## License

MIT — see [LICENSE](LICENSE).
