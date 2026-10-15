import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE_NAME, SITE_URL } from '../../site';

export interface PageSeo {
  /** Page title without the site name; omit on the home page. */
  title?: string;
  description: string;
  /** App path with a leading slash, e.g. `/learn/foundations/indexing`. */
  path: string;
}

/** Title, description, canonical URL and Open Graph tags for every page (prerendered into the HTML). */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  setPage({ title, description, path }: PageSeo): void {
    const fullTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
    const trimmed = path.replace(/^\/+|\/+$/g, '');
    const url = trimmed ? `${SITE_URL}${trimmed}/` : SITE_URL;

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });

    let canonical = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      this.document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url);
  }
}
