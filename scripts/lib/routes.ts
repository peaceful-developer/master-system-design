import type { LoadedContent } from './load';

export type RoutableItem =
  | { kind: 'lesson'; phase: string; slug: string }
  | { kind: 'case-study' | 'playbook' | 'example'; slug: string }
  | { kind: 'exercise'; id: string };

/** App paths have a leading slash and no trailing slash. */
export function routeFor(item: RoutableItem): string {
  switch (item.kind) {
    case 'lesson':
      return `/learn/${item.phase}/${item.slug}`;
    case 'case-study':
      return `/case-studies/${item.slug}`;
    case 'playbook':
      return `/playbooks/${item.slug}`;
    case 'example':
      return `/examples/${item.slug}`;
    case 'exercise':
      return `/exercises/${item.id}`;
  }
}

export const STATIC_ROUTES = [
  '/',
  '/path',
  '/examples',
  '/playbooks',
  '/case-studies',
  '/exercises',
  '/playground',
  '/glossary',
  '/progress',
  '/contribute',
] as const;

export function allRoutes(content: LoadedContent): string[] {
  const routes = [
    ...STATIC_ROUTES,
    ...content.lessons.map((l) =>
      routeFor({ kind: 'lesson', phase: l.data.phase, slug: l.data.slug }),
    ),
    ...content.caseStudies.map((c) => routeFor({ kind: 'case-study', slug: c.data.slug })),
    ...content.playbooks.map((p) => routeFor({ kind: 'playbook', slug: p.data.slug })),
    ...content.examples.map((e) => routeFor({ kind: 'example', slug: e.data.slug })),
    ...[...content.quizzes, ...content.drills].map((x) =>
      routeFor({ kind: 'exercise', id: x.data.id }),
    ),
  ];
  return [...new Set(routes)].sort();
}
