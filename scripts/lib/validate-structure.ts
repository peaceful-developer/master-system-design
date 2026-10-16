import type { CaseStudyFrontmatter, CaseStudyStatus, Track } from '../schemas';
import { contentError, contentWarning, type ContentError } from './errors';
import type { DocItem } from './load';

const ML_SECTION = 'ML/LLM design';

export const COMPLETE_SECTIONS = [
  'Problem statement',
  'Requirements',
  'Back-of-envelope estimates',
  'API design and data model',
  'High-level design',
  'Deep dives',
  ML_SECTION,
  'Trade-offs',
  'Failure modes, scaling and monitoring',
  'Real-world references',
  '45-minute interview version',
  'Practice',
] as const;

export const OUTLINE_SECTIONS = [
  'Problem statement',
  'Requirements',
  'Key concepts',
  'High-level design',
] as const;

const WORDS_PER_MINUTE = 220;
const MINUTES_PER_EXERCISE = 2;

export function requiredSections(track: Track, status: CaseStudyStatus): string[] {
  if (status === 'outline') return [...OUTLINE_SECTIONS];
  return COMPLETE_SECTIONS.filter((s) => track !== 'A' || s !== ML_SECTION);
}

/** Checks the H2 outline of a case study against the template in PROJECT_BRIEF §5.4. */
export function validateCaseStudyStructure(cs: DocItem<CaseStudyFrontmatter>): ContentError[] {
  const errors: ContentError[] = [];
  const err = (message: string) => errors.push(contentError(cs.file, `[structure] ${message}`));
  const { track, status, diagram, estimatedMinutes } = cs.data;

  const required = requiredSections(track, status);
  const found = cs.sections.map((s) => s.title);
  for (const title of required.filter((t) => !found.includes(t)))
    err(`missing section "## ${title}"`);
  for (const title of found.filter((t) => !required.includes(t))) {
    const why =
      title === ML_SECTION && track === 'A'
        ? 'track A case studies have no ML/LLM section'
        : `${status} case studies use exactly: ${required.join(' · ')}`;
    err(`unexpected section "## ${title}" (${why})`);
  }
  const inOrder = found.filter((t) => required.includes(t));
  const expectedOrder = required.filter((t) => found.includes(t));
  if (inOrder.join('|') !== expectedOrder.join('|'))
    err(`sections must be in this order: ${required.join(' · ')}`);

  const hld = cs.sections.find((s) => s.title === 'High-level design');
  if (hld && !hld.diagrams.includes(diagram))
    err(`::diagram{id="${diagram}"} must appear under "## High-level design"`);

  if (status === 'complete') {
    const words = cs.text.split(/\s+/).filter(Boolean).length;
    const exercises = cs.doc.blocks.filter((b) => b.kind === 'quiz' || b.kind === 'drill').length;
    const minutes = words / WORDS_PER_MINUTE + exercises * MINUTES_PER_EXERCISE;
    if (Math.abs(estimatedMinutes - minutes) / minutes > 0.4) {
      errors.push(
        contentWarning(
          cs.file,
          `estimatedMinutes is ${estimatedMinutes} but the reading time is about ${Math.max(1, Math.round(minutes))} min`,
        ),
      );
    }
  }
  return errors;
}
