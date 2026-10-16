import { TestBed } from '@angular/core/testing';
import { emptyProgress, PROGRESS_KEY } from '../progress/progress-model';
import { createSafeStorage, SAFE_STORAGE } from '../storage/safe-storage';
import { provideTestContent } from '../../testing/content-test-data';
import { GameStore } from './game.store';

function setup() {
  const storage = createSafeStorage(() => undefined);
  storage.set(
    PROGRESS_KEY,
    JSON.stringify({
      ...emptyProgress(),
      completed: { 'lesson:foundations/latency-numbers': '2026-10-15T09:00:00.000Z' },
    }),
  );
  TestBed.configureTestingModule({
    providers: [provideTestContent(), { provide: SAFE_STORAGE, useValue: storage }],
  });
  return TestBed.inject(GameStore);
}

/** Node's process, reached without adding Node types to the browser test config. */
const nodeProcess = (
  globalThis as unknown as {
    process: {
      on(event: 'unhandledRejection', fn: (reason: unknown) => void): void;
      off(event: 'unhandledRejection', fn: (reason: unknown) => void): void;
    };
  }
).process;

describe('GameStore', () => {
  it('derives XP once progress and content metadata have loaded', async () => {
    const game = setup();
    expect(game.active()).toBe(false);
    TestBed.tick();
    await vi.waitFor(() => expect(game.active()).toBe(true));
    expect(game.xp()).toBe(20);
  });

  it('stops quietly when the app is torn down while metadata is still loading', async () => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    nodeProcess.on('unhandledRejection', onRejection);
    try {
      setup();
      TestBed.tick(); // progress becomes ready, metadata starts loading
      TestBed.resetTestingModule(); // the injector is destroyed mid-load
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(rejections).toEqual([]);
    } finally {
      nodeProcess.off('unhandledRejection', onRejection);
    }
  });
});
