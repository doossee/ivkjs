import type { IvkRequest } from '../types';

export function serializeIvk(request: IvkRequest): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(request.directives)) {
    if (value) lines.push(`@${key} ${value}`);
  }

  if (lines.length > 0) lines.push('');

  lines.push(`${request.method} ${request.url}`);

  const skipAuth = request.directives['auth'] && request.directives['auth'] !== 'none';
  for (const [key, value] of Object.entries(request.headers)) {
    if (skipAuth && key === 'Authorization') continue;
    lines.push(`${key}: ${value}`);
  }

  if (request.body) {
    lines.push('');
    lines.push(request.body);
  }

  for (const type of ['pre', 'post', 'test'] as const) {
    if (request.scripts[type]) {
      lines.push('');
      lines.push(`> ${type} {`);
      lines.push(request.scripts[type]);
      lines.push('}');
    }
  }

  return lines.join('\n') + '\n';
}
