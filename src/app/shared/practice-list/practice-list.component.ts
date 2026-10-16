import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/content/content.service';
import { ProgressStore } from '../../core/progress/progress.store';
import { IconComponent } from '../icon/icon.component';

/** "Practice" section linking the exercises of a lesson, playbook or case study. */
@Component({
  selector: 'app-practice-list',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (exercises().length > 0) {
      <section class="practice mt-12 max-w-[75ch]" aria-labelledby="practice-heading">
        <h2 id="practice-heading" class="text-xl font-bold">Practice</h2>
        <ul class="mt-3 grid gap-2">
          @for (e of exercises(); track e.id) {
            <li>
              <a class="practice-link" [routerLink]="e.url">
                <app-icon [name]="e.kind === 'quiz' ? 'lightbulb' : 'flask'" />
                <span class="flex-1">
                  <span class="font-semibold">{{ e.title }}</span>
                  <span class="block text-sm">{{
                    e.kind === 'quiz' ? 'Quiz' : 'Estimation drill'
                  }}</span>
                </span>
                @if (done(e.id)) {
                  <app-icon name="check-circle" label="Completed" />
                }
              </a>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class PracticeListComponent {
  private readonly content = inject(ContentService);
  private readonly store = inject(ProgressStore);

  readonly exerciseIds = input.required<readonly string[]>();
  protected readonly exercises = computed(() =>
    this.exerciseIds().flatMap((id) => {
      const meta = this.content.exercise(id);
      return meta ? [meta] : [];
    }),
  );

  protected done(id: string): boolean {
    return this.store.isComplete(`exercise:${id}`);
  }
}
