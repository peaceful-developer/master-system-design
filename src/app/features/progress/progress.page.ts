import { Dialog } from '@angular/cdk/dialog';
import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/content/content.service';
import { parseImport } from '../../core/progress/progress-io';
import type { ItemKey } from '../../core/progress/progress-model';
import { ProgressStore } from '../../core/progress/progress.store';
import { SeoService } from '../../core/seo/seo.service';
import { CLOCK, localDay } from '../../core/time/clock';
import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { ProgressRingComponent } from '../../shared/progress-ring/progress-ring.component';
import { exercisesByItem, phaseKeys } from '../path/phase-progress';

interface CompletedRow {
  key: ItemKey;
  title: string;
  url: string;
  at: string;
}

@Component({
  selector: 'app-progress-page',
  imports: [RouterLink, IconComponent, ProgressRingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">Your progress</h1>
        <p class="page-lead">
          Progress is saved in this browser only. Export it to keep a copy or move it to another
          device.
        </p>
      </header>

      <section aria-labelledby="overview-title">
        <h2 id="overview-title" class="section-title">Overview</h2>
        <div class="progress-overview">
          <div class="progress-overall">
            <app-progress-ring
              [done]="overall().done"
              [total]="overall().total"
              label="Overall"
              [size]="72"
            />
            <span class="font-semibold">Overall</span>
          </div>
          <ul class="progress-phases">
            @for (p of startedPhases(); track p.id) {
              <li>
                <app-progress-ring [done]="p.done" [total]="p.total" [label]="p.title" />
                <span>Phase {{ p.number }} · {{ p.title }}</span>
              </li>
            }
          </ul>
        </div>
      </section>

      <section class="progress-section" aria-labelledby="completed-title">
        <h2 id="completed-title" class="section-title">Completed</h2>
        @if (completedRows().length > 0) {
          <ul class="progress-list">
            @for (row of completedRows(); track row.key) {
              <li>
                <app-icon name="check-circle" />
                <a [routerLink]="row.url">{{ row.title }}</a>
                <span class="text-sm">{{ row.at }}</span>
              </li>
            }
          </ul>
        } @else {
          <p class="mt-2">
            Nothing yet. <a routerLink="/path">Pick a starting point on the learning path.</a>
          </p>
        }
      </section>

      @if (quizRows().length > 0) {
        <section class="progress-section" aria-labelledby="quiz-title">
          <h2 id="quiz-title" class="section-title">Quiz best scores</h2>
          <table class="progress-table">
            <thead>
              <tr>
                <th scope="col">Quiz</th>
                <th scope="col">Best score</th>
                <th scope="col">Last attempt</th>
              </tr>
            </thead>
            <tbody>
              @for (q of quizRows(); track q.id) {
                <tr>
                  <td>
                    <a [routerLink]="q.url">{{ q.title }}</a>
                  </td>
                  <td class="tabular-nums">{{ q.best }} / {{ q.total }}</td>
                  <td>{{ q.at }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      }

      @if (drillRows().length > 0) {
        <section class="progress-section" aria-labelledby="drill-title">
          <h2 id="drill-title" class="section-title">Drill results</h2>
          <table class="progress-table">
            <thead>
              <tr>
                <th scope="col">Drill</th>
                <th scope="col">Best result</th>
                <th scope="col">Last attempt</th>
              </tr>
            </thead>
            <tbody>
              @for (d of drillRows(); track d.id) {
                <tr>
                  <td>
                    <a [routerLink]="d.url">{{ d.title }}</a>
                  </td>
                  <td class="tabular-nums">{{ d.best }} / {{ d.total }} within range</td>
                  <td>{{ d.at }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      }

      <section class="progress-section" aria-labelledby="data-title">
        <h2 id="data-title" class="section-title">Your data</h2>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" class="btn" (click)="exportProgress()">
            <app-icon name="download" size="1em" /> Export progress
          </button>
          <label class="btn-secondary file-button">
            <app-icon name="upload" size="1em" /> Import progress
            <input
              type="file"
              class="sr-only"
              accept="application/json,.json"
              (change)="importFile($event)"
            />
          </label>
          <button type="button" class="btn-secondary btn-danger-outline" (click)="resetProgress()">
            <app-icon name="trash" size="1em" /> Reset progress
          </button>
        </div>
        @if (importError(); as error) {
          <p class="form-error mt-3" role="alert">{{ error }}</p>
        }
        @if (notice(); as message) {
          <p class="mt-3" role="status">{{ message }}</p>
        }
      </section>
    </div>
  `,
})
export class ProgressPage {
  private readonly content = inject(ContentService);
  private readonly store = inject(ProgressStore);
  private readonly dialog = inject(Dialog);
  private readonly document = inject(DOCUMENT);
  private readonly clock = inject(CLOCK);

  protected readonly importError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  private readonly exerciseMap = exercisesByItem({
    lessons: this.content.lessons(),
    caseStudies: this.content.caseStudies(),
    playbooks: this.content.playbooks(),
  });
  private readonly titles = new Map<ItemKey, { title: string; url: string }>([
    ...this.content.pathEntries().map((e) => [e.key, e] as const),
    ...this.content
      .exercises()
      .map((e) => [`exercise:${e.id}` as ItemKey, { title: e.title, url: e.url }] as const),
  ]);
  private readonly completed = computed(() => (this.store.ready() ? this.store.completed() : {}));

  protected readonly phases = computed(() => {
    const done = this.completed();
    return this.content.path().phases.map((phase) => {
      const keys = phaseKeys(phase, this.exerciseMap);
      return {
        id: phase.id,
        number: phase.number,
        title: phase.title,
        keys,
        done: keys.filter((k) => done[k] !== undefined).length,
        total: keys.length,
      };
    });
  });
  /** Phases with content so far (empty phases would only show 0 / 0). */
  protected readonly startedPhases = computed(() => this.phases().filter((p) => p.total > 0));
  protected readonly overall = computed(() =>
    this.phases().reduce((sum, p) => ({ done: sum.done + p.done, total: sum.total + p.total }), {
      done: 0,
      total: 0,
    }),
  );
  protected readonly completedRows = computed<CompletedRow[]>(() =>
    (Object.entries(this.completed()) as [ItemKey, string][])
      .sort(([, a], [, b]) => b.localeCompare(a))
      .flatMap(([key, at]) => {
        const item = this.titles.get(key);
        return item ? [{ key, title: item.title, url: item.url, at: formatDay(at) }] : [];
      }),
  );
  protected readonly quizRows = computed(() =>
    Object.entries(this.store.ready() ? this.store.quizScores() : {}).flatMap(([id, s]) => {
      const meta = this.content.exercise(id);
      return meta
        ? [
            {
              id,
              title: meta.title,
              url: meta.url,
              best: s.best,
              total: s.total,
              at: formatDay(s.lastAttemptAt),
            },
          ]
        : [];
    }),
  );
  protected readonly drillRows = computed(() =>
    Object.entries(this.store.ready() ? this.store.drillAttempts() : {}).flatMap(([id, d]) => {
      const meta = this.content.exercise(id);
      return meta
        ? [
            {
              id,
              title: meta.title,
              url: meta.url,
              best: d.bestCorrect,
              total: d.total,
              at: formatDay(d.lastAttemptAt),
            },
          ]
        : [];
    }),
  );

  constructor() {
    inject(SeoService).setPage({
      title: 'Your progress',
      description: 'See what you have completed, your quiz scores, and export or import progress.',
      path: '/progress',
    });
  }

  protected exportProgress(): void {
    const blob = new Blob([this.store.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `system-design-lab-progress-${localDay(this.clock())}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.notice.set('Progress exported.');
  }

  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.importError.set(null);
    this.notice.set(null);

    const result = parseImport(await file.text());
    if (!result.ok) {
      this.importError.set(result.error);
      return;
    }
    const replace = await confirmAction(this.dialog, {
      title: 'Replace your current progress?',
      body: 'Everything saved in this browser will be replaced by the file you chose. This cannot be undone.',
      confirmLabel: 'Replace progress',
      danger: true,
    });
    if (replace) {
      this.store.replaceAll(result.state);
      this.notice.set('Progress imported.');
    }
  }

  protected async resetProgress(): Promise<void> {
    this.importError.set(null);
    this.notice.set(null);
    const reset = await confirmAction(this.dialog, {
      title: 'Reset all progress?',
      body: 'Completed items, quiz scores and settings in this browser will be deleted. Export first if you want a copy.',
      confirmLabel: 'Reset progress',
      danger: true,
    });
    if (reset) {
      this.store.reset();
      this.notice.set('Progress reset.');
    }
  }
}

/** `2026-10-15T09:00:00.000Z` → `15 Oct 2026` (in the visitor's time zone). */
function formatDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
