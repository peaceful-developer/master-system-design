import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { SITE_NAME, SITE_URL } from '../../site';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  const head = () => TestBed.inject(DOCUMENT).head;
  const meta = (attr: string, name: string) =>
    head().querySelector(`meta[${attr}="${name}"]`)?.getAttribute('content');

  afterEach(() =>
    head()
      .querySelectorAll('link[rel="canonical"]')
      .forEach((l) => l.remove()),
  );

  it('sets the title, description, canonical URL and Open Graph tags', () => {
    TestBed.inject(SeoService).setPage({
      title: 'Indexing',
      description: 'How indexes speed up reads.',
      path: '/learn/foundations/indexing',
    });
    expect(TestBed.inject(Title).getTitle()).toBe(`Indexing · ${SITE_NAME}`);
    expect(meta('name', 'description')).toBe('How indexes speed up reads.');
    expect(meta('property', 'og:title')).toBe(`Indexing · ${SITE_NAME}`);
    expect(meta('property', 'og:url')).toBe(`${SITE_URL}learn/foundations/indexing/`);
    const canonical = head().querySelectorAll('link[rel="canonical"]');
    expect(canonical).toHaveLength(1);
    expect(canonical[0]!.getAttribute('href')).toBe(`${SITE_URL}learn/foundations/indexing/`);
  });

  it('uses just the site name on the home page and updates instead of duplicating', () => {
    const seo = TestBed.inject(SeoService);
    seo.setPage({ title: 'X', description: 'x', path: '/x' });
    seo.setPage({ description: 'Home page.', path: '/' });
    expect(TestBed.inject(Title).getTitle()).toBe(SITE_NAME);
    const canonical = head().querySelectorAll('link[rel="canonical"]');
    expect(canonical).toHaveLength(1);
    expect(canonical[0]!.getAttribute('href')).toBe(SITE_URL);
  });
});
