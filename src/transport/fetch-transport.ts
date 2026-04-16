import type { HttpTransport, NormalizedRequest, NormalizedResponse } from './transport';

export class FetchTransport implements HttpTransport {
  async send(request: NormalizedRequest): Promise<NormalizedResponse> {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = request.timeout
      ? setTimeout(() => controller.abort(), request.timeout)
      : null;

    try {
      const init: RequestInit = {
        method: request.method,
        headers: request.headers,
        signal: controller.signal,
      };
      if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method.toUpperCase())) {
        init.body = request.body;
      }

      const response = await fetch(request.url, init);
      const body = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: response.status,
        headers,
        body,
        timeMs: Date.now() - start,
      };
    } catch (e) {
      return {
        status: 0,
        headers: {},
        body: '',
        timeMs: Date.now() - start,
        error: (e as Error).message,
      };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
}
