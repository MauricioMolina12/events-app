import { Dialog } from '@angular/cdk/dialog';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ConfirmDialog,
  type ConfirmData,
  type ConfirmResult,
} from '@shared/ui/confirm-dialog/confirm-dialog';

const DISMISSED: ConfirmResult = { confirmed: false, note: '' };

/**
 * Promise-based wrapper over the shared confirm dialog.
 *
 * Escape / backdrop dismissal resolves to `{ confirmed: false }`, so callers can
 * always `if (!(await confirm.open(…)).confirmed) return;` without null checks.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly #dialog = inject(Dialog);

  async open(data: ConfirmData): Promise<ConfirmResult> {
    const ref = this.#dialog.open<ConfirmResult, ConfirmData, ConfirmDialog>(ConfirmDialog, {
      data,
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabelledBy: undefined,
      panelClass: 'app-dialog-panel',
    });
    return (await firstValueFrom(ref.closed)) ?? DISMISSED;
  }
}
