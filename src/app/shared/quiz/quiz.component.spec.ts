import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { REDUCED_MOTION } from '../../core/a11y/reduced-motion';
import { emptyProgress, PROGRESS_KEY } from '../../core/progress/progress-model';
import { ProgressStore } from '../../core/progress/progress.store';
import { createSafeStorage, SAFE_STORAGE } from '../../core/storage/safe-storage';
import { TEST_QUIZ } from '../../testing/content-test-data';
import { QuizComponent } from './quiz.component';

describe('QuizComponent', () => {
  async function render() {
    TestBed.configureTestingModule({
      providers: [{ provide: SAFE_STORAGE, useValue: createSafeStorage(() => undefined) }],
    });
    const store = TestBed.inject(ProgressStore);
    const record = vi.spyOn(store, 'recordQuiz');
    const fixture = TestBed.createComponent(QuizComponent);
    fixture.componentRef.setInput('quiz', TEST_QUIZ);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const pick = async (questionIndex: number, optionId: string) => {
      const fieldset = el.querySelectorAll('fieldset')[questionIndex]!;
      fieldset.querySelector<HTMLInputElement>(`input[value="${optionId}"]`)!.click();
      await fixture.whenStable();
    };
    const submit = () => el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    return { fixture, el, record, pick, submit };
  }

  it('keeps the options disabled until saved progress has loaded', async () => {
    // A prerendered quiz looks usable before the app boots; answers picked then would be wiped
    // when it takes over, so options stay disabled until the store is ready.
    TestBed.configureTestingModule({
      providers: [{ provide: SAFE_STORAGE, useValue: createSafeStorage(() => undefined) }],
    });
    const ready = signal(false);
    Object.defineProperty(TestBed.inject(ProgressStore), 'ready', { value: ready });
    const fixture = TestBed.createComponent(QuizComponent);
    fixture.componentRef.setInput('quiz', TEST_QUIZ);
    await fixture.whenStable();
    const inputs = [...(fixture.nativeElement as HTMLElement).querySelectorAll('input')];
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((i) => i.disabled)).toBe(true);

    ready.set(true);
    await fixture.whenStable();
    expect(inputs.every((i) => !i.disabled)).toBe(true);
  });

  it('renders each question as a labelled group with its level', async () => {
    const { el } = await render();
    const fieldsets = el.querySelectorAll('fieldset');
    expect(fieldsets).toHaveLength(2);
    expect(fieldsets[0]!.querySelector('legend')!.textContent).toContain(
      'What does latency measure?',
    );
    expect(fieldsets[0]!.textContent).toContain('Beginner');
    expect(fieldsets[0]!.querySelectorAll('input[type="radio"]')).toHaveLength(2);
    expect(fieldsets[1]!.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    expect(fieldsets[1]!.textContent).toContain('Select all that apply');
  });

  it('only lets you check once every question has an answer', async () => {
    const { pick, submit, el } = await render();
    expect(submit().disabled).toBe(true);
    expect(el.textContent).toContain('0 of 2 answered');
    await pick(0, 'a');
    expect(submit().disabled).toBe(true);
    await pick(1, 'p99');
    expect(submit().disabled).toBe(false);
  });

  it('reveals explanations and the score after checking, and records it', async () => {
    const { fixture, el, pick, submit, record } = await render();
    expect(el.textContent).not.toContain('Latency is how long you wait.');
    await pick(0, 'a');
    await pick(1, 'p99');
    await pick(1, 'p999');
    submit().click();
    await fixture.whenStable();
    expect(el.textContent).toContain('Latency is how long you wait.');
    expect(el.textContent).toContain('2 of 2 correct');
    expect(record).toHaveBeenCalledWith('demo-quiz', 2, 2);
  });

  it('marks wrong answers and shows the correct ones in words', async () => {
    const { fixture, el, pick, submit } = await render();
    await pick(0, 'b');
    await pick(1, 'p50');
    submit().click();
    await fixture.whenStable();
    const feedback = [...el.querySelectorAll('.quiz-feedback')].map((f) => f.textContent);
    expect(feedback[0]).toContain('Incorrect');
    expect(el.querySelectorAll('.quiz-answer-mark')[0]!.textContent).toContain('Correct answer');
    expect(el.textContent).toContain('0 of 2 correct');
  });

  it('toggles hints with aria-expanded', async () => {
    const { fixture, el } = await render();
    const hint = el.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    expect(hint.getAttribute('aria-expanded')).toBe('false');
    hint.click();
    await fixture.whenStable();
    expect(hint.getAttribute('aria-expanded')).toBe('true');
    expect(el.textContent).toContain('Think about waiting.');
  });

  it('starts over with Try again', async () => {
    const { fixture, el, pick, submit } = await render();
    await pick(0, 'a');
    await pick(1, 'p99');
    submit().click();
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('button.quiz-retry')!.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('input:checked')).toHaveLength(0);
    expect(submit().disabled).toBe(true);
  });
});

describe('QuizComponent celebrations', () => {
  async function answerAll(opts: { calm?: boolean; reducedMotion?: boolean; correct: boolean }) {
    const storage = createSafeStorage(() => undefined);
    storage.set(
      PROGRESS_KEY,
      JSON.stringify({ ...emptyProgress(), prefs: { learnerLevel: null, calmMode: !!opts.calm } }),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: SAFE_STORAGE, useValue: storage },
        { provide: REDUCED_MOTION, useValue: () => !!opts.reducedMotion },
      ],
    });
    const fixture = TestBed.createComponent(QuizComponent);
    fixture.componentRef.setInput('quiz', TEST_QUIZ);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const click = async (q: number, option: string) => {
      const fieldset = el.querySelectorAll('fieldset')[q]!;
      fieldset.querySelector<HTMLInputElement>(`input[value="${option}"]`)!.click();
      await fixture.whenStable();
    };
    await click(0, opts.correct ? 'a' : 'b');
    await click(1, 'p99');
    await click(1, 'p999');
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    return el;
  }

  it('cheers and bursts feathers after a perfect score', async () => {
    const el = await answerAll({ correct: true });
    expect(el.querySelector('app-mascot')?.getAttribute('data-pose')).toBe('cheer');
    expect(el.querySelector('.feather-burst')).not.toBeNull();
  });

  it('encourages without celebrating after a miss', async () => {
    const el = await answerAll({ correct: false });
    expect(el.querySelector('app-mascot')?.getAttribute('data-pose')).toBe('puzzled');
    expect(el.querySelector('.feather-burst')).toBeNull();
  });

  it('skips the feather burst when reduced motion is preferred', async () => {
    const el = await answerAll({ correct: true, reducedMotion: true });
    expect(el.querySelector('app-mascot')?.getAttribute('data-pose')).toBe('cheer');
    expect(el.querySelector('.feather-burst')).toBeNull();
  });

  it('shows neither mascot nor burst in Calm mode', async () => {
    const el = await answerAll({ correct: true, calm: true });
    expect(el.querySelector('app-mascot[data-pose]')).toBeNull();
    expect(el.querySelector('.feather-burst')).toBeNull();
    expect(el.textContent).toContain('2 of 2 correct');
  });
});
