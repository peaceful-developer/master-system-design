import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { InternalLinksDirective } from './internal-links.directive';

@Component({
  imports: [InternalLinksDirective],
  template: `
    <div appInternalLinks>
      <a id="term" href="glossary#cap-theorem" data-internal="/glossary#cap-theorem"
        ><span>CAP</span></a
      >
      <a id="anchor" href="#budgets" data-anchor="budgets">Budgets</a>
      <a id="external" href="https://example.org">Out</a>
      <h2 id="budgets">Budgets</h2>
    </div>
  `,
})
class HostComponent {}

describe('InternalLinksDirective', () => {
  async function setup() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const click = (selector: string, init: MouseEventInit = {}) => {
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...init,
      });
      el.querySelector(selector)!.dispatchEvent(event);
      return event;
    };
    return { el, navigate, click };
  }

  it('routes internal links through the router (keeps the base path, no reload)', async () => {
    const { navigate, click } = await setup();
    const event = click('#term span');
    expect(event.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/glossary#cap-theorem');
  });

  it('leaves modified clicks to the browser (open in new tab)', async () => {
    const { navigate, click } = await setup();
    const event = click('#term', { ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('scrolls to in-page anchors and moves focus there', async () => {
    const { el, click } = await setup();
    const heading = el.querySelector<HTMLElement>('#budgets')!;
    heading.scrollIntoView = vi.fn();
    const event = click('#anchor');
    expect(event.defaultPrevented).toBe(true);
    expect(heading.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(heading);
  });

  it('ignores external links', async () => {
    const { navigate, click } = await setup();
    const event = click('#external');
    expect(event.defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
