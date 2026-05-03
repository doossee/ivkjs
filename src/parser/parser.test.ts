import { describe, expect, it } from 'vitest';
import { parseIvk } from './parser';

describe('parseIvk', () => {
  it('parses the minimal file (method + URL only)', () => {
    const result = parseIvk('GET https://example.com/health');
    expect(result.method).toBe('GET');
    expect(result.url).toBe('https://example.com/health');
    expect(result.headers).toEqual({});
    expect(result.body).toBe('');
    expect(result.directives).toEqual({});
  });

  it('parses @directives before the request line', () => {
    const input = `@name Login
@tag auth
@description Send OTP

POST https://api.example.com/login
`;
    const result = parseIvk(input);
    expect(result.directives.name).toBe('Login');
    expect(result.directives.tag).toBe('auth');
    expect(result.directives.description).toBe('Send OTP');
    expect(result.method).toBe('POST');
    expect(result.url).toBe('https://api.example.com/login');
  });

  it('parses headers as Key: Value until empty line', () => {
    const input = `POST https://api.example.com/a
Content-Type: application/json
Authorization: Bearer abc

{"x":1}
`;
    const result = parseIvk(input);
    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.headers['Authorization']).toBe('Bearer abc');
    expect(result.body).toBe('{"x":1}');
  });

  it('expands @auth bearer into an Authorization header', () => {
    const input = `@auth bearer {{token}}

GET https://api.example.com/me
`;
    const result = parseIvk(input);
    expect(result.headers['Authorization']).toBe('Bearer {{token}}');
  });

  it('expands @auth basic into an Authorization header with base64', () => {
    const input = `@auth basic user pass

GET https://api.example.com/me
`;
    const result = parseIvk(input);
    expect(result.headers['Authorization']).toBe('Basic dXNlcjpwYXNz');
  });

  it('does not add Authorization header for @auth none', () => {
    const input = `@auth none

GET https://api.example.com/public
`;
    const result = parseIvk(input);
    expect(result.headers['Authorization']).toBeUndefined();
  });

  it('parses body as raw text until > script block', () => {
    const input = `POST https://api.example.com/a
Content-Type: application/json

{
  "hello": "world"
}
`;
    const result = parseIvk(input);
    expect(result.body).toBe('{\n  "hello": "world"\n}');
  });

  it('parses > pre, > post, and > test script blocks', () => {
    const input = `GET https://api.example.com/a

> pre {
  ivk.env.set("ts", Date.now());
}

> post {
  ivk.env.set("id", res.body.id);
}

> test {
  test("ok", () => expect(res.status).toBe(200));
}
`;
    const result = parseIvk(input);
    expect(result.scripts.pre.trim()).toContain('Date.now()');
    expect(result.scripts.post.trim()).toContain('res.body.id');
    expect(result.scripts.test.trim()).toContain('expect(res.status)');
  });

  it('preserves unknown @directives for forward-compat', () => {
    const input = `@name X
@custom-thing some-value

GET https://api.example.com/a
`;
    const result = parseIvk(input);
    expect(result.directives['custom-thing']).toBe('some-value');
  });

  it('handles script block with nested braces', () => {
    const input = `GET https://api.example.com/a

> post {
  if (res.status === 200) {
    ivk.env.set("ok", "true");
  }
}
`;
    const result = parseIvk(input);
    expect(result.scripts.post).toContain('if (res.status');
    expect(result.scripts.post).toContain('ivk.env.set');
  });

  it('treats URL-only line (no method) as GET', () => {
    const input = 'https://example.com/a';
    const result = parseIvk(input);
    expect(result.method).toBe('GET');
    expect(result.url).toBe('https://example.com/a');
  });

  /* ---------------- multi-line directive values ---------------- */
  // Until this fix, a directive value was strictly the rest of its own line.
  // If the user wrote markdown across multiple lines after `@description ...`,
  // every continuation line became either a garbage header or part of body,
  // and the actual `POST {{baseUrl}}/api` request line ended up dumped into
  // body. Repro: real-world ivk files in collections like `Ovi/invoker`.

  it('joins continuation lines into a multi-line @description value', () => {
    const input = `@name X
@description # Heading
First paragraph of description.
Second paragraph.
@tag api

POST https://api.example.com/a
`;
    const result = parseIvk(input);
    expect(result.directives.description).toBe(
      '# Heading\nFirst paragraph of description.\nSecond paragraph.',
    );
    expect(result.directives.name).toBe('X');
    expect(result.directives.tag).toBe('api');
    expect(result.method).toBe('POST');
    expect(result.url).toBe('https://api.example.com/a');
    // Critical regression assertion: the request line MUST NOT leak into
    // body or headers.
    expect(result.body).toBe('');
    expect(Object.keys(result.headers)).toHaveLength(0);
  });

  it('preserves blank-line paragraph breaks inside a multi-line directive', () => {
    const input = `@description Para one.

Para two.
@tag x

GET https://api.example.com/a
`;
    const result = parseIvk(input);
    expect(result.directives.description).toBe('Para one.\n\nPara two.');
  });

  it('terminates multi-line directive when blank line is followed by request line', () => {
    const input = `@description Just a description that spans
several lines.

GET https://api.example.com/a
`;
    const result = parseIvk(input);
    expect(result.directives.description).toBe(
      'Just a description that spans\nseveral lines.',
    );
    expect(result.method).toBe('GET');
  });

  it('does not misinterpret markdown content as headers', () => {
    // Real-world repro: @description with markdown table + JSON code blocks.
    // The previous parser interpreted every `key: value` pattern as an HTTP
    // header — turning `"jsonrpc": "2.0",` into header `"jsonrpc": "2.0",`.
    const input = `@description # Title
Some prose with a colon: not a header.
\`\`\`json
{ "jsonrpc": "2.0", "method": "Foo.bar" }
\`\`\`
@tag api

POST https://api.example.com/api
Content-Type: application/json

{"hello":"world"}
`;
    const result = parseIvk(input);
    // None of the markdown lines should leak into headers.
    expect(result.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(result.body).toBe('{"hello":"world"}');
    expect(result.method).toBe('POST');
    expect(result.url).toBe('https://api.example.com/api');
    expect(result.directives.description).toContain('# Title');
    expect(result.directives.description).toContain('"jsonrpc": "2.0"');
  });

  it('handles multi-line values for unknown @directives (forward compat)', () => {
    const input = `@notes Line one.
Line two.
Line three.

GET https://example.com/x
`;
    const result = parseIvk(input);
    expect(result.directives.notes).toBe('Line one.\nLine two.\nLine three.');
  });

  it('a continuation line beginning with another @ starts a NEW directive', () => {
    const input = `@description first directive value
@tag second-directive

GET https://example.com/x
`;
    const result = parseIvk(input);
    expect(result.directives.description).toBe('first directive value');
    expect(result.directives.tag).toBe('second-directive');
  });

  it('a continuation line that looks like a request line starts the request', () => {
    // Edge case: user wrote something doc-y on its own line that happens to
    // start with an HTTP method + space + URL-shaped token. We treat it as
    // the actual request, not as multi-line description content.
    const input = `@description short description
GET https://example.com/api
`;
    const result = parseIvk(input);
    expect(result.directives.description).toBe('short description');
    expect(result.method).toBe('GET');
    expect(result.url).toBe('https://example.com/api');
  });
});
