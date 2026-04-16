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
});
