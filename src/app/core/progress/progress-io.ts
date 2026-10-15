import type { ProgressState } from './progress-model';
import { migrateProgress } from './progress-migrate';

export const EXPORT_APP_ID = 'system-design-lab';
const MAX_IMPORT_BYTES = 1_000_000;

export function serializeExport(state: ProgressState, now: Date): string {
  return JSON.stringify(
    { app: EXPORT_APP_ID, exportedAt: now.toISOString(), progress: state },
    null,
    2,
  );
}

export type ImportResult = { ok: true; state: ProgressState } | { ok: false; error: string };

export function parseImport(text: string): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'This file is larger than 1 MB, so it is not a progress export.' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This is not a valid JSON file.' };
  }
  const file = parsed as { app?: unknown; progress?: unknown } | null;
  if (
    typeof file !== 'object' ||
    file === null ||
    file.app !== EXPORT_APP_ID ||
    !('progress' in file)
  ) {
    return { ok: false, error: 'This file is not a System Design Lab progress export.' };
  }
  const { state, status } = migrateProgress(file.progress);
  if (status === 'future') {
    return {
      ok: false,
      error: 'This file was exported by a newer version of the app. Reload the page and try again.',
    };
  }
  if (status === 'reset') {
    return {
      ok: false,
      error: 'The progress data in this file is damaged or in an unknown format.',
    };
  }
  return { ok: true, state };
}
