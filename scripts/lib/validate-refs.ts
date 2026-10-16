/**
 * Cross-reference rules. Every message starts with its rule id so
 * CONTRIBUTING.md can explain each one.
 */
import { basename, dirname } from 'node:path';
import { PHASE_IDS, type Track } from '../schemas';
import type { ContentRefs } from './directives';
import { contentError, type ContentError } from './errors';
import type { DocItem, LoadedContent } from './load';
import { allRoutes, routeFor } from './routes';

const REQUIRED_CALLOUTS = ['primer', 'deeper', 'interview'] as const;
const TRACK_ORDERS: Record<Track, [number, number]> = { A: [1, 15], B: [16, 30], C: [31, 50] };

type AnyDoc = DocItem<{ slug: string; concepts: string[] }>;

export function validateReferences(c: LoadedContent): ContentError[] {
  const errors: ContentError[] = [];
  const err = (file: string, rule: string, message: string) =>
    errors.push(contentError(file, `[${rule}] ${message}`));

  const docs: AnyDoc[] = [...c.lessons, ...c.playbooks, ...c.examples, ...c.caseStudies];
  const quizIds = new Set([...c.quizzes.map((q) => q.data.id), ...c.unparsed.quiz]);
  const drillIds = new Set([...c.drills.map((d) => d.data.id), ...c.unparsed.drill]);
  const exerciseIds = new Set([...quizIds, ...drillIds]);
  const diagramIds = new Set([...c.diagrams.map((d) => d.data.id), ...c.unparsed.diagram]);
  const termIds = new Set(c.glossary?.data.terms.map((t) => t.id) ?? []);
  const componentTypes = new Set(c.components?.data.components.map((x) => x.type) ?? []);

  // R1 — duplicates within a type (quizzes and drills share the exercise namespace).
  const dupes = (label: string, items: { file: string; key: string }[]) => {
    const seen = new Set<string>();
    for (const { file, key } of items) {
      if (seen.has(key)) err(file, 'R1', `duplicate ${label} "${key}"`);
      seen.add(key);
    }
  };
  dupes(
    'lesson',
    c.lessons.map((l) => ({ file: l.file, key: `${l.data.phase}/${l.data.slug}` })),
  );
  dupes(
    'playbook slug',
    c.playbooks.map((p) => ({ file: p.file, key: p.data.slug })),
  );
  dupes(
    'example slug',
    c.examples.map((e) => ({ file: e.file, key: e.data.slug })),
  );
  dupes(
    'case study slug',
    c.caseStudies.map((s) => ({ file: s.file, key: s.data.slug })),
  );
  dupes(
    'diagram id',
    c.diagrams.map((d) => ({ file: d.file, key: d.data.id })),
  );
  dupes(
    'exercise id',
    [...c.quizzes, ...c.drills].map((x) => ({ file: x.file, key: x.data.id })),
  );
  if (c.glossary)
    dupes(
      'glossary term id',
      c.glossary.data.terms.map((t) => ({ file: c.glossary!.file, key: t.id })),
    );

  // R2 — file names and folders match the ids inside them.
  for (const l of c.lessons) {
    const dirPhase = basename(dirname(l.file));
    if (dirPhase !== l.data.phase || basename(l.file, '.md') !== l.data.slug) {
      err(
        l.file,
        'R2',
        `file must be lessons/${l.data.phase}/${l.data.slug}.md to match its frontmatter`,
      );
    }
  }
  for (const item of [...c.playbooks, ...c.examples]) {
    if (basename(item.file, '.md') !== item.data.slug)
      err(item.file, 'R2', `file name must be ${item.data.slug}.md`);
  }
  for (const cs of c.caseStudies) {
    const folder = basename(dirname(cs.file));
    if (folder !== cs.data.slug)
      err(cs.file, 'R2', `folder must be case-studies/${cs.data.slug}/ to match its slug`);
    const diagram = c.diagrams.find((d) => d.owner === folder);
    if (!diagram) err(cs.file, 'R2', `missing case-studies/${folder}/diagram.json`);
    else if (diagram.data.id !== cs.data.diagram) {
      err(
        diagram.file,
        'R2',
        `diagram id "${diagram.data.id}" must match the case study's diagram "${cs.data.diagram}"`,
      );
    }
  }
  for (const d of c.diagrams.filter((x) => !x.owner)) {
    if (basename(d.file, '.json') !== d.data.id)
      err(d.file, 'R2', `file name must be ${d.data.id}.json`);
  }
  for (const x of [...c.quizzes, ...c.drills]) {
    if (basename(x.file, '.json') !== x.data.id)
      err(x.file, 'R2', `file name must be ${x.data.id}.json`);
  }

  // R3 — diagrams use known components; components have icons.
  for (const d of c.diagrams) {
    for (const node of d.data.nodes) {
      if (!componentTypes.has(node.type))
        err(d.file, 'R3', `node "${node.id}" uses unknown component type "${node.type}"`);
    }
  }
  if (c.components) {
    for (const comp of c.components.data.components) {
      if (!c.icons.has(comp.icon)) {
        err(
          c.components.file,
          'R3',
          `component "${comp.type}" uses icon "${comp.icon}" but content/icons/${comp.icon}.svg does not exist`,
        );
      }
    }
  }

  // R4 — glossary references.
  const checkTerms = (file: string, refs: ContentRefs) => {
    for (const id of refs.terms)
      if (!termIds.has(id)) err(file, 'R4', `unknown glossary term "${id}" in :term`);
  };
  for (const doc of docs) {
    for (const id of doc.data.concepts) {
      if (!termIds.has(id))
        err(doc.file, 'R4', `unknown concept "${id}" (add it to glossary.json)`);
    }
    checkTerms(doc.file, doc.refs);
  }
  for (const d of c.drills) checkTerms(d.file, d.refs);
  if (c.glossary) {
    for (const term of c.glossary.data.terms) {
      for (const id of term.related ?? []) {
        if (!termIds.has(id))
          err(c.glossary.file, 'R4', `term "${term.id}" relates to unknown term "${id}"`);
      }
    }
  }

  // R5 — prerequisites exist and have no cycles.
  const bySlug = new Map(c.caseStudies.map((cs) => [cs.data.slug, cs]));
  for (const cs of c.caseStudies) {
    for (const p of cs.data.prerequisites) {
      if (!bySlug.has(p)) err(cs.file, 'R5', `unknown prerequisite "${p}"`);
    }
  }
  const reportedCycles = new Set<string>();
  const visit = (slug: string, stack: string[]) => {
    const at = stack.indexOf(slug);
    if (at >= 0) {
      const cycle = [...stack.slice(at), slug];
      const key = [...new Set(cycle)].sort().join(',');
      if (!reportedCycles.has(key)) {
        reportedCycles.add(key);
        err(bySlug.get(cycle[0]!)!.file, 'R5', `prerequisite cycle: ${cycle.join(' → ')}`);
      }
      return;
    }
    for (const p of bySlug.get(slug)?.data.prerequisites ?? [])
      if (bySlug.has(p)) visit(p, [...stack, slug]);
  };
  for (const cs of c.caseStudies) visit(cs.data.slug, []);

  // R6 — exercises exist; complete case studies have a quiz.
  for (const doc of [...c.lessons, ...c.playbooks, ...c.caseStudies]) {
    for (const id of doc.data.exercises) {
      if (!exerciseIds.has(id))
        err(
          doc.file,
          'R6',
          `unknown exercise "${id}" (expected quizzes/${id}.json or drills/${id}.json)`,
        );
    }
  }
  for (const doc of docs) {
    for (const id of doc.refs.quizzes)
      if (!quizIds.has(id)) err(doc.file, 'R6', `::quiz refers to unknown quiz "${id}"`);
    for (const id of doc.refs.drills)
      if (!drillIds.has(id)) err(doc.file, 'R6', `::drill refers to unknown drill "${id}"`);
  }
  for (const cs of c.caseStudies.filter((x) => x.data.status === 'complete')) {
    if (!cs.data.exercises.some((id) => quizIds.has(id))) {
      err(cs.file, 'R6', 'complete case studies must list at least one quiz in exercises');
    }
  }

  // R7 — diagrams and figures referenced from content exist.
  for (const doc of docs) {
    for (const id of doc.refs.diagrams)
      if (!diagramIds.has(id)) err(doc.file, 'R7', `::diagram refers to unknown diagram "${id}"`);
    for (const id of doc.refs.figures)
      if (!c.figures.has(id)) err(doc.file, 'R7', `::figure refers to unknown figure "${id}"`);
  }
  for (const ex of c.examples) {
    if (ex.data.diagram && !diagramIds.has(ex.data.diagram)) {
      err(ex.file, 'R7', `diagram "${ex.data.diagram}" does not exist`);
    }
  }

  // R8 — internal links resolve, including #fragments.
  const routes = new Set([
    ...allRoutes(c),
    ...[...c.unparsed.lesson].map((key) => `/learn/${key}`),
    ...[...c.unparsed['case-study']].map((slug) => routeFor({ kind: 'case-study', slug })),
    ...[...c.unparsed.playbook].map((slug) => routeFor({ kind: 'playbook', slug })),
    ...[...c.unparsed.example].map((slug) => routeFor({ kind: 'example', slug })),
    ...[...c.unparsed.quiz, ...c.unparsed.drill].map((id) => routeFor({ kind: 'exercise', id })),
  ]);
  const anchors = new Map<string, Set<string>>();
  for (const l of c.lessons)
    anchors.set(
      routeFor({ kind: 'lesson', phase: l.data.phase, slug: l.data.slug }),
      headingIds(l),
    );
  for (const s of c.caseStudies)
    anchors.set(routeFor({ kind: 'case-study', slug: s.data.slug }), headingIds(s));
  for (const p of c.playbooks)
    anchors.set(routeFor({ kind: 'playbook', slug: p.data.slug }), headingIds(p));
  for (const e of c.examples)
    anchors.set(routeFor({ kind: 'example', slug: e.data.slug }), headingIds(e));
  const checkLinks = (file: string, links: string[], own: Set<string> | undefined) => {
    for (const link of links) {
      const [rawPath, fragment] = link.split('#') as [string, string | undefined];
      if (rawPath === '') {
        if (own && fragment && !own.has(fragment))
          err(file, 'R8', `link #${fragment} has no matching heading on this page`);
        continue;
      }
      const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
      if (!routes.has(path)) {
        err(file, 'R8', `broken link ${link} (no such page)`);
      } else if (fragment && path === '/glossary' && !termIds.has(fragment)) {
        err(file, 'R8', `broken link ${link} (no such glossary term)`);
      } else if (fragment && anchors.has(path) && !anchors.get(path)!.has(fragment)) {
        err(file, 'R8', `broken link ${link} (no such heading on that page)`);
      }
    }
  };
  for (const doc of docs) checkLinks(doc.file, doc.refs.links, headingIds(doc));
  for (const d of c.drills) checkLinks(d.file, d.refs.links, undefined);

  // R9 — the learning path.
  if (c.path) {
    const file = c.path.file;
    const phases = c.path.data.phases;
    const ids = phases.map((p) => p.id);
    if (ids.join() !== PHASE_IDS.join() || phases.some((p, i) => p.number !== i)) {
      err(file, 'R9', `phases must be exactly, in order (numbered 0–5): ${PHASE_IDS.join(', ')}`);
    }
    const lessonPhase = new Map(
      c.lessons.map((l) => [`${l.data.phase}/${l.data.slug}`, l.data.phase]),
    );
    const known: Record<string, Set<string>> = {
      lesson: new Set([...lessonPhase.keys(), ...c.unparsed.lesson]),
      'case-study': new Set([...bySlug.keys(), ...c.unparsed['case-study']]),
      playbook: new Set([...c.playbooks.map((p) => p.data.slug), ...c.unparsed.playbook]),
      example: new Set([...c.examples.map((e) => e.data.slug), ...c.unparsed.example]),
    };
    const placed = new Map<string, number>();
    for (const phase of phases) {
      for (const item of phase.items) {
        const key = `${item.kind}:${item.ref}`;
        placed.set(key, (placed.get(key) ?? 0) + 1);
        if (!known[item.kind]!.has(item.ref)) {
          err(file, 'R9', `unknown ${item.kind} "${item.ref}" in phase "${phase.id}"`);
        } else if (
          item.kind === 'lesson' &&
          lessonPhase.has(item.ref) &&
          lessonPhase.get(item.ref) !== phase.id
        ) {
          err(
            file,
            'R9',
            `lesson "${item.ref}" is placed in phase "${phase.id}" but belongs to "${lessonPhase.get(item.ref)}"`,
          );
        }
      }
    }
    for (const [key, count] of placed)
      if (count > 1) err(file, 'R9', `${key.replace(':', ' "')}" is placed ${count} times`);
    for (const ref of lessonPhase.keys()) {
      if (!placed.has(`lesson:${ref}`))
        err(file, 'R9', `lesson "${ref}" is not placed on the path`);
    }
    for (const ref of bySlug.keys()) {
      if (!placed.has(`case-study:${ref}`))
        err(file, 'R9', `case study "${ref}" is not placed on the path`);
    }
  }

  // R10 — case-study order is unique and within its track's range.
  const orders = new Map<number, string>();
  for (const cs of c.caseStudies) {
    const [min, max] = TRACK_ORDERS[cs.data.track];
    if (cs.data.order < min || cs.data.order > max) {
      err(
        cs.file,
        'R10',
        `track ${cs.data.track} case studies use order ${min}–${max} (found ${cs.data.order})`,
      );
    }
    const other = orders.get(cs.data.order);
    if (other) err(cs.file, 'R10', `order ${cs.data.order} is already used by "${other}"`);
    orders.set(cs.data.order, cs.data.slug);
  }

  // R11 — depth layering for every level.
  for (const doc of [...c.lessons, ...c.caseStudies.filter((x) => x.data.status === 'complete')]) {
    for (const callout of REQUIRED_CALLOUTS) {
      if (!doc.refs.callouts.includes(callout)) {
        err(
          doc.file,
          'R11',
          `add at least one :::${callout} (every lesson and complete case study serves beginners to experts)`,
        );
      }
    }
  }

  return errors;
}

function headingIds(doc: { doc: { headings: { id: string }[] } }): Set<string> {
  return new Set(doc.doc.headings.map((h) => h.id));
}
