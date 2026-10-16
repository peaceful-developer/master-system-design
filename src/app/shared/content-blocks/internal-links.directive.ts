import { Location } from '@angular/common';
import { Directive, ElementRef, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Compiled content links carry `data-internal="/app/path"` (and a base-relative
 * href so they work without JavaScript) or `data-anchor="id"`. This routes them
 * through the router so the site works under any base path without reloads.
 */
@Directive({
  selector: '[appInternalLinks]',
  host: { '(click)': 'onClick($event)' },
})
export class InternalLinksDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  protected onClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest('a');
    if (!link || !this.host.nativeElement.contains(link)) return;

    const internal = link.getAttribute('data-internal');
    if (internal) {
      event.preventDefault();
      void this.router.navigateByUrl(internal);
      return;
    }

    const anchor = link.getAttribute('data-anchor');
    const target = anchor ? link.ownerDocument.getElementById(anchor) : null;
    if (anchor && target) {
      event.preventDefault();
      target.scrollIntoView({ block: 'start' });
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      this.location.replaceState(`${this.router.url.split('#')[0]}#${anchor}`);
    }
  }
}
