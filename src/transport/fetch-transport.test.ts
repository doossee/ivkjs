import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchTransport } from './fetch-transport';

describe('FetchTransport', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends a GET request and returns a normalized response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const transport = new FetchTransport();
    const res = await transport.send({
      method: 'GET',
      url: 'https://api.example.com/a',
      headers: { 'X-Test': '1' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/a',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(res.status).toBe(200);
    expect(res.body).toBe('{"ok":true}');
    expect(res.headers['content-type']).toBe('application/json');
    expect(res.timeMs).toBeGreaterThanOrEqual(0);
  });

  it('sends a POST with body and headers', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 201 }));

    const transport = new FetchTransport();
    await transport.send({
      method: 'POST',
      url: 'https://api.example.com/a',
      headers: { 'Content-Type': 'application/json' },
      body: '{"x":1}',
    });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"x":1}');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('returns status 0 with error message on network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const transport = new FetchTransport();
    const res = await transport.send({
      method: 'GET',
      url: 'https://api.example.com/a',
      headers: {},
    });
    expect(res.status).toBe(0);
    expect(res.error).toBe('network down');
    expect(res.body).toBe('');
  });

  it('honors timeout via AbortController', async () => {
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted')));
        }),
    );
    const transport = new FetchTransport();
    const res = await transport.send({
      method: 'GET',
      url: 'https://api.example.com/a',
      headers: {},
      timeout: 10,
    });
    expect(res.status).toBe(0);
    expect(res.error).toContain('abort');
  });
});
