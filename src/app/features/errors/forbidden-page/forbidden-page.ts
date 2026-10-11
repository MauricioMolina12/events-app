import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@core/i18n';
import { ButtonDirective, EmptyState } from '@shared/ui';

/**
 * Shown when `roleGuard` rejects a route. The API is the real boundary; this page only
 * explains why the operator's menu does not include what they asked for.
 */
@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink, TranslatePipe, ButtonDirective, EmptyState],
  templateUrl: './forbidden-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenPage {}
