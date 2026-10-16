/**
 * Markdown → typed content blocks, at build time.
 * remark (frontmatter, GFM, directives) → our transforms → rehype (slugs,
 * Shiki highlighting) → split into HTML chunks and component markers.
 */
import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import type { Element, ElementContent, Root as HastRoot, RootContent as HastContent } from 'hast';
import { toHtml } from 'hast-util-to-html';
import { toString as hastToString } from 'hast-util-to-string';
import type { Root as MdastRoot } from 'mdast';
import { toString as mdToString } from 'mdast-util-to-string';
import rehypeParse from 'rehype-parse';
import rehypeSlug from 'rehype-slug';
import remarkDirective from 'remark-directive';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { createHighlighter, type Highlighter } from 'shiki';
import { unified } from 'unified';
import { SKIP, visit, type VisitorResult } from 'unist-util-visit';
import { parse as parseYaml } from 'yaml';
import type { CompiledDoc, ContentBlock, Heading } from '../content-types';
import { emptyRefs, transformDirectives, type ContentRefs } from './directives';
import { contentError, type ContentError } from './errors';

export type { ContentRefs } from './directives';

export const CODE_LANGUAGES = [
  'ts',
  'typescript',
  'js',
  'javascript',
  'json',
  'yaml',
  'yml',
  'sql',
  'bash',
  'sh',
  'shell',
  'python',
  'py',
  'http',
  'text',
  'txt',
] as const;
const SHIKI_LANGS = ['typescript', 'javascript', 'json', 'yaml', 'sql', 'bash', 'python', 'http'];

export interface FigureAsset {
  svg: string;
  title: string;
}

export interface CompileContext {
  file: string;
  figures: ReadonlyMap<string, FigureAsset>;
}

export interface Section {
  title: string;
  diagrams: string[];
}

export interface CompileResult {
  frontmatter: unknown;
  doc: CompiledDoc;
  sections: Section[];
  text: string;
  refs: ContentRefs;
  errors: ContentError[];
}

export interface MarkdownCompiler {
  compile(source: string, ctx: CompileContext): Promise<CompileResult>;
}

function extractFrontmatter(
  tree: MdastRoot,
  report: (line: number | undefined, msg: string) => void,
): unknown {
  const first = tree.children[0];
  if (first?.type !== 'yaml') return undefined;
  tree.children.shift();
  try {
    return parseYaml(first.value) ?? {};
  } catch (err) {
    report(
      first.position?.start.line,
      `invalid frontmatter YAML: ${(err as Error).message.split('\n')[0]}`,
    );
    return {};
  }
}

/** Links, images, raw HTML and code fences: enforce the content rules. */
function checkMarkdown(
  tree: MdastRoot,
  refs: ContentRefs,
  report: (line: number | undefined, msg: string) => void,
): void {
  visit(tree, (node, index, parent) => {
    const line = node.position?.start.line;
    const remove = (): VisitorResult => {
      parent!.children.splice(index!, 1);
      return [SKIP, index!];
    };
    switch (node.type) {
      case 'html':
        report(line, 'raw HTML is not allowed; use a directive instead (see CONTRIBUTING.md)');
        return remove();
      case 'image':
      case 'imageReference':
        report(line, 'images are not supported; draw an SVG in content/figures/ and use ::figure');
        return remove();
      case 'linkReference':
      case 'definition':
        report(line, 'reference-style links are not supported; use inline [text](url) links');
        return node.type === 'definition' ? remove() : undefined;
      case 'link': {
        const url = node.url;
        if (url.startsWith('/')) {
          refs.links.push(url);
          node.url = url.slice(1) || './';
          node.data = { hProperties: { dataInternal: url } };
        } else if (url.startsWith('#')) {
          refs.links.push(url);
          node.data = { hProperties: { dataAnchor: url.slice(1) } };
        } else if (/^https?:\/\//i.test(url)) {
          node.data = { hProperties: { className: ['external'], rel: ['noopener'] } };
        } else {
          report(line, `link "${url}" is not allowed; use /app/paths, #anchors or https:// URLs`);
        }
        return undefined;
      }
      case 'code': {
        const lang = node.lang ?? 'text';
        if (!(CODE_LANGUAGES as readonly string[]).includes(lang)) {
          report(
            line,
            `code language "${lang}" is not supported; use one of: ${CODE_LANGUAGES.join(', ')}`,
          );
          node.lang = 'text';
        } else node.lang = lang;
        return undefined;
      }
      default:
        return undefined;
    }
  });
}

