import type { IvkEnvironment, InvokerSettings } from '../types';

export class EnvManager {
  private runtimeVars: Record<string, string> = {};
  private collectionVars: Record<string, string> = {};
  private saveCallback: (() => Promise<void>) | null = null;
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private getSettings: () => InvokerSettings) {}

  setSaveCallback(callback: () => Promise<void>): void {
    this.saveCallback = callback;
  }

  getActiveEnv(): IvkEnvironment | null {
    const settings = this.getSettings();
    return settings.environments[settings.activeEnvironmentIndex] ?? null;
  }

  get(name: string): string | undefined {
    return (
      this.runtimeVars[name] ?? this.getActiveEnv()?.variables[name] ?? this.collectionVars[name]
    );
  }

  set(name: string, value: string): void {
    this.runtimeVars[name] = value;
    const env = this.getActiveEnv();
    if (env) {
      env.variables[name] = value;
    }
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (!this.saveCallback) return;
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      void this.saveCallback?.();
      this.saveDebounceTimer = null;
    }, 300);
  }

  setCollectionVars(vars: Record<string, string>): void {
    this.collectionVars = { ...vars };
  }

  clearRuntime(): void {
    this.runtimeVars = {};
  }

  resolveVariables(text: string): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, name) => {
      const value = this.get(name);
      return value !== undefined ? value : match;
    });
  }

  getAllVariables(): Record<string, string> {
    return {
      ...this.collectionVars,
      ...(this.getActiveEnv()?.variables ?? {}),
      ...this.runtimeVars,
    };
  }
}
