import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { parseImport, serializeExport } from '../../core/progress/progress-io';
import { emptyProgress, type ProgressState } from '../../core/progress/progress-model';
import { ProgressStore } from '../../core/progress/progress.store';
import { createSafeStorage, SAFE_STORAGE } from '../../core/storage/safe-storage';
import { CLOCK } from '../../core/time/clock';
import { provideTestContent } from '../../testing/content-test-data';
import { ProgressPage } from './progress.page';

const NOW = new Date('2026-10-15T09:00:00');

const IMPORTED: ProgressState = {
  ...emptyProgress(),
  completed: { 'lesson:foundations/how-the-web-works': '2026-10-01T10:00:00.000Z' },
  activityDays: ['2026-10-01'],
};

async function render() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTestContent(),
      { provide: SAFE_STORAGE, useValue: createSafeStorage(() => undefined) },
      { provide: CLOCK, useValue: () => NOW },
    ],
  });
  const fixture = TestBed.createComponent(ProgressPage);
  await fixture.whenStable();
  const store = TestBed.inject(ProgressStore);
  return { fixture, el: fixture.nativeElement as HTMLElement, store };
}

function chooseFile(el: HTMLElement, text: string) {
  const input = el.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File([text], 'progress.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');
const dialogButton = (label: string) =>
  [...(dialog()?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.includes(label));

describe('ProgressPage', () => {
  it('shows overall progress and a ring for each phase that has content', async () => {
    const { el } = await render();
    expect(el.querySelector('h1')?.textContent).toContain('Your progress');
    const rings = [...el.querySelectorAll('app-progress-ring [role="img"]')].map((r) =>
      r.getAttribute('aria-label'),
    );
    // Two lessons sharing one quiz make 3 items; the empty second phase gets no ring.
    expect(rings).toEqual(['Overall: 0 of 3 complete', 'Foundations: 0 of 3 complete']);
  });

  it('shows an error for an invalid file and keeps the current progress', async () => {
    const { el, store, fixture } = await render();
    store.setComplete('lesson:foundations/latency-numbers', true);
    const before = store.state();

    chooseFile(el, '{ not json');
    await vi.waitFor(() => expect(el.querySelector('[role="alert"]')).not.toBeNull());
    await fixture.whenStable();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('not a valid JSON file');
    expect(dialog()).toBeNull();
    expect(store.state()).toBe(before);
  });

  it('asks before replacing progress, and cancel keeps it', async () => {
    const { el, store } = await render();
    const before = store.state();

    chooseFile(el, serializeExport(IMPORTED, NOW));
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    expect(dialog()?.textContent).toContain('Replace your current progress?');

    dialogButton('Cancel')!.click();
    await vi.waitFor(() => expect(dialog()).toBeNull());
    expect(store.state()).toBe(before);
  });

  it('replaces progress when confirmed', async () => {
    const { el, store } = await render();

    chooseFile(el, serializeExport(IMPORTED, NOW));
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    dialogButton('Replace')!.click();

    await vi.waitFor(() =>
      expect(store.completed()['lesson:foundations/how-the-web-works']).toBeDefined(),
    );
    expect(store.state().activityDays).toEqual(['2026-10-01']);
  });

  it('exports progress as a dated JSON file that can be imported again', async () => {
    const { el, store } = await render();
    store.setComplete('lesson:foundations/latency-numbers', true);

    let blob: Blob | undefined;
    let fileName = '';
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blob = b as Blob;
      return 'blob:progress';
    });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      fileName = this.download;
    });

    const exportButton = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Export progress'),
    )!;
    exportButton.click();

    expect(fileName).toBe('system-design-lab-progress-2026-10-15.json');
    const parsed = parseImport(await blob!.text());
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.state.completed['lesson:foundations/latency-numbers']).toBeTruthy();

    create.mockRestore();
    revoke.mockRestore();
    click.mockRestore();
  });

  it('resets only after confirmation', async () => {
    const { el, store } = await render();
    store.setComplete('lesson:foundations/latency-numbers', true);

    const resetButton = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Reset progress'),
    )!;
    resetButton.click();
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    dialogButton('Cancel')!.click();
    await vi.waitFor(() => expect(dialog()).toBeNull());
    expect(store.completed()['lesson:foundations/latency-numbers']).toBeDefined();

    resetButton.click();
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    dialogButton('Reset')!.click();
    await vi.waitFor(() => expect(store.completed()).toEqual({}));
  });
});
