import type { IvkRequest, IvkResponse } from '../types';
import type { EnvManager } from '../env/env-manager';
import type { HttpTransport, NormalizedRequest } from '../transport/transport';
import { ScriptRunner, type TestResult } from './script-runner';

export interface RunResult {
  response: IvkResponse;
  testResults: TestResult[];
  logs: string[];
}

export class RequestRunner {
  private scriptRunner: ScriptRunner;

  constructor(
    private env: EnvManager,
    private transport: HttpTransport,
  ) {
    this.scriptRunner = new ScriptRunner(env);
  }

  async run(request: IvkRequest): Promise<RunResult> {
    this.scriptRunner.clearLogs();

    // Clone request so mutations don't affect the original
    const req: IvkRequest = JSON.parse(JSON.stringify(request));

    // Resolve variables in URL, headers, body
    req.url = this.env.resolveVariables(req.url);
    req.body = this.env.resolveVariables(req.body);
    for (const [key, value] of Object.entries(req.headers)) {
      req.headers[key] = this.env.resolveVariables(value);
    }

    // Run pre-script (can mutate req)
    this.scriptRunner.runPreScript(req.scripts.pre, req);

    // Parse timeout directive → ms
    let timeout: number | undefined;
    if (req.directives['timeout']) {
      const match = req.directives['timeout'].match(/^(\d+)(s|ms)?$/);
      if (match) {
        const val = parseInt(match[1]!, 10);
        timeout = match[2] === 'ms' ? val : val * 1000;
      }
    }

    const normalizedReq: NormalizedRequest = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body || undefined,
      timeout,
    };

    const normalizedRes = await this.transport.send(normalizedReq);

    // Try to parse body as JSON; fall back to string
    let parsedBody: unknown = normalizedRes.body;
    const contentType = normalizedRes.headers['content-type'] ?? '';
    if (
      contentType.includes('application/json') ||
      (normalizedRes.body && /^\s*[{[]/.test(normalizedRes.body))
    ) {
      try {
        parsedBody = JSON.parse(normalizedRes.body);
      } catch {
        parsedBody = normalizedRes.body;
      }
    }

    const response: IvkResponse = {
      status: normalizedRes.status,
      headers: normalizedRes.headers,
      body: parsedBody,
      time: normalizedRes.timeMs,
      size: normalizedRes.body.length,
      ...(normalizedRes.error ? { error: normalizedRes.error } : {}),
    };

    // Run post-script
    this.scriptRunner.runPostScript(req.scripts.post, response);

    // Run tests
    const testResults = this.scriptRunner.runTests(req.scripts.test, response);

    return {
      response,
      testResults,
      logs: this.scriptRunner.getLogs(),
    };
  }
}
