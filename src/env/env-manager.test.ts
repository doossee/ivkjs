import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvManager } from './env-manager';
import type { InvokerSettings } from '../types';

function makeSettings(): InvokerSettings {
  return {
    environments: [
      { name: 'dev', variables: { baseUrl: 'http://localhost:8080' } },
      { name: 'stage', variables: { baseUrl: 'https://stage.example.com', token: 'xyz' } },
    ],
    activeEnvironmentIndex: 0,
    timeout: 30000,
  };
}

describe('EnvManager', () => {
  let settings: InvokerSettings;
  let env: EnvManager;

  beforeEach(() => {
    settings = makeSettings();
    env = new EnvManager(() => settings);
  });

  it('returns the active environment', () => {
    expect(env.getActiveEnv()?.name).toBe('dev');
    settings.activeEnvironmentIndex = 1;
    expect(env.getActiveEnv()?.name).toBe('stage');
  });

  it('get() returns active env variables', () => {
    expect(env.get('baseUrl')).toBe('http://localhost:8080');
  });

  it('get() returns undefined for unknown variables', () => {
    expect(env.get('missing')).toBeUndefined();
  });

  it('set() persists to active environment', () => {
    env.set('phone', '998901234567');
    expect(settings.environments[0]!.variables['phone']).toBe('998901234567');
    expect(env.get('phone')).toBe('998901234567');
  });

  it('resolution priority: runtime > active env > collection', () => {
    env.setCollectionVars({ baseUrl: 'https://collection.example.com', extra: 'c' });
    // Active env overrides collection
    expect(env.get('baseUrl')).toBe('http://localhost:8080');
    // Collection supplies unset values
    expect(env.get('extra')).toBe('c');
    // Runtime overrides both
    env.set('baseUrl', 'https://runtime.example.com');
    expect(env.get('baseUrl')).toBe('https://runtime.example.com');
  });

  it('resolveVariables replaces {{name}} with values', () => {
    const out = env.resolveVariables('{{baseUrl}}/api/path');
    expect(out).toBe('http://localhost:8080/api/path');
  });

  it('resolveVariables leaves unknown vars as literal {{name}}', () => {
    const out = env.resolveVariables('{{missing}}/path');
    expect(out).toBe('{{missing}}/path');
  });

  it('clearRuntime removes runtime-only values', () => {
    env.set('phone', '998');
    env.clearRuntime();
    // Note: set() also writes to active env; runtime clear leaves it in active env
    expect(env.get('phone')).toBe('998');
  });

  it('setSaveCallback fires on set() (debounced)', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    env.setSaveCallback(save);

    env.set('a', '1');
    env.set('b', '2');
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    expect(save).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('getAllVariables merges collection < active < runtime', () => {
    env.setCollectionVars({ a: 'c', b: 'c' });
    env.set('b', 'runtime');
    const all = env.getAllVariables();
    expect(all.a).toBe('c');
    expect(all.b).toBe('runtime');
    expect(all.baseUrl).toBe('http://localhost:8080');
  });
});
