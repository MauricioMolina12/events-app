import { Injectable, computed, signal } from '@angular/core';
import type { PublicRegistrationReceipt } from '@core/domain';
import { storage } from '@core/utils/local-storage';

/**
 * What the receipt screen needs and the API does not return.
 *
 * `POST /public/registrations` answers with the receipt alone (code, titular and how
 * many companions). Event and sede names, the schedule and the companions' names come
 * from the form that was just filled in, so they are kept alongside the code as
 * context. Nothing here is authoritative: the server's copy is.
 */
export interface ReceiptContext {
  readonly eventSlug: string;
  readonly eventName: string;
  readonly eventTimeZone: string;
  readonly eventStartsAt: string | null;
  readonly establishmentName: string;
  readonly establishmentCity: string | null;
  readonly companionNames: readonly string[];
  /** Contact data for the "send the receipt" actions; the server never returns it. */
  readonly email: string | null;
  readonly phone: string | null;
}

export interface StoredReceipt {
  readonly receipt: PublicRegistrationReceipt;
  readonly context: ReceiptContext;
}

const STORAGE_KEY = 'public-receipts';

/** The list is a convenience, not an archive, so it is capped. */
const MAX_RECEIPTS = 20;

/** Horizon announced to the user (`register.receipt.notFoundBody`). */
const MAX_AGE_DAYS = 30;

/**
 * Per-device supplement to the receipt this browser created.
 *
 * `GET /public/registrations/{id}` returns the receipt alone (titular, document, count);
 * the event and sede names, the schedule, the companions' names and the contact data are
 * the extra context the form had and the server does not return, so they are kept here.
 * The confirmation screen reads the receipt from the network and merges this context in.
 */
@Injectable({ providedIn: 'root' })
export class ReceiptStore {
  readonly #records = signal<readonly StoredReceipt[]>(this.#load());

  readonly records = this.#records.asReadonly();
  readonly count = computed(() => this.#records().length);

  /** Newest first, or `null` when this device never saw that code. */
  find(id: string): StoredReceipt | null {
    return this.#records().find((record) => record.receipt.id === id) ?? null;
  }

  /** Idempotent: registering twice with the same code keeps a single copy. */
  save(record: StoredReceipt): void {
    this.#records.update((current) =>
      [record, ...current.filter((item) => item.receipt.id !== record.receipt.id)].slice(
        0,
        MAX_RECEIPTS,
      ),
    );
    this.#persist();
  }

  /** "Borrar mis datos": drops every receipt this browser kept. */
  clear(): void {
    this.#records.set([]);
    storage.remove(STORAGE_KEY);
  }

  #load(): readonly StoredReceipt[] {
    return storage.read<readonly StoredReceipt[]>(STORAGE_KEY, { maxAgeDays: MAX_AGE_DAYS }) ?? [];
  }

  #persist(): void {
    storage.write(STORAGE_KEY, this.#records());
  }
}
