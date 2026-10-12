import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService, type ThemePreference } from '@core/ui/theme.service';
import { TranslatePipe } from '@core/i18n';
import { ButtonDirective } from '../button.directive';
import { Icon, type IconName } from '../icon/icon';
import { Menu, MenuContentDirective, MenuTriggerDirective } from '../menu/menu';

const OPTIONS: readonly {
  readonly value: ThemePreference;
  readonly labelKey: 'app.theme.light' | 'app.theme.dark';
  readonly icon: IconName;
}[] = [
  { value: 'light', labelKey: 'app.theme.light', icon: 'sun' },
  { value: 'dark', labelKey: 'app.theme.dark', icon: 'moon' },
];

/**
 * Theme control as a compact menu: one icon in the navbar, three explicit options.
 */
@Component({
  selector: 'app-theme-toggle',
  imports: [TranslatePipe, Icon, ButtonDirective, Menu, MenuContentDirective, MenuTriggerDirective],
  templateUrl: './theme-toggle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  protected readonly options = OPTIONS;

  protected select(preference: ThemePreference, menu: Menu): void {
    this.theme.set(preference);
    menu.close();
  }

  protected currentIcon(): IconName {
    const preference = this.theme.preference();
    return OPTIONS.find((option) => option.value === preference)?.icon ?? 'sun';
  }
}
