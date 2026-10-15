import MiniSearch from 'minisearch';
import type { SearchDoc, SearchKind } from '../content-types';
import { SEARCH_OPTIONS } from '../search-options';
import type { DocItem, LoadedContent } from './load';
import { routeFor } from './routes';

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function docEntry(
  kind: SearchKind,
  url: string,
  item: DocItem<{ title: string; summary: string }>,
): SearchDoc {
  return {
    id: url,
    url,
    kind,
    title: item.data.title,
    summary: item.data.summary,
    headings: item.doc.headings.map((h) => h.text).join(' · '),
    text: item.text,
  };
}

/** One search document per page, exercise and glossary term, in a stable order. */
export function searchDocs(c: LoadedContent): SearchDoc[] {
  const docs: SearchDoc[] = [
    ...c.lessons.map((l) =>
      docEntry('lesson', routeFor({ kind: 'lesson', phase: l.data.phase, slug: l.data.slug }), l),
    ),
    ...c.caseStudies.map((s) =>
      docEntry('case-study', routeFor({ kind: 'case-study', slug: s.data.slug }), s),
    ),
    ...c.playbooks.map((p) =>
      docEntry('playbook', routeFor({ kind: 'playbook', slug: p.data.slug }), p),
    ),
    ...c.examples.map((e) =>
      docEntry('example', routeFor({ kind: 'example', slug: e.data.slug }), e),
    ),
    ...c.quizzes.map((q) => {
      const url = routeFor({ kind: 'exercise', id: q.data.id });
      return {
        id: url,
        url,
        kind: 'exercise' as const,
        title: q.data.title,
        summary: `Quiz · ${q.data.questions.length} questions`,
        headings: '',
        text: q.data.questions.map((x) => x.prompt).join(' '),
      };
    }),
    ...c.drills.map((d) => {
      const url = routeFor({ kind: 'exercise', id: d.data.id });
      return {
        id: url,
        url,
        kind: 'exercise' as const,
        title: d.data.title,
        summary: `Estimation drill · ${d.data.questions.length} answers`,
        headings: '',
        text: stripHtml(d.scenarioHtml),
      };
    }),
    ...(c.glossary?.data.terms ?? []).map((t) => {
      const url = `/glossary#${t.id}`;
      return {
        id: url,
        url,
        kind: 'glossary' as const,
        title: t.term,
        summary: t.definition,
        headings: '',
        text: (t.aliases ?? []).join(' '),
      };
    }),
  ];
  return docs.sort((a, b) => a.id.localeCompare(b.id));
}

export function buildSearchIndex(docs: SearchDoc[]): string {
  const index = new MiniSearch<SearchDoc>(SEARCH_OPTIONS);
  index.addAll(docs);
  return JSON.stringify(index);
}
