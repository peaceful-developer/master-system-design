import { inject, Pipe, type PipeTransform } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

/**
 * Marks HTML as trusted. Only for content compiled and sanitized at build time
 * from this repository (raw HTML in Markdown is rejected by the build).
 */
@Pipe({ name: 'trustedHtml' })
export class TrustedHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
