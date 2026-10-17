import { Directive, ElementRef, inject, input, type OnChanges } from '@angular/core';

const HASH_ATTR = 'data-html-hash';

/** FNV-1a: a short, stable fingerprint of the HTML string. */
function fingerprint(html: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < html.length; i++) {
    h ^= html.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Puts `html` into `el` unless `el` already holds markup rendered from the same HTML
 * (a prerendered page being hydrated). Returns whether it wrote anything.
 */
export function applyStaticHtml(el: HTMLElement, html: string): boolean {
  const hash = fingerprint(html);
  if (el.getAttribute(HASH_ATTR) === hash && el.hasChildNodes()) return false;
  el.innerHTML = html;
  el.setAttribute(HASH_ATTR, hash);
  return true;
}

/**
 * Renders trusted, build-time HTML (compiled content) into its host. Unlike an `[innerHTML]`
 * binding, it leaves prerendered markup in place during hydration, so the browser does not
 * re-parse and repaint the whole article once the app boots.
 */
@Directive({ selector: '[appStaticHtml]' })
export class StaticHtmlDirective implements OnChanges {
  readonly appStaticHtml = input.required<string>();
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  ngOnChanges(): void {
    applyStaticHtml(this.host, this.appStaticHtml());
  }
}
