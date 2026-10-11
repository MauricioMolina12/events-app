import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';
import type { MessageKey, MessageParams } from './messages';

/**
 * `{{ 'catalog.hero.title' | t }}` / `{{ 'app.updatedAgo' | t: { value: '3 min' } }}`.
 *
 * The pipe reads the locale signal during template execution, so the host view is
 * marked dirty when the locale changes even under zoneless change detection.
 */
@Pipe({ name: 't' })
export class TranslatePipe implements PipeTransform {
  readonly #i18n = inject(I18nService);

  transform(key: MessageKey, params?: MessageParams): string {
    return this.#i18n.t(key, params);
  }
}
