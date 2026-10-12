import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  booleanAttribute,
  inject,
  input,
  signal,
} from '@angular/core';
import { I18nService, TranslatePipe } from '@core/i18n';
import { ToastService } from '@core/ui';
import { ButtonDirective } from '../button.directive';
import { Icon } from '../icon/icon';
import { Menu, MenuContentDirective, MenuTriggerDirective } from '../menu/menu';

/**
 * Invite people to a public event: WhatsApp, email or a copied inscription link.
 */
@Component({
  selector: 'app-event-invite',
  imports: [
    TranslatePipe,
    ButtonDirective,
    Icon,
    Menu,
    MenuContentDirective,
    MenuTriggerDirective,
  ],
  templateUrl: './event-invite.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventInvite {
  readonly name = input.required<string>();
  readonly slug = input.required<string>();
  readonly compact = input(false, { transform: booleanAttribute });

  readonly #i18n = inject(I18nService);
  readonly #toast = inject(ToastService);
  readonly #destroy = inject(DestroyRef);

  protected readonly copied = signal(false);
  #copiedReset: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.#destroy.onDestroy(() => {
      if (this.#copiedReset !== undefined) {
        clearTimeout(this.#copiedReset);
      }
    });
  }

  protected url(): string {
    return `${window.location.origin}/eventos/${this.slug()}`;
  }

  protected whatsappHref(): string {
    return `https://wa.me/?text=${encodeURIComponent(this.#shareText())}`;
  }

  protected mailtoHref(): string {
    const subject = encodeURIComponent(
      this.#i18n.t('events.invite.subject', { name: this.name() }),
    );
    const body = encodeURIComponent(this.#shareText());
    return `mailto:?subject=${subject}&body=${body}`;
  }

  protected async copyLink(menu: Menu): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url());
      this.copied.set(true);
      this.#toast.success('events.action.copied');
      if (this.#copiedReset !== undefined) {
        clearTimeout(this.#copiedReset);
      }
      this.#copiedReset = setTimeout(() => this.copied.set(false), 1800);
    } catch {
      this.copied.set(false);
      this.#toast.warning('ui.copy.failed');
    }
    menu.close();
  }

  #shareText(): string {
    return this.#i18n.t('events.invite.message', { name: this.name(), url: this.url() });
  }
}
