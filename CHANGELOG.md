# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- `RequestRunner.run` now executes the `> pre` script **before** resolving `{{variable}}` placeholders in URL, body, and headers. Previously the order was reversed, so anything `pre` published via `ivk.env.set("X", "Y")` only applied to *future* requests — `{{X}}` in the current request stayed literal. This silently broke the documented `EnvManager.get` priority ("runtime set by `> pre` of the current request > active environment > defaults"). Direct mutations like `ivk.request.headers["X-Foo"] = …` continue to work as before. ([#2](https://github.com/doossee/ivkjs/pull/2))

## [0.1.1] — 2026-05-03

### Fixed

- `parseIvk` now supports multi-line `@directive` values. Previous behaviour treated continuation lines as garbage HTTP headers and dumped the actual request line into `body`, producing a fully broken request. Multi-line values terminate on the next `@directive`, on a blank line followed by a request line, or at EOF. Blank lines between content paragraphs are preserved as `\n\n` so markdown-formatted descriptions round-trip cleanly. ([#1](https://github.com/doossee/ivkjs/pull/1))

## [0.1.0] — 2026-04-16

### Added

- Initial release 🎉
- `.ivk` format parser (`parseIvk`) and serializer (`serializeIvk`)
- `EnvManager` with runtime / active-env / collection variable resolution priority
- `ScriptRunner` — sandboxed pre/post/test script execution with `ivk` and `res` globals
- `RequestRunner` — variable resolution + script orchestration + transport-based HTTP
- `HttpTransport` interface for pluggable HTTP backends
- `FetchTransport` — built-in implementation using `globalThis.fetch`
- Extracted from `obsidian-invoker@0.1.0`

[Unreleased]: https://github.com/doossee/ivkjs/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/doossee/ivkjs/releases/tag/v0.1.0