/** Plain text for the search index: every paragraph-like block, no code. */
function searchText(tree: MdastRoot): string {
  const parts: string[] = [];
  visit(tree, (node) => {
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'tableCell') {
      parts.push(mdToString(node));
      return SKIP;
    }
    return undefined;
  });
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function figureElement(marker: Element, figures: ReadonlyMap<string, FigureAsset>): Element {
  const id = String(marker.properties['dataId']);
  const caption = String(marker.properties['dataCaption']);
  const svg = unified()
    .use(rehypeParse, { fragment: true })
    .parse(figures.get(id)!.svg) as HastRoot;
  return {
    type: 'element',
    tagName: 'figure',
    properties: { className: ['figure'], dataFigure: id },
    children: [
      ...(svg.children as ElementContent[]),
      {
        type: 'element',
        tagName: 'figcaption',
        properties: {},
        children: [{ type: 'text', value: caption }],
      },
    ],
  };
}

function splitBlocks(tree: HastRoot): {
  blocks: ContentBlock[];
  headings: Heading[];
  sections: Section[];
} {
  const blocks: ContentBlock[] = [];
  const headings: Heading[] = [];
  const sections: Section[] = [];
  let buffer: HastContent[] = [];

  const flush = () => {
    const html = toHtml({ type: 'root', children: buffer }).trim();
    if (html) blocks.push({ kind: 'html', html });
    buffer = [];
  };

  for (const node of tree.children) {
    if (node.type === 'element' && node.tagName === 'sdl-block') {
      flush();
      const kind = String(node.properties['dataKind']) as 'diagram' | 'quiz' | 'drill';
      const id = String(node.properties['dataId']);
      blocks.push({ kind, id });
      if (kind === 'diagram') sections.at(-1)?.diagrams.push(id);
      continue;
    }
    if (node.type === 'element' && (node.tagName === 'h2' || node.tagName === 'h3')) {
      const text = hastToString(node).trim();
      headings.push({
        id: String(node.properties['id']),
        text,
        depth: node.tagName === 'h2' ? 2 : 3,
      });
      if (node.tagName === 'h2') sections.push({ title: text, diagrams: [] });
    }
    buffer.push(node);
  }
  flush();
  return { blocks, headings, sections };
}

export async function createCompiler(): Promise<MarkdownCompiler> {
  const highlighter: Highlighter = await createHighlighter({
    themes: ['github-light-high-contrast', 'github-dark-high-contrast'],
    langs: SHIKI_LANGS,
  });
  const parser = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkDirective);
  const toHast = unified()
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeShikiFromHighlighter, highlighter, {
      themes: { light: 'github-light-high-contrast', dark: 'github-dark-high-contrast' },
      defaultColor: false,
    });

  return {
    async compile(source, ctx) {
      const errors: ContentError[] = [];
      const report = (line: number | undefined, message: string) =>
        errors.push(contentError(ctx.file, line ? `line ${line}: ${message}` : message));
      const refs = emptyRefs();

      const mdast = parser.parse(source) as MdastRoot;
      const frontmatter = extractFrontmatter(mdast, report);
      checkMarkdown(mdast, refs, report);
      transformDirectives(mdast, { refs, figures: new Set(ctx.figures.keys()), report });
      const text = searchText(mdast);

      const hast = (await toHast.run(mdast as never)) as HastRoot;
      visit(hast, 'element', (node, index, parent) => {
        if (node.tagName === 'sdl-figure' && parent && index !== undefined) {
          parent.children[index] = figureElement(node, ctx.figures);
        }
      });
      const { blocks, headings, sections } = splitBlocks(hast);
      return { frontmatter, doc: { blocks, headings }, sections, text, refs, errors };
    },
  };
}
