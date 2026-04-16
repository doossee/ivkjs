# Security Policy

## Supported versions

Only the latest released version receives security patches.

## Reporting a vulnerability

**Please do not open a public issue.** Use [GitHub's private vulnerability reporting](https://github.com/doossee/ivkjs/security/advisories/new) feature, or email the maintainer directly.

Initial response within 7 days.

## Scope

`ivkjs` executes pre-/post-/test scripts in a sandboxed `new Function()` context. The sandbox is intentionally limited but **not a security boundary** — only run scripts from `.ivk` files you trust, as with any executable code.

Scripts can:

- Make HTTP requests via the transport
- Read/write environment variables

Scripts cannot (from a pure `ivkjs` perspective):

- Access the file system
- Spawn processes
