import { TestBed } from '@angular/core/testing';
import { BadgeComponent } from './badge.component';

describe('BadgeComponent', () => {
  async function render(kind: string, value: string) {
    const fixture = TestBed.createComponent(BadgeComponent);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('value', value);
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ').trim();
  }

  it.each([
    ['difficulty', 'beginner', 'Beginner'],
    ['difficulty', 'advanced', 'Advanced'],
    ['status', 'outline', 'Outline'],
    ['status', 'complete', 'Complete'],
    ['track', 'A', 'Track A · Classic systems'],
    ['track', 'B', 'Track B · ML systems'],
    ['track', 'C', 'Track C · LLM & GenAI systems'],
  ])('%s %s reads as text: %s', async (kind, value, text) => {
    expect(await render(kind, value)).toBe(text);
  });
});
