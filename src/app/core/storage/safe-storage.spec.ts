import { createSafeStorage } from './safe-storage';

function fakeStorage(overrides: Partial<Storage> = {}): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
    ...overrides,
  } as Storage;
}

describe('createSafeStorage', () => {
  it('reads and writes through to the backing storage', () => {
    const backing = fakeStorage();
    const storage = createSafeStorage(() => backing);
    expect(storage.set('k', 'v')).toBe(true);
    expect(backing.getItem('k')).toBe('v');
    expect(storage.get('k')).toBe('v');
  });

  it('falls back to memory when there is no backing storage (SSR)', () => {
    const storage = createSafeStorage(() => undefined);
    expect(storage.set('k', 'v')).toBe(true);
    expect(storage.get('k')).toBe('v');
  });

  it('falls back to memory when accessing storage throws (privacy mode)', () => {
    const storage = createSafeStorage(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(storage.set('k', 'v')).toBe(true);
    expect(storage.get('k')).toBe('v');
  });

  it('falls back to memory when getItem throws', () => {
    const storage = createSafeStorage(() =>
      fakeStorage({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    );
    expect(storage.get('k')).toBeNull();
    storage.set('k', 'v');
    expect(storage.get('k')).toBe('v');
  });

  it('reports a failed write (quota) but keeps the value readable', () => {
    const storage = createSafeStorage(() =>
      fakeStorage({
        setItem: () => {
          throw new DOMException('full', 'QuotaExceededError');
        },
      }),
    );
    expect(storage.set('k', 'v')).toBe(false);
    expect(storage.get('k')).toBe('v');
  });

  it('removes values', () => {
    const storage = createSafeStorage(() => fakeStorage());
    storage.set('k', 'v');
    storage.remove('k');
    expect(storage.get('k')).toBeNull();
  });
});
