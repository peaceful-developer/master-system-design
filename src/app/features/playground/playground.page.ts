import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ILLUSTRATIVE_NOTE, type ComponentCategory, type ComponentDef } from '@content/types';
import { CATEGORY_LABELS, shapeDetail, shapePath } from '../../canvas/node-shapes';
import { ContentService } from '../../core/content/content.service';
import { SeoService } from '../../core/seo/seo.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { MascotComponent } from '../../shared/mascot/mascot.component';

const SHAPE_W = 120;
const SHAPE_H = 56;

@Component({
  selector: 'app-playground-page',
  imports: [IconComponent, MascotComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header playground-header">
        <app-mascot pose="thinking" size="5rem" />
        <div>
          <h1 class="page-title">Playground</h1>
          <p class="page-lead">
            A canvas for drawing your own designs and a simulator for putting load on them are
            coming in a later release. Here are the components they will use.
          </p>
        </div>
      </header>

      <p class="note" role="note"><app-icon name="info" size="1em" /> {{ note }}</p>

      @for (group of groups; track group.category) {
        <section class="progress-section" [attr.aria-labelledby]="'cat-' + group.category">
          <h2 [id]="'cat-' + group.category" class="section-title">{{ group.label }}</h2>
          <ul class="component-grid">
            @for (c of group.items; track c.type) {
              <li class="card component-card">
                <svg
                  class="component-shape"
                  [attr.viewBox]="'-2 -2 ' + (shapeW + 4) + ' ' + (shapeH + 4)"
                  aria-hidden="true"
                >
                  <path [attr.d]="shape(c.category)" />
                  @if (detail(c.category); as d) {
                    <path [attr.d]="d" fill="none" />
                  }
                </svg>
                <h3 class="component-title"><app-icon [name]="c.icon" /> {{ c.label }}</h3>
                <p class="text-sm">{{ c.description }}</p>
                <dl class="component-sim">
                  <div>
                    <dt>Capacity</dt>
                    <dd>{{ c.sim.capacityRps.toLocaleString('en-US') }} req/s per instance</dd>
                  </div>
                  <div>
                    <dt>Base latency</dt>
                    <dd>{{ c.sim.baseLatencyMs }} ms</dd>
                  </div>
                  <div>
                    <dt>Cost</dt>
                    <dd>{{ '$' + c.sim.costPerHourPerInstance.toFixed(2) }} per instance-hour</dd>
                  </div>
                </dl>
              </li>
            }
          </ul>
        </section>
      }
    </div>
  `,
})
export class PlaygroundPage {
  protected readonly note = ILLUSTRATIVE_NOTE;
  protected readonly shapeW = SHAPE_W;
  protected readonly shapeH = SHAPE_H;
  protected readonly groups = groupByCategory([...inject(ContentService).components().values()]);

  constructor() {
    inject(SeoService).setPage({
      title: 'Playground',
      description: 'The component library behind the upcoming design canvas and simulator.',
      path: '/playground',
    });
  }

  protected shape(category: ComponentCategory): string {
    return shapePath(category, SHAPE_W, SHAPE_H);
  }

  protected detail(category: ComponentCategory): string | null {
    return shapeDetail(category, SHAPE_W);
  }
}

function groupByCategory(
  components: readonly ComponentDef[],
): { category: ComponentCategory; label: string; items: ComponentDef[] }[] {
  return (Object.keys(CATEGORY_LABELS) as ComponentCategory[])
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      items: components.filter((c) => c.category === category),
    }))
    .filter((g) => g.items.length > 0);
}
