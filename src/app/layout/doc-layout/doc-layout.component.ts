import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { IconComponent } from '../../shared/icon/icon.component';

let nextId = 0;

/**
 * Documentation layout: section sidebar (left), content column (max ~75ch),
 * "On this page" table of contents (right, wide screens only).
 * Project `[sidebar]` and `[toc]` elements; everything else is the content.
 */
@Component({
  selector: 'app-doc-layout',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="mx-auto grid max-w-7xl gap-x-10 gap-y-6 px-4 pt-8"
      [class]="
        withSidebar()
          ? 'lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_13rem]'
          : 'xl:grid-cols-[minmax(0,1fr)_13rem]'
      "
    >
      @if (withSidebar()) {
        <aside
          class="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto"
        >
          <button
            type="button"
            class="btn-secondary w-full justify-between lg:hidden"
            [attr.aria-controls]="sidebarId"
            [attr.aria-expanded]="sidebarOpen()"
            (click)="sidebarOpen.update((open) => !open)"
          >
            {{ sidebarLabel() }}
            <app-icon [name]="sidebarOpen() ? 'x' : 'chevron-down'" />
          </button>
          <div [id]="sidebarId" class="mt-3 lg:mt-0 lg:block" [class.hidden]="!sidebarOpen()">
            <ng-content select="[sidebar]" />
          </div>
        </aside>
      }
      <div class="min-w-0">
        <ng-content />
      </div>
      <div class="hidden xl:block">
        <div class="sticky top-20">
          <ng-content select="[toc]" />
        </div>
      </div>
    </div>
  `,
})
export class DocLayoutComponent {
  readonly withSidebar = input(true);
  readonly sidebarLabel = input('In this section');
  protected readonly sidebarOpen = signal(false);
  protected readonly sidebarId = `doc-sidebar-${nextId++}`;
}
