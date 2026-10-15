/**
 * Turns remark-directive nodes into the elements the app renders:
 *   ::diagram{id} ::quiz{id} ::drill{id}   → block markers (Angular components)
 *   ::figure{id caption}                   → inline custom SVG figure
 *   :::note|tip|warning|primer|interview   → <aside class="callout …">
 *   :::deeper[Title]                       → <details class="deeper"> (closed)
 *   :term[label]{id}                       → glossary link
 */
import type { Paragraph, Parent, Root } from 'mdast';
import type { ContainerDirective, LeafDirective, TextDirective } from 'mdast-util-directive';
import { toString } from 'mdast-util-to-string';
import { SKIP, visit } from 'unist-util-visit';

export const BLOCK_DIRECTIVES = ['diagram', 'quiz', 'drill'] as const;
export const CALLOUT_LABELS: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  warning: 'Warning',
  primer: 'New to this?',
  interview: 'Interview tip',
};

export interface ContentRefs {
  diagrams: string[];
  quizzes: string[];
  drills: string[];
  figures: string[];
  terms: string[];
  links: string[];
  callouts: string[];
}

export const emptyRefs = (): ContentRefs => ({
  diagrams: [],
  quizzes: [],
  drills: [],
  figures: [],
  terms: [],
  links: [],
  callouts: [],
});

export interface DirectiveSink {
  refs: ContentRefs;
  figures: ReadonlySet<string>;
  report: (line: number | undefined, message: string) => void;
}

type Directive = ContainerDirective | LeafDirective | TextDirective;

/** Removes and returns the `[Label]` paragraph remark-directive puts first in a container. */
function takeLabel(node: ContainerDirective): string | undefined {
  const first = node.children[0];
  if (first?.type === 'paragraph' && first.data?.directiveLabel) {
    node.children.shift();
    return toString(first).trim() || undefined;
  }
  return undefined;
}

function paragraph(text: string, data: Paragraph['data']): Paragraph {
  return { type: 'paragraph', data, children: [{ type: 'text', value: text }] };
}

const REF_LISTS: Record<(typeof BLOCK_DIRECTIVES)[number], keyof ContentRefs> = {
  diagram: 'diagrams',
  quiz: 'quizzes',
  drill: 'drills',
};

function leaf(node: LeafDirective, parent: Parent, sink: DirectiveSink): boolean {
  const line = node.position?.start.line;
  const id = node.attributes?.['id'];
  const name = node.name;

  if ((BLOCK_DIRECTIVES as readonly string[]).includes(name)) {
    if (!id) {
      sink.report(line, `::${name} needs an id, e.g. ::${name}{id="my-id"}`);
      return false;
    }
    if (parent.type !== 'root') {
      sink.report(
        line,
        `::${name} must be on its own line at the top level (not inside a list or callout)`,
      );
    }
    sink.refs[REF_LISTS[name as (typeof BLOCK_DIRECTIVES)[number]]].push(id);
    node.children = [];
    node.data = { hName: 'sdl-block', hProperties: { dataKind: name, dataId: id } };
    return true;
  }

  if (name === 'figure') {
    const caption = node.attributes?.['caption'];
    if (!id) sink.report(line, '::figure needs an id, e.g. ::figure{id="my-figure" caption="…"}');
    if (!caption)
      sink.report(
        line,
        '::figure needs a caption (it is shown under the figure and read by screen readers)',
      );
    if (!id || !caption) return false;
    if (!sink.figures.has(id)) {
      sink.report(line, `unknown figure "${id}" (expected content/figures/${id}.svg)`);
      return false;
    }
    sink.refs.figures.push(id);
    node.children = [];
    node.data = { hName: 'sdl-figure', hProperties: { dataId: id, dataCaption: caption } };
    return true;
  }

  sink.report(line, `unknown directive ::${name}`);
  return false;
}

function container(node: ContainerDirective, sink: DirectiveSink): boolean {
  const name = node.name;
  const label = takeLabel(node);

  if (name in CALLOUT_LABELS) {
    const title = label ?? CALLOUT_LABELS[name]!;
    node.children.unshift(paragraph(title, { hProperties: { className: ['callout-title'] } }));
    node.data = {
      hName: 'aside',
      hProperties: { className: ['callout', `callout-${name}`], role: 'note', ariaLabel: title },
    };
    sink.refs.callouts.push(name);
    return true;
  }

  if (name === 'deeper') {
    node.children.unshift(paragraph(`Go deeper: ${label ?? 'more detail'}`, { hName: 'summary' }));
    node.data = { hName: 'details', hProperties: { className: ['deeper'] } };
    sink.refs.callouts.push('deeper');
    return true;
  }

  sink.report(node.position?.start.line, `unknown directive :::${name}`);
  return false;
}

function text(node: TextDirective, sink: DirectiveSink): boolean {
  const line = node.position?.start.line;
  if (node.name !== 'term') {
    sink.report(line, `unknown directive :${node.name} (write "\\:" for a literal colon)`);
    return false;
  }
  const id = node.attributes?.['id'];
  if (!id) {
    sink.report(line, ':term needs an id, e.g. :term[label]{id="glossary-id"}');
    return false;
  }
  sink.refs.terms.push(id);
  node.data = {
    hName: 'a',
    hProperties: {
      className: ['term'],
      href: `glossary#${id}`,
      dataInternal: `/glossary#${id}`,
      dataTerm: id,
    },
  };
  return true;
}

/** Rewrites directive nodes in place; invalid ones are reported and removed. */
export function transformDirectives(tree: Root, sink: DirectiveSink): void {
  visit(tree, (node, index, parent) => {
    if (!parent || index === undefined) return;
    if (
      node.type !== 'leafDirective' &&
      node.type !== 'containerDirective' &&
      node.type !== 'textDirective'
    ) {
      return;
    }
    const directive = node as Directive;
    const keep =
      directive.type === 'leafDirective'
        ? leaf(directive, parent, sink)
        : directive.type === 'containerDirective'
          ? container(directive, sink)
          : text(directive, sink);
    if (!keep) {
      parent.children.splice(index, 1);
      return [SKIP, index];
    }
    return undefined;
  });
}
