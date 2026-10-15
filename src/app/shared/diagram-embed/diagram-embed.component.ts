import { ChangeDetectionStrategy, Component, inject, input, resource } from '@angular/core';
import { DiagramViewerComponent } from '../../canvas/diagram-viewer/diagram-viewer.component';
import { ContentService } from '../../core/content/content.service';

/** Loads a diagram by id and shows it read-only (`::diagram{id}` in content). */
@Component({
  selector: 'app-diagram-embed',
  imports: [DiagramViewerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block my-8' },
  template: `
    @if (diagram.value(); as d) {
      <app-diagram-viewer [diagram]="d" [catalog]="catalog" [caption]="d.title ?? ''" />
    } @else if (diagram.isLoading()) {
      <div class="diagram-loading" aria-busy="true">Loading diagram…</div>
    } @else {
      <p class="diagram-empty">This diagram is not available.</p>
    }
  `,
})
export class DiagramEmbedComponent {
  private readonly content = inject(ContentService);

  readonly id = input.required<string>();
  protected readonly catalog = this.content.components();
  protected readonly diagram = resource({
    params: () => this.id(),
    loader: ({ params }) => this.content.getDiagram(params),
  });
}
