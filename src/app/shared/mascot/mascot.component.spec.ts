import { TestBed } from '@angular/core/testing';
import { emptyProgress, PROGRESS_KEY } from '../../core/progress/progress-model';
import { createSafeStorage, SAFE_STORAGE } from '../../core/storage/safe-storage';
import { MascotComponent } from './mascot.component';
import type { MascotPose } from '@generated/mascot';

async function render(
  pose: MascotPose,
  opts: { calm?: boolean; line?: string; feedback?: boolean } = {},
) {
  const storage = createSafeStorage(() => undefined);
  storage.set(
    PROGRESS_KEY,
    JSON.stringify({ ...emptyProgress(), prefs: { learnerLevel: null, calmMode: !!opts.calm } }),
  );
  TestBed.configureTestingModule({ providers: [{ provide: SAFE_STORAGE, useValue: storage }] });
  const fixture = TestBed.createComponent(MascotComponent);
  fixture.componentRef.setInput('pose', pose);
  if (opts.line) fixture.componentRef.setInput('line', opts.line);
  if (opts.feedback) fixture.componentRef.setInput('feedback', true);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('MascotComponent', () => {
  it('shows the pose with an optional caption', async () => {
    const el = await render('cheer', { line: 'Nicely done!' });
    expect(el.getAttribute('data-pose')).toBe('cheer');
    expect(el.querySelector('.mascot-art')).not.toBeNull();
    expect(el.querySelector('.mascot-line')?.textContent?.trim()).toBe('Nicely done!');
    expect(el.querySelector('.mascot-line')?.getAttribute('aria-live')).toBeNull();
  });

  it('announces the caption politely when used for feedback', async () => {
    const el = await render('puzzled', { line: 'Have another look.', feedback: true });
    expect(el.querySelector('.mascot-line')?.getAttribute('aria-live')).toBe('polite');
  });

  it('stays out of the way in Calm mode', async () => {
    const el = await render('cheer', { calm: true, line: 'Nicely done!' });
    expect(el.getAttribute('data-pose')).toBeNull();
    expect(el.children.length).toBe(0);
  });

  it('still shows the poses that carry information (404, empty states) in Calm mode', async () => {
    const el = await render('fly', { calm: true });
    expect(el.getAttribute('data-pose')).toBe('fly');
    expect(el.querySelector('.mascot-art')).not.toBeNull();
  });
});
