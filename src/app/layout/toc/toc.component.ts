import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Heading } from '@content/types';

/** "On this page" links with scroll-spy (browser only; prerendered as plain links). */
@Component({
  selector: 'app-toc',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (headings().length > 1) {
      <nav aria-label="On this page" class="text-sm">
        <p class="mb-2 font-semibold">On this page</p>
        <ul class="border-l border-rule">
          @for (h of headings(); track h.id) {
            <li>
              <a
                class="toc-link"
                [class.toc-h3]="h.depth === 3"
                [routerLink]="[]"
                [fragment]="h.id"
                [attr.aria-current]="active() === h.id ? 'location' : null"
                >{{ h.text }}</a
              >
            </li>
          }
        </ul>
      </nav>
    }
  `,
})
export class TocComponent {
  readonly headings = input.required<Heading[]>();
  protected readonly active = signal<string | null>(null);

  private readonly document = inject(DOCUMENT);
  private readonly rendered = signal(false);
  private observer?: IntersectionObserver;
  private readonly visible = new Set<string>();

  constructor() {
    afterNextRender(() => this.rendered.set(true));
    effect(() => {
      const headings = this.headings();
      if (this.rendered()) untracked(() => this.observe(headings));
    });
    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }

  private observe(headings: Heading[]): void {
    this.observer?.disconnect();
    this.visible.clear();
    if (typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id;
          if (entry.isIntersecting) this.visible.add(id);
          else this.visible.delete(id);
        }
        const first = this.headings().find((h) => this.visible.has(h.id));
        if (first) this.active.set(first.id);
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    for (const h of headings) {
      const el = this.document.getElementById(h.id);
      if (el) this.observer.observe(el);
    }
  }
}
