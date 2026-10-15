import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PathItem, PathPhase } from '@content/types';
import { ContentService } from '../../core/content/content.service';
import { itemKey, type PathEntry } from '../../core/content/path-nav';
import type { ItemKey } from '../../core/progress/progress-model';
import { ProgressStore } from '../../core/progress/progress.store';
import { SeoService } from '../../core/seo/seo.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { MascotComponent } from '../../shared/mascot/mascot.component';
import { ProgressRingComponent } from '../../shared/progress-ring/progress-ring.component';
import { StartPickerComponent } from '../../shared/start-picker/start-picker.component';
import { exercisesByItem, phaseProgress } from './phase-progress';

export const KIND_ICONS: Record<PathItem['kind'], string> = {
  lesson: 'book-open',
  'case-study': 'layers',
  playbook: 'list',
  example: 'lightbulb',
};

export const KIND_LABELS: Record<PathItem['kind'], string> = {
  lesson: 'Lesson',
  'case-study': 'Case study',
  playbook: 'Playbook',
  example: 'Worked example',
};

interface PathRow extends PathEntry {
  difficulty?: string;
  exercises: { key: ItemKey; id: string; title: string; url: string; kind: 'quiz' | 'drill' }[];
}

@Component({
  selector: 'app-path-page',
  imports: [
    RouterLink,
    IconComponent,
    MascotComponent,
    ProgressRingComponent,
    StartPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">Learning path</h1>
        <p class="page-lead">
          Six phases, from how the web works to the infrastructure behind large models. Go in order,
          or jump to what you need.
        </p>
      </header>

      <app-start-picker [compact]="true" />

      @for (phase of phases(); track phase.id) {
        <section class="path-phase" [id]="phase.id" [attr.aria-labelledby]="phase.id + '-title'">
          <header class="path-phase-header">
            <div>
              <p class="text-sm font-semibold">Phase {{ phase.number }}</p>
              <h2 [id]="phase.id + '-title'" class="section-title">{{ phase.title }}</h2>
              <p class="mt-1 max-w-[65ch]">{{ phase.summary }}</p>
            </div>
            @if (rows(phase).length > 0) {
              <app-progress-ring
                [done]="progress(phase).done"
                [total]="progress(phase).total"
                [label]="phase.title"
                [size]="48"
              />
            }
          </header>

          @let items = rows(phase);
          @if (items.length > 0) {
            <ol class="path-items">
              @for (item of items; track item.key) {
                <li class="path-item">
                  <a class="path-item-link" [routerLink]="item.url">
                    <app-icon [name]="kindIcons[item.kind]" />
                    <span class="flex-1">
                      <span class="path-item-title">{{ item.title }}</span>
                      <span class="path-item-meta">
                        {{ kindLabels[item.kind] }}
                        @if (item.minutes) {
                          · {{ item.minutes }} min
                        }
                        @if (item.difficulty) {
                          · {{ item.difficulty }}
                        }
                      </span>
                    </span>
                    @if (recommended().has(item.key)) {
                      <span class="chip">Recommended for you</span>
                    }
                    @if (isDone(item.key)) {
                      <app-icon name="check-circle" label="Completed" />
                    }
                  </a>
                  @if (item.exercises.length > 0) {
                    <ul class="path-exercises">
                      @for (e of item.exercises; track e.key) {
                        <li>
                          <a class="path-exercise-link" [routerLink]="e.url">
                            <app-icon
                              [name]="e.kind === 'quiz' ? 'lightbulb' : 'flask'"
                              size="1em"
                            />
                            <span class="flex-1">
                              <span class="path-exercise-kind">{{
                                e.kind === 'quiz' ? 'Quiz' : 'Drill'
                              }}</span>
                              {{ e.title }}
                            </span>
                            @if (recommended().has(e.key)) {
                              <span class="chip">Recommended for you</span>
                            }
                            @if (isDone(e.key)) {
                              <app-icon name="check-circle" label="Completed" size="1em" />
                            }
                          </a>
                        </li>
                      }
                    </ul>
                  }
                </li>
              }
            </ol>
          } @else {
            <div class="path-empty">
              <app-mascot pose="sleep" size="4.5rem" />
              <p>
                Lessons for this phase are coming.
                @if (hasCaseStudies()) {
                  Case studies are available now.
                }
              </p>
            </div>
          }
        </section>
      }
    </div>
  `,
})
export class PathPage {
  private readonly content = inject(ContentService);
  private readonly store = inject(ProgressStore);

  protected readonly kindIcons = KIND_ICONS;
  protected readonly kindLabels = KIND_LABELS;
  protected readonly phases = computed(() => this.content.path().phases);
  protected readonly hasCaseStudies = computed(() => this.content.caseStudies().length > 0);

  private readonly exerciseMap = exercisesByItem({
    lessons: this.content.lessons(),
    caseStudies: this.content.caseStudies(),
    playbooks: this.content.playbooks(),
  });
  private readonly difficulty = new Map(
    this.content.caseStudies().map((c) => [itemKey('case-study', c.slug), c.difficulty]),
  );
  private readonly rowsByPhase = computed(() => {
    const byPhase = new Map<string, PathRow[]>();
    for (const entry of this.content.pathEntries()) {
      const exercises = (this.exerciseMap.get(entry.key) ?? []).flatMap((id) => {
        const meta = this.content.exercise(id);
        return meta
          ? [
              {
                key: `exercise:${id}` as ItemKey,
                id,
                title: meta.title,
                url: meta.url,
                kind: meta.kind,
              },
            ]
          : [];
      });
      const row: PathRow = { ...entry, difficulty: this.difficulty.get(entry.key), exercises };
      byPhase.set(entry.phase, [...(byPhase.get(entry.phase) ?? []), row]);
    }
    return byPhase;
  });

  private readonly completed = computed(
    () => new Set(this.store.ready() ? (Object.keys(this.store.completed()) as ItemKey[]) : []),
  );
  protected readonly recommended = computed(() => {
    const level = this.store.ready() ? this.store.prefs().learnerLevel : null;
    const rec = level ? this.content.recommendedStart(level) : undefined;
    return new Set<ItemKey>(rec ? [rec.start.key, ...rec.fastTrack] : []);
  });

  constructor() {
    inject(SeoService).setPage({
      title: 'Learning path',
      description:
        'Six phases from web basics to ML, LLM and frontier infrastructure, with lessons, case studies and practice.',
      path: '/path',
    });
  }

  protected rows(phase: PathPhase): PathRow[] {
    return this.rowsByPhase().get(phase.id) ?? [];
  }

  protected progress(phase: PathPhase): { done: number; total: number } {
    return phaseProgress(phase, this.completed(), this.exerciseMap);
  }

  protected isDone(key: ItemKey): boolean {
    return this.completed().has(key);
  }
}
