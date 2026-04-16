import { beforeEach, describe, expect, it } from 'vitest';
import { EnvManager } from '../env/env-manager';
import { ScriptRunner } from './script-runner';
import type { InvokerSettings, IvkRequest, IvkResponse } from '../types';

function makeRequest(): IvkRequest {
  return {
    directives: {},
    method: 'GET',
    url: 'https://api.example.com',
    headers: {},
    body: '',
    scripts: { pre: '', post: '', test: '' },
  };
}

function makeResponse(overrides: Partial<IvkResponse> = {}): IvkResponse {
  return {
    status: 200,
    headers: {},
    body: { ok: true, id: 'abc' },
    time: 100,
    size: 20,
    ...overrides,
  };
}

function makeEnv(): EnvManager {
  const settings: InvokerSettings = {
    environments: [{ name: 'dev', variables: {} }],
    activeEnvironmentIndex: 0,
    timeout: 30000,
  };
  return new EnvManager(() => settings);
}

describe('ScriptRunner', () => {
  let env: EnvManager;
  let runner: ScriptRunner;

  beforeEach(() => {
    env = makeEnv();
    runner = new ScriptRunner(env);
  });

  describe('pre-scripts', () => {
    it('lets pre script mutate headers', () => {
      const req = makeRequest();
      runner.runPreScript('ivk.request.headers["X-Test"] = "yes";', req);
      expect(req.headers['X-Test']).toBe('yes');
    });

    it('lets pre script set env vars', () => {
      const req = makeRequest();
      runner.runPreScript('ivk.env.set("reqTime", "123");', req);
      expect(env.get('reqTime')).toBe('123');
    });

    it('catches syntax errors and logs them', () => {
      const req = makeRequest();
      runner.runPreScript('this is not valid js !!!', req);
      expect(runner.getLogs().some((l) => l.includes('[pre-script error]'))).toBe(true);
    });

    it('is a no-op for empty script', () => {
      const req = makeRequest();
      expect(() => runner.runPreScript('', req)).not.toThrow();
    });
  });

  describe('post-scripts', () => {
    it('can read res and write env', () => {
      const res = makeResponse();
      runner.runPostScript('ivk.env.set("id", res.body.id);', res);
      expect(env.get('id')).toBe('abc');
    });

    it('catches runtime errors and logs them', () => {
      const res = makeResponse();
      runner.runPostScript('throw new Error("boom");', res);
      expect(runner.getLogs().some((l) => l.includes('[post-script error]'))).toBe(true);
    });
  });

  describe('test scripts', () => {
    it('runs passing tests', () => {
      const res = makeResponse();
      const results = runner.runTests('test("ok", () => expect(res.status).toBe(200));', res);
      expect(results).toEqual([{ name: 'ok', passed: true }]);
    });

    it('records failing tests with error messages', () => {
      const res = makeResponse();
      const results = runner.runTests('test("wrong", () => expect(res.status).toBe(500));', res);
      expect(results[0]!.passed).toBe(false);
      expect(results[0]!.error).toContain('Expected 500');
    });

    it('supports expect().toBeDefined / toContain / toBeGreaterThan', () => {
      const res = makeResponse();
      const results = runner.runTests(
        `
        test("defined", () => expect(res.body.id).toBeDefined());
        test("contains", () => expect("hello").toContain("ell"));
        test("greater", () => expect(res.time).toBeGreaterThan(50));
      `,
        res,
      );
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it('captures script errors as failed test', () => {
      const res = makeResponse();
      const results = runner.runTests('this is not valid js', res);
      expect(results[0]!.passed).toBe(false);
    });
  });

  describe('logs', () => {
    it('ivk.log pushes to log buffer', () => {
      const req = makeRequest();
      runner.runPreScript('ivk.log("hello");', req);
      expect(runner.getLogs()).toContain('hello');
    });

    it('clearLogs empties the buffer', () => {
      const req = makeRequest();
      runner.runPreScript('ivk.log("a");', req);
      runner.clearLogs();
      expect(runner.getLogs()).toEqual([]);
    });
  });
});
