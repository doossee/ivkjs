# Contributing to ivkjs

## Development

```bash
git clone https://github.com/doossee/ivkjs.git
cd ivkjs
npm install
npm test
```

## Workflow

1. Fork and branch from `main`
2. Add tests for your change (TDD preferred — write the failing test first)
3. Run `npm run lint` and `npm test`
4. Use [Conventional Commits](https://www.conventionalcommits.org/) for messages
5. Open a PR — small, focused changes merge faster

## Scripts

- `npm run build` — produce `dist/` (ESM + CJS + .d.ts)
- `npm test` — run unit tests
- `npm run test:coverage` — generate coverage report
- `npm run test:watch` — watch mode
- `npm run lint` — ESLint
- `npm run format` — Prettier
- `npm run typecheck` — TypeScript without emit

## Code style

- TypeScript strict mode
- Pure functions preferred
- No UI code, no surface-specific APIs (must work in browsers, Node, Obsidian, Tauri)
- Keep files small — one concern per file

## Releasing (maintainers)

```bash
npm version patch   # or minor, major
git push && git push --tags
```

The `release.yml` workflow publishes to npm on tag push.
