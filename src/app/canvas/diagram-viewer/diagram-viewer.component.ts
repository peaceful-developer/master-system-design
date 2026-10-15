import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ComponentCategory, ComponentDef, Diagram } from '@content/types';
import { ICON_ELEMENTS, type IconElement } from '@generated/icons';
import { layoutDiagram, NODE_H, NODE_W } from '../diagram-geometry';
import { CATEGORY_LABELS, shapePath } from '../node-shapes';

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as ComponentCategory[];
const MAX_LABEL = 20;
let nextId = 0;

/** Read-only, prerenderable diagram: SVG + legend + a full text description. */
@Component({
  selector: 'app-diagram-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (layout().nodes.length === 0) {
      <p class="diagram-empty">No components yet.</p>
    } @else {
      <figure class="diagram">
        <div
          class="diagram-scroll"
          tabindex="0"
          role="region"
          [attr.aria-label]="'Diagram: ' + title() + '. Scroll sideways to see all of it.'"
        >
          <svg
            class="diagram-svg"
            [attr.viewBox]="viewBox()"
            role="img"
            [attr.aria-labelledby]="ids.title + ' ' + ids.desc"
            [style.min-width.px]="minWidth()"
          >
            <title [attr.id]="ids.title">{{ title() }}</title>
            <desc [attr.id]="ids.desc">{{ summary() }}</desc>
            <defs>
              <marker
                [attr.id]="ids.marker"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0 0 10 5 0 10z" class="diagram-arrowhead" />
              </marker>
            </defs>
            @for (edge of layout().edges; track edge.id) {
              <path
                class="diagram-edge"
                [attr.d]="edge.d"
                [attr.marker-end]="'url(#' + ids.marker + ')'"
              />
              @if (edge.label && edge.labelAt) {
                <text
                  class="diagram-edge-label"
                  [attr.x]="edge.labelAt.x"
                  [attr.y]="edge.labelAt.y - 6"
                  text-anchor="middle"
                >
                  {{ edge.label }}
                </text>
              }
            }
            @for (node of layout().nodes; track node.id) {
              <g
                class="diagram-node"
                [attr.data-category]="node.category"
                [attr.transform]="'translate(' + node.x + ' ' + node.y + ')'"
              >
                <title>{{ node.label }} ({{ node.typeLabel }})</title>
                <path class="diagram-node-shape" [attr.d]="node.shape" />
                @if (node.detail) {
                  <path class="diagram-node-detail" [attr.d]="node.detail" />
                }
                <svg
                  class="diagram-node-icon"
                  x="16"
                  y="24"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  @for (el of iconElements(node.icon); track $index) {
                    @switch (el.tag) {
                      @case ('path') {
                        <path [attr.d]="el.attrs['d']" />
                      }
                      @case ('circle') {
                        <circle
                          [attr.cx]="el.attrs['cx']"
                          [attr.cy]="el.attrs['cy']"
                          [attr.r]="el.attrs['r']"
                        />
                      }
                      @case ('ellipse') {
                        <ellipse
                          [attr.cx]="el.attrs['cx']"
                          [attr.cy]="el.attrs['cy']"
                          [attr.rx]="el.attrs['rx']"
                          [attr.ry]="el.attrs['ry']"
                        />
                      }
                      @case ('rect') {
                        <rect
                          [attr.x]="el.attrs['x'] ?? null"
                          [attr.y]="el.attrs['y'] ?? null"
                          [attr.width]="el.attrs['width']"
                          [attr.height]="el.attrs['height']"
                          [attr.rx]="el.attrs['rx'] ?? null"
                          [attr.ry]="el.attrs['ry'] ?? null"
                        />
                      }
                      @case ('line') {
                        <line
                          [attr.x1]="el.attrs['x1']"
                          [attr.y1]="el.attrs['y1']"
                          [attr.x2]="el.attrs['x2']"
                          [attr.y2]="el.attrs['y2']"
                        />
                      }
                      @case ('polyline') {
                        <polyline [attr.points]="el.attrs['points']" />
                      }
                      @case ('polygon') {
                        <polygon [attr.points]="el.attrs['points']" />
                      }
                    }
                  }
                </svg>
                <text class="diagram-node-label" x="48" y="34">{{ short(node.label) }}</text>
                <text class="diagram-node-type" x="48" y="52">
                  {{ node.typeLabel }}{{ node.instances > 1 ? ' ×' + node.instances : '' }}
                </text>
              </g>
            }
          </svg>
        </div>

        <ul class="diagram-legend" aria-label="Legend">
          @for (category of categories(); track category) {
            <li>
              <svg width="30" height="14" viewBox="-4 -4 176 80" aria-hidden="true">
                <path class="diagram-node-shape" [attr.d]="legendShape(category)" />
              </svg>
              {{ categoryLabel(category) }}
            </li>
          }
        </ul>

        <details class="diagram-text">
          <summary>Text description</summary>
          <p>Components</p>
          <ul>
            @for (node of layout().nodes; track node.id) {
              <li>
                {{ node.label }} ({{ node.typeLabel
                }}{{ node.instances > 1 ? ', ×' + node.instances : '' }})
              </li>
            }
          </ul>
          @if (layout().edges.length > 0) {
            <p>Connections</p>
            <ul>
              @for (edge of layout().edges; track edge.id) {
                <li>
                  {{ labelOf(edge.from) }} → {{ labelOf(edge.to)
                  }}{{ edge.label ? ' (' + edge.label + ')' : '' }}
                </li>
              }
            </ul>
          }
        </details>

        @if (caption()) {
          <figcaption>{{ caption() }}</figcaption>
        }
      </figure>
    }
  `,
})
export class DiagramViewerComponent {
  readonly diagram = input.required<Diagram>();
  readonly catalog = input.required<ReadonlyMap<string, ComponentDef>>();
  readonly caption = input('');

  protected readonly ids = (() => {
    const n = nextId++;
    return { title: `dg-${n}-title`, desc: `dg-${n}-desc`, marker: `dg-${n}-arrow` };
  })();

  protected readonly layout = computed(() => layoutDiagram(this.diagram(), this.catalog()));
  protected readonly title = computed(() => this.diagram().title ?? 'System design diagram');
  protected readonly summary = computed(() => {
    const { nodes, edges } = this.layout();
    return (
      this.diagram().description ??
      `${nodes.length} components and ${edges.length} connections. A text description follows the diagram.`
    );
  });
  protected readonly viewBox = computed(() => {
    const { x, y, width, height } = this.layout().viewBox;
    return `${x} ${y} ${width} ${height}`;
  });
  /** Keeps labels legible on phones; the scroll container handles the overflow. */
  protected readonly minWidth = computed(() => Math.round(this.layout().viewBox.width * 0.7));
  protected readonly categories = computed(() => {
    const used = new Set(this.layout().nodes.map((n) => n.category));
    return CATEGORY_ORDER.filter((c) => used.has(c));
  });

  private readonly labels = computed(
    () => new Map(this.layout().nodes.map((n) => [n.id, n.label] as const)),
  );

  protected labelOf(id: string): string {
    return this.labels().get(id) ?? id;
  }

  protected short(label: string): string {
    return label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label;
  }

  /** Icon shapes as data: SVG built with bindings works in server rendering (no innerHTML on SVG). */
  protected iconElements(name: string): IconElement[] {
    return ICON_ELEMENTS[name] ?? ICON_ELEMENTS['circle'] ?? [];
  }

  protected legendShape(category: ComponentCategory): string {
    return shapePath(category, NODE_W, NODE_H);
  }

  protected categoryLabel(category: ComponentCategory): string {
    return CATEGORY_LABELS[category];
  }
}
