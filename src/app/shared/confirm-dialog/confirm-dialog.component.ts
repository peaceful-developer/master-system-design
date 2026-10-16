import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel: string;
  /** Styles the confirm button as a destructive action. */
  danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Global class names, loaded with this component instead of in the initial bundle.
  encapsulation: ViewEncapsulation.None,
  styleUrl: './confirm-dialog.component.css',
  host: { class: 'dialog-panel' },
  template: `
    <h2 id="confirm-title" class="text-lg font-bold">{{ data.title }}</h2>
    <p id="confirm-body" class="mt-2">{{ data.body }}</p>
    <div class="mt-6 flex flex-wrap justify-end gap-3">
      <button type="button" class="btn-secondary" (click)="ref.close(false)">Cancel</button>
      <button
        type="button"
        [class]="data.danger ? 'btn btn-danger' : 'btn'"
        (click)="ref.close(true)"
      >
        {{ data.confirmLabel }}
      </button>
    </div>
  `,
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmOptions>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
}

/** Opens a modal confirmation; resolves true only when the confirm button is pressed. */
export async function confirmAction(dialog: Dialog, options: ConfirmOptions): Promise<boolean> {
  const ref = dialog.open<boolean, ConfirmOptions>(ConfirmDialogComponent, {
    data: options,
    role: 'alertdialog',
    ariaLabelledBy: 'confirm-title',
    ariaDescribedBy: 'confirm-body',
    autoFocus: 'first-tabbable',
    restoreFocus: true,
  });
  return (await firstValueFrom(ref.closed)) === true;
}
