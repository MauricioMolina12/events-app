import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@core/i18n';
import { ButtonDirective } from '../button.directive';
import { Icon } from '../icon/icon';
import { Select, type SelectChoice } from '../select/select';

export interface PageSlice {
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

let paginationSeq = 0;

/** Offset/limit pager matching the API's `{ total, limit, offset }` envelope. */
@Component({
  selector: 'app-pagination',
  imports: [TranslatePipe, ButtonDirective, Icon, Select],
  templateUrl: './pagination.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pagination {
  readonly page = input.required<PageSlice>();
  readonly pageSizeOptions = input<readonly number[]>([10, 20, 50]);

  /** Emits the new `offset` (not a page number) to match the API contract. */
  readonly offsetChange = output<number>();
  readonly limitChange = output<number>();

  protected readonly limitId = `pagination-limit-${++paginationSeq}`;

  protected readonly pageNumber = computed(
    () => Math.floor(this.page().offset / this.page().limit) + 1,
  );

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.page().total / this.page().limit)),
  );

  protected readonly firstItem = computed(() =>
    this.page().total === 0 ? 0 : this.page().offset + 1,
  );

  protected readonly lastItem = computed(() =>
    Math.min(this.page().offset + this.page().limit, this.page().total),
  );

  protected readonly hasPrevious = computed(() => this.page().offset > 0);

  protected readonly hasNext = computed(
    () => this.page().offset + this.page().limit < this.page().total,
  );

  protected readonly limitChoices = computed<readonly SelectChoice[]>(() =>
    this.pageSizeOptions().map((size) => ({ value: String(size), label: String(size) })),
  );

  protected goToOffset(offset: number): void {
    const clamped = Math.max(0, Math.min(offset, (this.pageCount() - 1) * this.page().limit));
    if (clamped !== this.page().offset) {
      this.offsetChange.emit(clamped);
    }
  }

  protected previous(): void {
    this.goToOffset(this.page().offset - this.page().limit);
  }

  protected next(): void {
    this.goToOffset(this.page().offset + this.page().limit);
  }

  protected onLimitPicked(value: string): void {
    const limit = Number(value);
    if (limit > 0 && limit !== this.page().limit) {
      this.limitChange.emit(limit);
    }
  }
}
