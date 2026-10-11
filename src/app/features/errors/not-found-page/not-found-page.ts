import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@core/i18n';
import { ButtonDirective, EmptyState } from '@shared/ui';

/** Wildcard route. Kept inside the public shell so navigation stays available. */
@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, TranslatePipe, ButtonDirective, EmptyState],
  templateUrl: './not-found-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
