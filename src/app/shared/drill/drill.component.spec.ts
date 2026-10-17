import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProgressStore } from '../../core/progress/progress.store';
import { createSafeStorage, SAFE_STORAGE } from '../../core/storage/safe-storage';
import { TEST_DRILL } from '../../testing/content-test-data';
import { DrillComponent } from './drill.component';

describe('DrillComponent', () => {
  async function render() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SAFE_STORAGE, useValue: createSafeStorage(() => undefined) },
      ],
    });
    const record = vi.spyOn(TestBed.inject(ProgressStore), 'recordDrill');
    const fixture = TestBed.createComponent(DrillComponent);
    fixture.componentRef.setInput('drill', TEST_DRILL);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const type = async (index: number, value: string) => {
      const input = el.querySelectorAll<HTMLInputElement>('input')[index]!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const checkButton = () => el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const check = async () => {
      checkButton().click();
      await fixture.whenStable();
    };
    return { el, record, type, check, checkButton };
  }

  it('keeps the inputs disabled until saved progress has loaded', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SAFE_STORAGE, useValue: createSafeStorage(() => undefined) },
      ],
    });
    const ready = signal(false);
    Object.defineProperty(TestBed.inject(ProgressStore), 'ready', { value: ready });
    const fixture = TestBed.createComponent(DrillComponent);
    fixture.componentRef.setInput('drill', TEST_DRILL);
    await fixture.whenStable();
    const inputs = [...(fixture.nativeElement as HTMLElement).querySelectorAll('input')];
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((i) => i.disabled)).toBe(true);

    ready.set(true);
    await fixture.whenStable();
    expect(inputs.every((i) => !i.disabled)).toBe(true);
  });

  it('shows the scenario, the givens and a labelled input per question', async () => {
    const { el } = await render();
    expect(el.textContent).toContain('10 million users make 20 requests a day.');
    expect(el.querySelector('table')!.textContent).toContain('10,000,000');
    const inputs = el.querySelectorAll('input');
    expect(inputs).toHaveLength(2);
    const label = el.querySelector(`label[for="${inputs[0]!.id}"]`)!;
    expect(label.textContent).toContain('Average requests per second');
    expect(label.textContent).toContain('req/s');
    expect(inputs[0]!.getAttribute('inputmode')).toBe('decimal');
  });

  it('explains unreadable numbers inline and blocks checking', async () => {
    const { el, type, checkButton } = await render();
    await type(0, '1.2.3');
    await type(1, '7k');
    const input = el.querySelectorAll('input')[0]!;
    const error = el.querySelector(
      `#${input.getAttribute('aria-describedby')!.split(' ').at(-1)}`,
    )!;
    expect(error.textContent).toContain('Couldn’t read “1.2.3” as a number. Try 1.2M or 1200000.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(checkButton().disabled).toBe(true);
  });

  it('hides the solution until you check', async () => {
    const { el, type, check } = await render();
    expect(el.textContent).not.toContain('200M ÷ 86,400');
    await type(0, '2,400');
    await type(1, '7k');
    await check();
    expect(el.textContent).toContain('200M ÷ 86,400');
  });

  it('accepts answers within tolerance and records the result', async () => {
    const { el, type, check, record } = await render();
    await type(0, '2.4k');
    await type(1, '10000');
    await check();
    const feedback = [...el.querySelectorAll('.drill-feedback')].map((f) => f.textContent!);
    expect(feedback[0]).toContain('Correct');
    expect(feedback[0]).toContain('4% high');
    expect(feedback[1]).toContain('Correct');
    expect(record).toHaveBeenCalledWith('demo-drill', 2, 2);
  });

  it('shows the expected value when an answer is off', async () => {
    const { el, type, check, record } = await render();
    await type(0, '10000');
    await type(1, '7000');
    await check();
    const first = el.querySelector('.drill-feedback')!.textContent!;
    expect(first).toContain('Not quite');
    expect(first).toContain('2,315 req/s');
    expect(record).toHaveBeenCalledWith('demo-drill', 1, 2);
  });
});
