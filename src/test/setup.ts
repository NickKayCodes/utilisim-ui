import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

/**
 * Node 25 exposes its own experimental Web Storage global, which shadows the
 * jsdom implementation inside Vitest. Install a small deterministic Storage
 * shim so tests do not depend on the Node flag.
 */
class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function installStorage(name: 'localStorage' | 'sessionStorage') {
  const storage = new MemoryStorage();
  Object.defineProperty(window, name, { value: storage, configurable: true });
  Object.defineProperty(globalThis, name, { value: storage, configurable: true });
}

installStorage('localStorage');
installStorage('sessionStorage');

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});
