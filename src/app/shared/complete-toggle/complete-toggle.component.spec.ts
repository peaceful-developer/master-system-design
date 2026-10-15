import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProgressStore } from '../../core/progress/progress.store';
import { createSafeStorage, SAFE_STORAGE } from '../../core/storage/safe-storage';
import { CompleteToggleComponent } from './complete-toggle.component';

describe('CompleteToggleComponent', () => {
  function render() {
    TestBed.configureTestingModule({
      providers: [{ provide: SAFE_STORAGE, useValue: createSafeStorage(() => undefined) }],
    });
    const fixture = TestBed.createComponent(CompleteToggleComponent);
    fixture.componentRef.setInput('itemKey', 'lesson:foundations/indexing');
    return {
      fixture,
      el: fixture.nativeElement as HTMLElement,
      store: TestBed.inject(ProgressStore),
    };
  }

  it('renders nothing until progress has loaded', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ProgressStore,
          useValue: { ready: signal(false), isComplete: () => false, setComplete: vi.fn() },
        },
      ],
    });
    const fixture = TestBed.createComponent(CompleteToggleComponent);
    fixture.componentRef.setInput('itemKey', 'lesson:foundations/indexing');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });

  it('toggles completion with aria-pressed', async () => {
    const { fixture, el, store } = render();
    await fixture.whenStable();
    const button = el.querySelector('button')!;
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.textContent).toContain('Mark as complete');

    button.click();
    await fixture.whenStable();
    expect(store.isComplete('lesson:foundations/indexing')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent).toContain('Completed');
  });
});
