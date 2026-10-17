import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ContentBlock } from '@content/types';
import { DiagramEmbedComponent } from '../diagram-embed/diagram-embed.component';
import { DrillEmbedComponent } from '../drill/drill-embed.component';
import { QuizEmbedComponent } from '../quiz/quiz-embed.component';
import { InternalLinksDirective } from './internal-links.directive';
import { StaticHtmlDirective } from './static-html.directive';

/**
 * Renders compiled content: HTML chunks plus embedded components. Quizzes and
 * drills load when scrolled near, behind a fixed-height placeholder (no layout shift).
 */
@Component({
  selector: 'app-content-blocks',
  imports: [
    StaticHtmlDirective,
    InternalLinksDirective,
    DiagramEmbedComponent,
    QuizEmbedComponent,
    DrillEmbedComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (block of blocks(); track $index) {
      @switch (block.kind) {
        @case ('html') {
          <div class="prose-content" appInternalLinks [appStaticHtml]="htmlOf(block)"></div>
        }
        @case ('diagram') {
          <app-diagram-embed [id]="block.id" />
        }
        @case ('quiz') {
          @defer (on viewport; prefetch on idle) {
            <app-quiz-embed [id]="block.id" />
          } @placeholder {
            <div class="exercise-placeholder">Loading exercise…</div>
          }
        }
        @case ('drill') {
          @defer (on viewport; prefetch on idle) {
            <app-drill-embed [id]="block.id" />
          } @placeholder {
            <div class="exercise-placeholder">Loading exercise…</div>
          }
        }
      }
    }
  `,
})
export class ContentBlocksComponent {
  readonly blocks = input.required<ContentBlock[]>();

  protected htmlOf(block: ContentBlock): string {
    return block.kind === 'html' ? block.html : '';
  }
}
