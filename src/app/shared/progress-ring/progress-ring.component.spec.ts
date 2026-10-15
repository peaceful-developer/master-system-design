import { TestBed } from '@angular/core/testing';
import { ProgressRingComponent } from './progress-ring.component';

describe('ProgressRingComponent', () => {
  async function render(done: number, total: number) {
    const fixture = TestBed.createComponent(ProgressRingComponent);
    fixture.componentRef.setInput('done', done);
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('label', 'Foundations');
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it.each([
    [0, 0, 'Foundations: 0 of 0 complete', '0 / 0'],
    [3, 8, 'Foundations: 3 of 8 complete', '3 / 8'],
    [8, 8, 'Foundations: 8 of 8 complete', '8 / 8'],
  ])('%i of %i', async (done, total, label, text) => {
    const el = await render(done, total);
    expect(el.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(label);
    expect(el.textContent).toContain(text);
  });

  it('draws the arc in proportion', async () => {
    const el = await render(3, 8);
    const arc = el.querySelector<SVGCircleElement>('circle.ring-value')!;
    const dash = arc.getAttribute('stroke-dasharray')!.split(' ').map(Number);
    expect(dash[0]! / (dash[0]! + dash[1]!)).toBeCloseTo(3 / 8, 2);
  });
});
