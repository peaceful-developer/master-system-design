import { TestBed } from '@angular/core/testing';
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
