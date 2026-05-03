import type { HttpMethod, IvkDirectives, IvkRequest } from '../types';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const SCRIPT_REGEX = /^>\s*(pre|post|test)\s*\{/;

/**
 * True if `line` looks like a request line — `METHOD URL` or a bare
 * `http(s)://...` URL on its own. Used inside the directives phase to detect
 * when a continuation line should actually end multi-line directive
 * processing and start the request.
 */
function looksLikeRequestLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '') return false;
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && HTTP_METHODS.includes(parts[0] as HttpMethod)) return true;
  if (parts.length === 1 && /^https?:\/\//.test(trimmed)) return true;
  return false;
}

export function parseIvk(content: string): IvkRequest {
  const lines = content.split('\n');
  const directives: IvkDirectives = {};
  const headers: Record<string, string> = {};
  const scripts = { pre: '', post: '', test: '' };
  let method: HttpMethod = 'GET';
  let url = '';
  let body = '';

  let phase: 'directives' | 'request-line' | 'headers' | 'body' | 'script' = 'directives';
  let currentScript: 'pre' | 'post' | 'test' | null = null;
  let scriptBraceDepth = 0;
  let scriptLines: string[] = [];

  // Tracks the most recently-seen @directive so non-`@` continuation lines
  // can be appended to its value (multi-line directives). Reset to null
  // each time we transition out of the directives phase.
  let lastDirectiveKey: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trimEnd();

    if (currentScript) {
      if (trimmed === '}') {
        scriptBraceDepth--;
        if (scriptBraceDepth === 0) {
          scripts[currentScript] = scriptLines.join('\n');
          currentScript = null;
          scriptLines = [];
          phase = 'body';
          continue;
        }
      }
      for (const ch of trimmed) {
        if (ch === '{') scriptBraceDepth++;
        if (ch === '}') scriptBraceDepth--;
      }
      if (scriptBraceDepth > 0) {
        scriptLines.push(line);
      } else {
        scripts[currentScript] = scriptLines.join('\n');
        currentScript = null;
        scriptLines = [];
        phase = 'body';
      }
      continue;
    }

    const scriptMatch = trimmed.match(SCRIPT_REGEX);
    if (scriptMatch) {
      currentScript = scriptMatch[1] as 'pre' | 'post' | 'test';
      scriptBraceDepth = 1;
      scriptLines = [];
      phase = 'script';
      continue;
    }

    if (phase === 'directives') {
      if (trimmed === '') {
        // Blank line: peek ahead. If the next non-blank line is a request line
        // (or EOF), this blank ends the directives phase — fall through and
        // let the request-line block pick up the next iteration. Otherwise
        // it's a paragraph break inside the current multi-line directive
        // value; preserve it so markdown formatting round-trips.
        let nextNonBlank: string | undefined;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j]!.trim() !== '') {
            nextNonBlank = lines[j];
            break;
          }
        }
        if (nextNonBlank === undefined || looksLikeRequestLine(nextNonBlank)) {
          // End of directives. The next non-blank line will be picked up
          // by the request-line phase below.
          lastDirectiveKey = null;
          continue;
        }
        // Paragraph break inside the current directive's value.
        if (lastDirectiveKey) {
          directives[lastDirectiveKey] += '\n';
        }
        continue;
      }
      if (trimmed.startsWith('@')) {
        const spaceIdx = trimmed.indexOf(' ');
        if (spaceIdx > 0) {
          const key = trimmed.substring(1, spaceIdx);
          const value = trimmed.substring(spaceIdx + 1);
          directives[key] = value;
          lastDirectiveKey = key;
        } else {
          // `@key` with no value
          const key = trimmed.substring(1);
          directives[key] = '';
          lastDirectiveKey = key;
        }
        continue;
      }
      // Non-blank, non-@ line. If it looks like a request line, transition
      // to the request-line phase and re-process this line there. Otherwise
      // it's a continuation of the most recent directive's value.
      if (looksLikeRequestLine(trimmed)) {
        phase = 'request-line';
        // fall through to request-line block below
      } else {
        if (lastDirectiveKey) {
          directives[lastDirectiveKey] += '\n' + line;
        }
        // No prior directive to attach to → silently drop the orphan line
        // (matches old behavior of falling through to header-parsing
        // garbage; the new behavior just doesn't pollute headers/body).
        continue;
      }
    }

    if (phase === 'request-line') {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2 && HTTP_METHODS.includes(parts[0] as HttpMethod)) {
        method = parts[0] as HttpMethod;
        url = parts.slice(1).join(' ');
      } else if (parts.length === 1 && trimmed.startsWith('http')) {
        url = trimmed;
      }
      phase = 'headers';
      continue;
    }

    if (phase === 'headers') {
      if (trimmed === '') {
        phase = 'body';
        continue;
      }
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const key = trimmed.substring(0, colonIdx).trim();
        const value = trimmed.substring(colonIdx + 1).trim();
        headers[key] = value;
      }
      continue;
    }

    if (phase === 'body') {
      if (trimmed === '' && body === '') continue;
      body += (body ? '\n' : '') + line;
    }
  }

  body = body.trimEnd();

  if (directives['auth'] && directives['auth'] !== 'none') {
    const authParts = directives['auth'].split(/\s+/);
    if (authParts[0] === 'bearer' && authParts[1]) {
      headers['Authorization'] = `Bearer ${authParts[1]}`;
    } else if (authParts[0] === 'basic' && authParts[1] && authParts[2]) {
      const encoded = btoa(`${authParts[1]}:${authParts[2]}`);
      headers['Authorization'] = `Basic ${encoded}`;
    }
  }

  return { directives, method, url, headers, body, scripts };
}
