import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Heading } from '@content/types';
import { TocComponent } from './toc.component';

type ObserverCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let observerCallback: ObserverCallback | undefined;

class FakeIntersectionObserver {
  constructor(callback: ObserverCallback) {
    observerCallback = callback;
  }
  observe = vi.fn();
  disconnect = vi.fn();
}

@Component({
  imports: [TocComponent],
  template: `<app-toc [headings]="headings()" />`,
})
class HostComponent {
  readonly headings = signal<Heading[]>([
    { id: 'a', text: 'First', depth: 2 },
    { id: 'b', text: 'Second', depth: 2 },
    { id: 'b-detail', text: 'Detail', depth: 3 },
  ]);
}

describe('TocComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    for (const id of ['a', 'b', 'b-detail']) {
      const h = document.createElement('h2');
      h.id = id;
      document.body.appendChild(h);
    }
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.querySelectorAll('h2').forEach((h) => h.remove());
  });

  async function render() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('lists every heading as an in-page link, nesting h3s', async () => {
    const { el } = await render();
    const links = [...el.querySelectorAll('nav a')];
    expect(links.map((a) => a.textContent?.trim())).toEqual(['First', 'Second', 'Detail']);
    expect(links[0]!.getAttribute('href')).toBe('/#a');
    expect(links[2]!.classList.contains('toc-h3')).toBe(true);
    expect(el.querySelector('nav')?.getAttribute('aria-label')).toBe('On this page');
  });

  it('marks the heading currently in view', async () => {
    const { el, fixture } = await render();
    observerCallback!([{ target: document.getElementById('b')!, isIntersecting: true }]);
    await fixture.whenStable();
    const current = el.querySelector('[aria-current="location"]');
    expect(current?.textContent?.trim()).toBe('Second');
  });

  it('renders nothing when there are fewer than two headings', async () => {
    const { el, fixture } = await render();
    fixture.componentInstance.headings.set([{ id: 'a', text: 'Only', depth: 2 }]);
    await fixture.whenStable();
    expect(el.querySelector('nav')).toBeNull();
  });
});
