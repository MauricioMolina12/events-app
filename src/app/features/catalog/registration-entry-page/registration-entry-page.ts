import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap, type Observable } from 'rxjs';
import type { PublicEvent, PublicParticipation } from '@core/domain';
import { TranslatePipe, type MessageKey } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { loadingState, toAsyncState } from '@core/utils/async-state';
import { describeWindow, toZonedDateTimeDisplay } from '@core/utils/dates';
import {
  ButtonDirective,
  EmptyState,
  Icon,
  Skeleton,
  StatusBadge,
  type StatusKind,
} from '@shared/ui';
import { CATALOG_MAX_PAGE_SIZE, CatalogApi } from '../catalog.api';
import {
  participationStatusKind,
  registrableReason,
  registrableSedes,
} from '../participation-availability';

const PLACEHOLDER_BLOCKS: readonly number[] = [1, 2, 3];

/** A candidate event and the sedes that can actually take an alta. */
interface EventOption {
  readonly event: PublicEvent;
  readonly registrable: readonly PublicParticipation[];
}

/** A sede the gate can hand the form over to. */
interface Target {
  readonly event: PublicEvent;
  readonly participation: PublicParticipation;
}

/**
 * Public entry point for a shared link (`/inscripcion`).
 *
 * A message on WhatsApp or an email cannot carry a slug the reader has to understand, so the
 * short path resolves the destination instead: `?evento=` names the event, `?sede=` names the
 * sede, and with neither the catalogue decides. The gate then hands over to the **canonical**
 * `/eventos/:slug/inscripcion` — the form is not duplicated and its URL stays the one the
 * event detail already links to. The sede travels under the hood (navigation state), never in
 * the URL, so a shared link never exposes the participation id.
 *
 * It redirects only when the answer is unambiguous (the link named the sede, or exactly one
 * sede can take an alta); with several candidates it asks, because guessing would silently
 * enrol someone in the wrong sede. Unavailable, closed, outside-the-window and full sedes are
 * painted with the reason they are blocked, so a dead end still explains itself. Nothing here
 * authenticates: the catalogue and the alta are public by design.
 */
@Component({
  selector: 'app-registration-entry-page',
  imports: [TranslatePipe, RouterLink, ButtonDirective, EmptyState, Icon, Skeleton, StatusBadge],
  templateUrl: './registration-entry-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationEntryPage {
  /** `?evento=` — the event the link points at. */
  readonly evento = input<string | undefined>(undefined);
  /** `?sede=` — the sede the link points at; only honoured inside the named event. */
  readonly sede = input<string | undefined>(undefined);

  readonly #api = inject(CatalogApi);
  readonly #router = inject(Router);
  readonly #errors = inject(ApiErrorPresenter);

  /** Bumped by `retry()`; part of the request so a retry re-subscribes. */
  readonly #attempt = signal(0);

  readonly #request = computed(() => ({
    evento: this.evento()?.trim() || undefined,
    attempt: this.#attempt(),
  }));

  /**
   * Candidates in catalogue order. Naming an event asks the API for that one, which is also
   * what turns a stale slug into an honest 404 instead of an empty picker.
   */
  readonly state = toSignal(
    toObservable(this.#request).pipe(
      switchMap(({ evento }) => this.#load(evento).pipe(toAsyncState())),
    ),
    { initialValue: loadingState<readonly PublicEvent[]>() },
  );

  protected readonly placeholders = PLACEHOLDER_BLOCKS;

  readonly #events = computed<readonly PublicEvent[]>(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.value : [];
  });

  /** Every candidate with the sedes that can take an alta right now. */
  readonly #options = computed<readonly EventOption[]>(() =>
    this.#events().map((event) => ({ event, registrable: registrableSedes(event) })),
  );

  /** Flattened so "is there exactly one?" is a length and not a guess. */
  readonly #targets = computed<readonly Target[]>(() =>
    this.#options().flatMap((option) =>
      option.registrable.map((participation) => ({ event: option.event, participation })),
    ),
  );

  /**
   * The sede a link without ambiguity must mean: the one it named, or the only one that can
   * take an alta. `undefined` means the reader has to choose.
   */
  readonly #unique = computed<Target | undefined>(() => {
    const targets = this.#targets();
    const requested = this.sede();
    if (requested) {
      const named = targets.find((target) => target.participation.id === requested);
      if (named) {
        return named;
      }
    }
    if (this.#choose) {
      return undefined;
    }
    return targets.length === 1 ? targets[0] : undefined;
  });

  /**
   * Set by the catalogue's quick access (navigation state, not the URL): the reader came to
   * pick, so a single open sede is listed instead of skipped.
   */
  readonly #choose =
    (inject(Location).getState() as { readonly choose?: boolean } | null | undefined)?.choose ===
    true;

  /** Rows the picker paints: the named event alone, else every event that can still enrol. */
  protected readonly rows = computed<readonly PublicEvent[]>(() => {
    const named = Boolean(this.evento()?.trim());
    return this.#options()
      .filter((option) => named || option.registrable.length > 0)
      .map((option) => option.event);
  });

  /** The hand-over is settled: the template shows it instead of the picker. */
  protected readonly redirecting = computed(() => this.#unique() !== undefined);

  /** At least one sede in the catalogue can take an alta right now. */
  protected readonly hasOpen = computed(() => this.#targets().length > 0);

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

  #handedOver = false;

  constructor() {
    /**
     * The hand-over is a side effect, not a template branch: `replaceUrl` keeps the back
     * button pointing at whatever the reader came from instead of re-running the gate.
     */
    effect(() => {
      const target = this.#unique();
      if (!target || this.#handedOver) {
        return;
      }
      this.#handedOver = true;
      void this.#router.navigate(['/eventos', target.event.slug, 'inscripcion'], {
        state: { sede: target.participation.id },
        replaceUrl: true,
      });
    });
  }

  protected retry(): void {
    this.#attempt.update((value) => value + 1);
  }

  protected kind(participation: PublicParticipation): StatusKind {
    return participationStatusKind(participation);
  }

  /** Why a sede cannot be picked; `undefined` means its CTA is live. */
  protected blockedReason(participation: PublicParticipation): MessageKey | undefined {
    return registrableReason(participation);
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

  /** The whole catalogue, or the one event a shared link named. */
  #load(evento: string | undefined): Observable<readonly PublicEvent[]> {
    if (evento) {
      return this.#api.getEvent(evento).pipe(map((event): readonly PublicEvent[] => [event]));
    }
    return this.#api.listEvents({ limit: CATALOG_MAX_PAGE_SIZE }).pipe(map((page) => page.items));
  }
}
