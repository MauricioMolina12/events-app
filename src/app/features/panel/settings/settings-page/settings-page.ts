import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SessionStore } from '@core/auth';
import { I18nService, TranslatePipe } from '@core/i18n';
import type { MessageKey } from '@core/i18n/messages';
import { ApiErrorPresenter, ConfirmService, ThemeService, ToastService } from '@core/ui';
import type { ThemePreference } from '@core/ui/theme.service';
import { contrastText, normalizeHex, shadeHex } from '@core/workspace/brand-color';
import { WorkspaceApi, type WorkspaceSettings } from '@core/workspace/workspace.api';
import { WorkspaceService } from '@core/workspace/workspace.service';
import {
  BrandMark,
  ButtonDirective,
  FieldControlDirective,
  FormField,
  Icon,
  PageHeader,
  Skeleton,
  type IconName,
} from '@shared/ui';

type SettingsTab = 'general' | 'identity' | 'appearance';

interface ThemeChoice {
  readonly value: ThemePreference;
  readonly labelKey: MessageKey;
  readonly icon: IconName;
}

@Component({
  selector: 'app-settings-page',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    PageHeader,
    ButtonDirective,
    FormField,
    FieldControlDirective,
    Icon,
    BrandMark,
    Skeleton,
  ],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  readonly #api = inject(WorkspaceApi);
  readonly #session = inject(SessionStore);
  readonly #i18n = inject(I18nService);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #confirm = inject(ConfirmService);
  readonly #toast = inject(ToastService);
  readonly #theme = inject(ThemeService);

  protected readonly workspace = inject(WorkspaceService);
  protected readonly canEdit = this.#session.isAdmin;
  protected readonly theme = this.#theme.preference;
  protected readonly tab = signal<SettingsTab>('general');
  protected readonly saving = signal(false);
  protected readonly restoring = signal(false);
  protected readonly saveError = signal('');
  protected readonly themes: readonly ThemeChoice[] = [
    { value: 'light', labelKey: 'app.theme.light', icon: 'sun' },
    { value: 'dark', labelKey: 'app.theme.dark', icon: 'moon' },
    { value: 'system', labelKey: 'app.theme.system', icon: 'monitor' },
  ];
  protected readonly tabs: readonly { id: SettingsTab; labelKey: MessageKey }[] = [
    { id: 'general', labelKey: 'settings.tab.general' },
    { id: 'identity', labelKey: 'settings.tab.identity' },
    { id: 'appearance', labelKey: 'settings.tab.appearance' },
  ];

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(280)],
    }),
    color: new FormControl('#C81F68', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)],
    }),
  });

  readonly #baseline = signal({ name: '', description: '', color: '#C81F68' });
  readonly #formTick = signal(0);
  #hydrated = false;

  protected readonly dirty = computed(() => {
    this.#formTick();
    const base = this.#baseline();
    const value = this.form.getRawValue();
    return (
      value.name !== base.name ||
      value.description !== base.description ||
      value.color.toUpperCase() !== base.color.toUpperCase()
    );
  });

  protected readonly colorError = computed(() => {
    this.#formTick();
    return normalizeHex(this.form.controls.color.value) ? '' : this.#i18n.t('settings.color.invalid');
  });

  protected readonly descriptionHint = computed(() => {
    this.#formTick();
    return `${this.#i18n.t('settings.general.descriptionHint')} ${this.form.controls.description.value.length}/280`;
  });

  protected readonly draftColor = computed(() => {
    this.#formTick();
    return normalizeHex(this.form.controls.color.value) ?? this.workspace.settings()?.primaryColor ?? '#C81F68';
  });

  protected readonly draftOn = computed(() => contrastText(this.draftColor()));
  protected readonly draftHover = computed(() => shadeHex(this.draftColor(), 0.86));

  protected readonly previewName = computed(() => {
    this.#formTick();
    const name = this.form.controls.name.value.trim();
    return name || this.workspace.displayName();
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.#formTick.update((value) => value + 1);
    });

    effect(() => {
      const settings = this.workspace.settings();
      if (!settings || this.#hydrated) {
        return;
      }
      this.#hydrated = true;
      this.#apply(settings);
    });
  }

  protected selectTab(next: SettingsTab): void {
    this.tab.set(next);
  }

  protected onTabKey(event: KeyboardEvent): void {
    const order = this.tabs.map((item) => item.id);
    const index = order.indexOf(this.tab());
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const next = order[(index + direction + order.length) % order.length];
      if (next) {
        this.tab.set(next);
      }
    }
  }

  protected onColorPicker(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.form.controls.color.setValue(value.toUpperCase());
    this.form.controls.color.markAsDirty();
  }

  protected cancel(): void {
    const settings = this.workspace.settings();
    if (settings) {
      this.#apply(settings);
    }
    this.saveError.set('');
  }

  protected setTheme(preference: ThemePreference): void {
    this.#theme.set(preference);
  }

  protected async save(): Promise<void> {
    if (!this.canEdit() || this.saving() || !this.dirty() || this.form.invalid) {
      return;
    }
    this.saving.set(true);
    this.saveError.set('');
    try {
      let current = this.workspace.settings();
      if (!current) {
        return;
      }
      const value = this.form.getRawValue();
      const base = this.#baseline();
      const patch: { displayName?: string; description?: string | null; primaryColor?: string } = {};
      if (value.name.trim() !== base.name) {
        patch.displayName = value.name.trim();
      }
      const description = value.description.trim();
      if (description !== base.description) {
        patch.description = description.length === 0 ? null : description;
      }
      const color = normalizeHex(value.color);
      if (color && color !== base.color.toUpperCase()) {
        patch.primaryColor = color;
      }
      if (patch.displayName || patch.description !== undefined || patch.primaryColor) {
        current = await firstValueFrom(this.#api.patch(patch));
      }
      this.workspace.replace(current);
      this.#apply(current);
      this.#toast.success('toast.saved');
    } catch (error) {
      this.saveError.set(this.#errors.message(error));
      await this.workspace.refresh();
    } finally {
      this.saving.set(false);
    }
  }

  protected async restore(): Promise<void> {
    if (!this.canEdit() || this.restoring()) {
      return;
    }
    const result = await this.#confirm.open({
      titleKey: 'settings.restore.title',
      bodyKey: 'settings.restore.body',
      confirmKey: 'settings.restore.confirm',
      tone: 'danger',
    });
    if (!result.confirmed) {
      return;
    }
    this.restoring.set(true);
    this.saveError.set('');
    try {
      const settings = await firstValueFrom(this.#api.restore());
      this.workspace.replace(settings);
      this.#apply(settings);
      this.#toast.success('toast.saved');
    } catch (error) {
      this.saveError.set(this.#errors.message(error));
    } finally {
      this.restoring.set(false);
    }
  }

  #apply(settings: WorkspaceSettings): void {
    this.form.reset({
      name: settings.displayName,
      description: settings.description ?? '',
      color: settings.primaryColor,
    });
    if (!this.#session.isAdmin()) {
      this.form.disable({ emitEvent: false });
    }
    this.#baseline.set({
      name: settings.displayName,
      description: settings.description ?? '',
      color: settings.primaryColor.toUpperCase(),
    });
    this.#formTick.update((value) => value + 1);
  }
}
