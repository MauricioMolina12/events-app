import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import type { PublicEvent, PublicParticipation } from '@core/domain';
import { TranslatePipe, type MessageKey } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { loadingState, toAsyncState } from '@core/utils/async-state';
import { describeWindow, toZonedDateTimeDisplay } from '@core/utils/dates';
import { ButtonDirective, EmptyState, Icon, Skeleton, StatusBadge, type StatusKind } from '@shared/ui';
import { CatalogApi } from '../catalog.api';
import {
  participationStatusKind,
  registrableReason,
  registrableSedes,
} from '../participation-availability';
import { QuickActions } from '../quick-actions/quick-actions';

const PLACEHOLDER_BLOCKS: readonly number[] = [1, 2, 3];

/**
 * Event detail (`/eventos/:slug`).
 *
 * The page lists the published sedes with their **effective** window and the seats the
 * API still has (`available*`), so nothing here is computed client-side: the same
 * numbers the alta will re-check are the ones on screen. Picking a sede is what starts
 * the form, which is why the call to action is per sede and not on the event.
 */
@Component({
  selector: 'app-event-detail-page',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonDirective,
    EmptyState,
    Icon,
    QuickActions,
    Skeleton,
    StatusBadge,
  ],
  templateUrl: './event-detail-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventDetailPage {
  readonly slug = input.required<string>();

  readonly #api = inject(CatalogApi);
  readonly #errors = inject(ApiErrorPresenter);

  /** Bumped by `retry()`; part of the request so a retry re-subscribes. */
  readonly #attempt = signal(0);

  readonly #request = computed(() => ({ slug: this.slug(), attempt: this.#attempt() }));

  readonly state = toSignal(
    toObservable(this.#request).pipe(
      switchMap(({ slug }) => this.#api.getEvent(slug).pipe(toAsyncState())),
    ),
    { initialValue: loadingState<PublicEvent>() },
  );

  protected readonly placeholders = PLACEHOLDER_BLOCKS;

  protected readonly error = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.error : null;
  });

  protected readonly errorMessage = computed(() => {
    const error = this.error();
    return error ? this.#errors.message(error) : '';
  });

  protected readonly isOffline = computed(() => {
    const error = this.error();
    return error ? this.#errors.isOffline(error) : false;
  });

  /** A 404 is a missing event, not a failure: the screen says so instead of "error". */
  protected readonly isMissing = computed(() => {
    const error = this.error();
    return error ? this.#errors.isNotFound(error) : false;
  });

  protected retry(): void {
    this.#attempt.update((value) => value + 1);
  }

  protected openCount(event: PublicEvent): number {
    return event.participations.filter((participation) => participation.registrationOpen).length;
  }

  /** Schedule in the event's own timezone; empty when the date is still a draft. */
  protected whenLabel(event: PublicEvent): string {
    const startsAt = toZonedDateTimeDisplay(event.startsAt, event.timezone);
    const endsAt = event.endsAt ? toZonedDateTimeDisplay(event.endsAt, event.timezone) : '';
    return endsAt ? `${startsAt} – ${endsAt}` : startsAt;
  }

  /** Effective window of a sede: its own dates when it declares them, else the event's. */
  protected windowLabel(event: PublicEvent, participation: PublicParticipation): string {
    return describeWindow(
      participation.registrationOpensAt,
      participation.registrationClosesAt,
      event.timezone,
    );
  }

  /** The alta card only shows when at least one sede can take it right now. */
  protected hasRegistrable(event: PublicEvent): boolean {
    return registrableSedes(event).length > 0;
  }

  protected participationKind(participation: PublicParticipation): StatusKind {
    return participationStatusKind(participation);
  }

  /**
   * Why a sede cannot be picked, in the order the alta would reject it. `undefined`
   * means the CTA is live. The rule is shared with the form and the `/inscripcion` gate.
   */
  protected blockedReason(participation: PublicParticipation): MessageKey | undefined {
    return registrableReason(participation);
  }
}
