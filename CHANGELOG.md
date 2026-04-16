# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
