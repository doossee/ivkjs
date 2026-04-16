import { describe, expect, it } from 'vitest';
import { parseIvk } from './parser';
import { serializeIvk } from './serializer';

describe('serializeIvk', () => {
  it('serializes a minimal request', () => {
    const result = serializeIvk({
      directives: {},
      method: 'GET',
      url: 'https://example.com/a',
      headers: {},
      body: '',
      scripts: { pre: '', post: '', test: '' },
    });
    expect(result).toBe('GET https://example.com/a\n');
  });

  it('round-trips a full request', () => {
    const input = `@name Login
@tag auth

POST https://api.example.com/login
Content-Type: application/json

{"phone":"998901234567"}

> post {
  ivk.env.set("token", res.body.token);
}
`;
    const parsed = parseIvk(input);
    const serialized = serializeIvk(parsed);
    expect(parseIvk(serialized)).toEqual(parsed);
  });

  it('omits Authorization header when @auth directive is present', () => {
    const parsed = parseIvk('@auth bearer {{token}}\n\nGET https://api.example.com/me\n');
    const serialized = serializeIvk(parsed);
    expect(serialized).not.toContain('Authorization:');
    expect(serialized).toContain('@auth bearer');
  });

  it('preserves unknown directives round-trip', () => {
    const input = `@custom-tag xyz

GET https://example.com/a
`;
    const parsed = parseIvk(input);
    const serialized = serializeIvk(parsed);
    expect(serialized).toContain('@custom-tag xyz');
  });
});
