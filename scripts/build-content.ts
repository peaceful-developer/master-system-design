/**
 * Validates content/ and compiles it to src/generated/.
 *
 *   tsx scripts/build-content.ts            validate + build (exit 1 on errors)
 *   tsx scripts/build-content.ts --check    validate only, write nothing
 *   tsx scripts/build-content.ts --watch    rebuild on every change (never exits)
 *   --content <dir>  --out <dir>            override the default directories
 */
import { watch } from 'chokidar';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildOutputs, MASCOT_POSES, writeOutputs } from './lib/emit';
import { contentError, type ContentError } from './lib/errors';
import { displayPath, loadContent, type LoadedContent } from './lib/load';
import { createCompiler, type MarkdownCompiler } from './lib/markdown';
import { validateReferences } from './lib/validate-refs';
import { validateCaseStudyStructure } from './lib/validate-structure';

export interface BuildOptions {
  contentDir: string;
  outDir: string;
  check?: boolean;
}

export interface BuildResult {
  errors: ContentError[];
  written: number;
}

let compiler: Promise<MarkdownCompiler> | undefined;

function mascotErrors(c: LoadedContent, contentDir: string): ContentError[] {
  const present = MASCOT_POSES.filter((pose) => c.figures.has(`mascot-${pose}`));
  if (present.length === 0 || present.length === MASCOT_POSES.length) return [];
  return MASCOT_POSES.filter((pose) => !present.includes(pose)).map((pose) =>
    contentError(
      displayPath(resolve(contentDir, 'figures', `mascot-${pose}.svg`)),
      `missing mascot pose figures/mascot-${pose}.svg (all six are required: ${MASCOT_POSES.join(', ')})`,
    ),
  );
}

export async function runBuild({
  contentDir,
  outDir,
  check = false,
}: BuildOptions): Promise<BuildResult> {
  compiler ??= createCompiler();
  const { content, errors } = await loadContent(contentDir, await compiler);
  errors.push(
    ...validateReferences(content),
    ...content.caseStudies.flatMap((cs) => validateCaseStudyStructure(cs)),
    ...mascotErrors(content, contentDir),
  );
  if (check || errors.some((e) => e.severity === 'error')) return { errors, written: 0 };
  return { errors, written: writeOutputs(outDir, buildOutputs(content)) };
}

function printResult({ errors, written }: BuildResult, check: boolean): boolean {
  const failures = errors.filter((e) => e.severity === 'error');
  const warnings = errors.filter((e) => e.severity === 'warning');
  for (const e of [...failures, ...warnings]) {
    console.log(`${e.severity === 'error' ? '✖' : '⚠'} ${e.file}: ${e.message}`);
  }
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (failures.length > 0) {
    console.log(
      `\n✖ content: ${plural(failures.length, 'error')}, ${plural(warnings.length, 'warning')}`,
    );
    return false;
  }
  const action = check ? 'valid' : `built (${plural(written, 'file')} written)`;
  console.log(
    `✔ content ${action}${warnings.length ? `, ${plural(warnings.length, 'warning')}` : ''}`,
  );
  return true;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const options: BuildOptions = {
    contentDir: arg('content') ?? 'content',
    outDir: arg('out') ?? 'src/generated',
    check: process.argv.includes('--check'),
  };

  if (!process.argv.includes('--watch')) {
    const ok = printResult(await runBuild(options), options.check ?? false);
    process.exitCode = ok ? 0 : 1;
    return;
  }

  printResult(await runBuild(options), false);
  let timer: NodeJS.Timeout | undefined;
  let running = Promise.resolve();
  watch(options.contentDir, { ignoreInitial: true }).on('all', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      running = running.then(async () => {
        console.log('\n↻ content changed, rebuilding…');
        printResult(await runBuild(options), false);
      });
    }, 100);
  });
  console.log(`👀 watching ${options.contentDir}/ for changes`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
