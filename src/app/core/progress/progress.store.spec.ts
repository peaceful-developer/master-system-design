import { TestBed } from '@angular/core/testing';
import { createSafeStorage, SAFE_STORAGE, type KeyValueStorage } from '../storage/safe-storage';
import { CLOCK } from '../time/clock';
import { PROGRESS_KEY, emptyProgress } from './progress-model';
import { ProgressStore } from './progress.store';

let now = new Date('2026-10-15T09:00:00');

function setup(initial?: unknown, storage: KeyValueStorage = createSafeStorage(() => undefined)) {
  if (initial !== undefined) storage.set(PROGRESS_KEY, JSON.stringify(initial));
  TestBed.configureTestingModule({
    providers: [
      { provide: SAFE_STORAGE, useValue: storage },
      { provide: CLOCK, useValue: () => now },
    ],
  });
  const store = TestBed.inject(ProgressStore);
  return { store, storage };
}

const ready = (store: ProgressStore) => {
  TestBed.tick();
  expect(store.ready()).toBe(true);
};

describe('ProgressStore', () => {
  beforeEach(() => {
    now = new Date('2026-10-15T09:00:00');
  });

  it('is not ready (and shows nothing) until after the first render', () => {
    const { store } = setup({ ...emptyProgress(), completed: { 'lesson:a/b': 'x' } });
    expect(store.ready()).toBe(false);
    expect(store.isComplete('lesson:a/b')).toBe(false);
    ready(store);
    expect(store.isComplete('lesson:a/b')).toBe(true);
  });

  it('marks items complete and persists them', () => {
    const { store, storage } = setup();
    ready(store);
    store.setComplete('lesson:foundations/indexing', true);
    expect(store.isComplete('lesson:foundations/indexing')).toBe(true);
    expect(JSON.parse(storage.get(PROGRESS_KEY)!).completed).toHaveProperty(
      'lesson:foundations/indexing',
    );
    store.setComplete('lesson:foundations/indexing', false);
    expect(store.isComplete('lesson:foundations/indexing')).toBe(false);
  });

  it('records one activity day per local day', () => {
    const { store } = setup();
    ready(store);
    store.setComplete('lesson:a/b', true);
    now = new Date('2026-10-15T21:00:00');
    store.setComplete('lesson:a/c', true);
    expect(store.state().activityDays).toEqual(['2026-10-15']);
    now = new Date('2026-10-16T08:00:00');
    store.recordDrill('d', 0, 2);
    expect(store.state().activityDays).toEqual(['2026-10-15', '2026-10-16']);
  });

  it('auto-completes a quiz exercise at 70% and keeps the best score', () => {
    const { store } = setup();
    ready(store);
    store.recordQuiz('q', 6, 10);
    expect(store.isComplete('exercise:q')).toBe(false);
    store.recordQuiz('q', 7, 10);
    expect(store.isComplete('exercise:q')).toBe(true);
    store.recordQuiz('q', 2, 10);
    expect(store.state().quizScores['q']).toMatchObject({ best: 7, total: 10 });
  });

  it('auto-completes a drill only when every answer is right', () => {
    const { store } = setup();
    ready(store);
    store.recordDrill('d', 1, 2);
    expect(store.isComplete('exercise:d')).toBe(false);
    store.recordDrill('d', 2, 2);
    expect(store.isComplete('exercise:d')).toBe(true);
    expect(store.state().drillAttempts['d']).toMatchObject({ bestCorrect: 2, total: 2 });
  });

  it('persists preferences and seen achievements', () => {
    const { store, storage } = setup();
    ready(store);
    store.setPrefs({ calmMode: true });
    store.markAchievementsSeen(['first-flight', 'first-flight']);
    const saved = JSON.parse(storage.get(PROGRESS_KEY)!);
    expect(saved.prefs).toEqual({ learnerLevel: null, calmMode: true });
    expect(saved.seenAchievements).toEqual(['first-flight']);
  });

  it('never overwrites data written by a newer version of the app', () => {
    const storage = createSafeStorage(() => undefined);
    const set = vi.spyOn(storage, 'set');
    const { store } = setup({ version: 9, anything: true }, storage);
    set.mockClear();
    ready(store);
    store.setComplete('lesson:a/b', true);
    expect(set).not.toHaveBeenCalled();
    expect(storage.get(PROGRESS_KEY)).toBe(JSON.stringify({ version: 9, anything: true }));
  });

  it('starts fresh when the stored value is corrupted', () => {
    const storage = createSafeStorage(() => undefined);
    storage.set(PROGRESS_KEY, '{not json');
    const { store } = setup(undefined, storage);
    ready(store);
    expect(store.state()).toEqual(emptyProgress());
  });

  it('replaces, resets and exports', () => {
    const { store } = setup();
    ready(store);
    store.replaceAll({ ...emptyProgress(), completed: { 'case-study:url-shortener': 'x' } });
    expect(store.isComplete('case-study:url-shortener')).toBe(true);
    expect(JSON.parse(store.exportJson()).progress.completed).toHaveProperty(
      'case-study:url-shortener',
    );
    store.reset();
    expect(store.state()).toEqual(emptyProgress());
  });

  it('picks up changes made in another tab', () => {
    const { store, storage } = setup();
    ready(store);
    storage.set(
      PROGRESS_KEY,
      JSON.stringify({ ...emptyProgress(), completed: { 'lesson:x/y': 'z' } }),
    );
    window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_KEY }));
    expect(store.isComplete('lesson:x/y')).toBe(true);
  });
});
