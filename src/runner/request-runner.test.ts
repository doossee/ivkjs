import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvManager } from '../env/env-manager';
import { RequestRunner } from './request-runner';
import type { HttpTransport, NormalizedResponse } from '../transport/transport';
import type { InvokerSettings, IvkRequest } from '../types';

function makeEnv(): EnvManager {
  const settings: InvokerSettings = {
    environments: [
      {
        name: 'dev',
        variables: { baseUrl: 'https://api.example.com', phone: '998' },
      },
    ],
    activeEnvironmentIndex: 0,
    timeout: 30000,
  };
  return new EnvManager(() => settings);
}

function makeRequest(overrides: Partial<IvkRequest> = {}): IvkRequest {
  return {
    directives: {},
    method: 'POST',
    url: '{{baseUrl}}/login',
    headers: { 'Content-Type': 'application/json' },
    body: '{"phone":"{{phone}}"}',
    scripts: { pre: '', post: '', test: '' },
    ...overrides,
  };
}

class StubTransport implements HttpTransport {
  public calls: { method: string; url: string; body?: string }[] = [];
  constructor(private response: NormalizedResponse) {}
  async send(req: { method: string; url: string; body?: string }): Promise<NormalizedResponse> {
    this.calls.push({ method: req.method, url: req.url, body: req.body });
    return this.response;
  }
}

describe('RequestRunner', () => {
  let env: EnvManager;

  beforeEach(() => {
    env = makeEnv();
  });

  it('resolves variables in URL and body before sending', async () => {
    const transport = new StubTransport({
      status: 200,
      headers: {},
      body: '{"ok":true}',
      timeMs: 5,
    });
    const runner = new RequestRunner(env, transport);

    await runner.run(makeRequest());

    expect(transport.calls[0]!.url).toBe('https://api.example.com/login');
    expect(transport.calls[0]!.body).toBe('{"phone":"998"}');
  });

  it('runs pre-script before transport (mutations take effect)', async () => {
    const transport = new StubTransport({
      status: 200,
      headers: {},
      body: '{}',
      timeMs: 5,
    });
    const runner = new RequestRunner(env, transport);

    await runner.run(
      makeRequest({
        scripts: {
          pre: 'ivk.request.headers["X-Added"] = "yes";',
          post: '',
          test: '',
        },
      }),
    );

    env.set('_marker', 'start');
    await runner.run(
      makeRequest({
        scripts: {
          pre: 'ivk.env.set("_marker", "pre-ran");',
          post: '',
          test: '',
        },
      }),
    );
    expect(env.get('_marker')).toBe('pre-ran');
  });

  it('runs post-script after transport (can read response)', async () => {
    const transport = new StubTransport({
      status: 200,
      headers: {},
      body: '{"token":"xyz"}',
      timeMs: 5,
    });
    const runner = new RequestRunner(env, transport);

    await runner.run(
      makeRequest({
        scripts: {
          pre: '',
          post: 'ivk.env.set("token", res.body.token);',
          test: '',
        },
      }),
    );
    expect(env.get('token')).toBe('xyz');
  });

  it('runs test scripts and returns results', async () => {
    const transport = new StubTransport({
      status: 200,
      headers: {},
      body: '{}',
      timeMs: 5,
    });
    const runner = new RequestRunner(env, transport);

    const result = await runner.run(
      makeRequest({
        scripts: {
          pre: '',
          post: '',
          test: 'test("status-ok", () => expect(res.status).toBe(200));',
        },
      }),
    );
    expect(result.testResults).toEqual([{ name: 'status-ok', passed: true }]);
  });

  it('parses JSON response bodies into objects', async () => {
    const transport = new StubTransport({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '{"id":"abc"}',
      timeMs: 5,
    });
    const runner = new RequestRunner(env, transport);
    const result = await runner.run(makeRequest());
    expect(result.response.body).toEqual({ id: 'abc' });
  });

  it('keeps non-JSON bodies as strings', async () => {
    const transport = new StubTransport({
      status: 200,
      headers: { 'content-type': 'text/plain' },
      body: 'hello world',
      timeMs: 5,
    });
    const runner = new RequestRunner(env, transport);
    const result = await runner.run(makeRequest());
    expect(result.response.body).toBe('hello world');
  });

  it('exposes network failure as status 0 with error', async () => {
    const transport = new StubTransport({
      status: 0,
      headers: {},
      body: '',
      timeMs: 5,
      error: 'network down',
    });
    const runner = new RequestRunner(env, transport);
    const result = await runner.run(makeRequest());
    expect(result.response.status).toBe(0);
    expect(result.response.error).toBe('network down');
  });

  it('parses @timeout directive and passes to transport', async () => {
    const transport = new StubTransport({
      status: 200,
      headers: {},
      body: '{}',
      timeMs: 5,
    });
    const spy = vi.spyOn(transport, 'send');
    const runner = new RequestRunner(env, transport);

    await runner.run(
      makeRequest({
        directives: { timeout: '5s' },
      }),
    );

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ timeout: 5000 }));

    await runner.run(
      makeRequest({
        directives: { timeout: '500ms' },
      }),
    );
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ timeout: 500 }));
  });

  it('does not mutate the original request object', async () => {
    const transport = new StubTransport({
      status: 200,
      headers: {},
      body: '{}',
      timeMs: 5,
    });
    const runner = new RequestRunner(env, transport);
    const req = makeRequest();
    const snapshot = JSON.stringify(req);
    await runner.run(req);
    expect(JSON.stringify(req)).toBe(snapshot);
  });
});
