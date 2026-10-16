import { ChangeDetectionStrategy, Component, inject, input, resource } from '@angular/core';
import { ContentService } from '../../core/content/content.service';
import { DrillComponent } from './drill.component';

/** Loads an estimation drill by id (`::drill{id}` in content, or the exercise page). */
@Component({
  selector: 'app-drill-embed',
  imports: [DrillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (drill.value(); as d) {
      <app-drill [drill]="d" />
    } @else if (drill.isLoading()) {
      <div class="exercise-placeholder" aria-busy="true">Loading drill…</div>
    } @else {
      <p class="exercise-placeholder">This drill is not available.</p>
    }
  `,
})
export class DrillEmbedComponent {
  private readonly content = inject(ContentService);
  readonly id = input.required<string>();
  protected readonly drill = resource({
    params: () => this.id(),
    loader: ({ params }) => this.content.getDrill(params),
  });
}
