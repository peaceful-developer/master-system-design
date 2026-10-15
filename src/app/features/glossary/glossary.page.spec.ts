import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { GlossaryTerm } from '@content/types';
import { provideTestContent } from '../../testing/content-test-data';
import { GlossaryPage, groupTerms } from './glossary.page';

const term = (id: string, name: string, related?: string[]): GlossaryTerm => ({
  id,
  term: name,
  definition: `Definition of ${name}.`,
  ...(related ? { related } : {}),
});

describe('groupTerms', () => {
  it('groups terms by first letter, sorted, with symbols and digits first under #', () => {
    const groups = groupTerms([
      term('tcp', 'TCP'),
      term('api', 'API'),
      term('http-2', 'HTTP/2'),
      term('acid', 'ACID'),
      term('p99', '99th percentile'),
    ]);
    expect(groups.map((g) => [g.letter, g.terms.map((t) => t.id)])).toEqual([
      ['#', ['p99']],
      ['A', ['acid', 'api']],
      ['H', ['http-2']],
      ['T', ['tcp']],
    ]);
  });
});

describe('GlossaryPage', () => {
  it('renders each term as an anchor target with links to related terms and lessons', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTestContent({
          glossary: [term('latency', 'Latency', ['throughput']), term('throughput', 'Throughput')],
        }),
      ],
    });
    const fixture = TestBed.createComponent(GlossaryPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const latency = el.querySelector('article#latency')!;
    expect(latency.querySelector('h3')?.textContent).toBe('Latency');
    const links = [...latency.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('/glossary#throughput');
    expect(links).toContain('/learn/foundations/how-the-web-works');
    expect(el.querySelector('.az-nav a[href="/glossary#letter-l"]')).not.toBeNull();
  });
});
