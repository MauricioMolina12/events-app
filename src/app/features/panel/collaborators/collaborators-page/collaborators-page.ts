import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, switchMap } from 'rxjs';
import { I18nService, TranslatePipe, type MessageKey } from '@core/i18n';
import { ApiErrorPresenter, ToastService } from '@core/ui';
import { loadingState, toAsyncState } from '@core/utils/async-state';
import { ButtonDirective, EmptyState, Icon, Skeleton, type IconName } from '@shared/ui';
import {
  CollaboratorsApi,
  type CollaboratorGroup,
  type PanelModule,
} from '../collaborators.api';

/** Modules the editor can grant. Anything else already stored is kept on save. */
const EDITABLE_MODULES = [
  'dashboard',
  'mesa',
  'ingreso',
  'eventos',
  'sedes',
  'cupos',
  'configuracion',
] as const satisfies readonly PanelModule[];

type EditableModule = (typeof EDITABLE_MODULES)[number];
type ModuleCategory = 'ops' | 'admin' | 'config';

interface ModuleCard {
  readonly id: EditableModule;
  readonly icon: IconName;
  readonly category: ModuleCategory;
}

const MODULE_CARDS: readonly ModuleCard[] = [
  { id: 'dashboard', icon: 'bar-chart', category: 'ops' },
  { id: 'mesa', icon: 'ticket', category: 'ops' },
  { id: 'ingreso', icon: 'log-in', category: 'ops' },
  { id: 'eventos', icon: 'calendar', category: 'admin' },
  { id: 'sedes', icon: 'map-pin', category: 'admin' },
  { id: 'cupos', icon: 'users', category: 'admin' },
  { id: 'configuracion', icon: 'settings', category: 'config' },
];

const CATEGORIES: readonly ModuleCategory[] = ['ops', 'admin', 'config'];
const DEFAULT_MODULES: readonly EditableModule[] = ['mesa', 'ingreso'];

/** True when two group names are the same once spaces and case are ignored. */
export function sameGroupName(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase('es') === right.trim().toLocaleLowerCase('es');
}

export function groupNameTaken(
  name: string,
  groups: readonly Pick<CollaboratorGroup, 'id' | 'name'>[],
  exceptId: string | null,
): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return false;
  }
  return groups.some((group) => group.id !== exceptId && sameGroupName(group.name, trimmed));
}

@Component({
  selector: 'app-collaborators-page',
  imports: [ReactiveFormsModule, TranslatePipe, ButtonDirective, EmptyState, Icon, Skeleton],
  templateUrl: './collaborators-page.html',
  styleUrl: './collaborators-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollaboratorsPage {
  readonly #api = inject(CollaboratorsApi);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #toast = inject(ToastService);
  readonly #i18n = inject(I18nService);
  readonly #attempt = signal(0);

  protected readonly categories = CATEGORIES;
  protected readonly cards = MODULE_CARDS;
  protected readonly groupSaving = signal(false);
  protected readonly memberSaving = signal(false);
  protected readonly groupError = signal('');
  protected readonly memberError = signal('');
  protected readonly groupSubmitted = signal(false);
  protected readonly memberSubmitted = signal(false);
  protected readonly groupEditorOpen = signal(false);
  protected readonly memberEditorOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly expandedId = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly term = signal('');
  protected readonly selectedModules = signal<ReadonlySet<EditableModule>>(new Set(DEFAULT_MODULES));
  /** Modules the editor does not show, kept when a group is updated. */
  readonly #keptModules = signal<readonly PanelModule[]>([]);

  protected readonly groupForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)],
    }),
  });
  protected readonly memberForm = new FormGroup({
    groupId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(160)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(160)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12), Validators.maxLength(128)],
    }),
  });

  readonly #groupValue = toSignal(this.groupForm.valueChanges, {
    initialValue: this.groupForm.getRawValue(),
  });
  readonly #memberStatus = toSignal(this.memberForm.statusChanges, {
    initialValue: this.memberForm.status,
  });

  readonly state = toSignal(
    toObservable(this.#attempt).pipe(switchMap(() => this.#api.list().pipe(toAsyncState()))),
    { initialValue: loadingState<readonly CollaboratorGroup[]>() },
  );

  protected readonly groups = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.value : [];
  });

  protected readonly memberCount = computed(() =>
    this.groups().reduce((total, group) => total + group.members.length, 0),
  );

  protected readonly filteredGroups = computed(() => {
    const query = this.term().trim().toLocaleLowerCase('es');
    const groups = this.groups();
    if (query.length === 0) {
      return groups;
    }
    return groups.filter((group) => {
      if (group.name.toLocaleLowerCase('es').includes(query)) {
        return true;
      }
      if (
        group.members.some(
          (member) =>
            member.fullName.toLocaleLowerCase('es').includes(query) ||
            member.email.toLocaleLowerCase('es').includes(query),
        )
      ) {
        return true;
      }
      return group.modules.some((module) =>
        this.#i18n.t(this.moduleLabel(module)).toLocaleLowerCase('es').includes(query),
      );
    });
  });

  protected readonly nameTaken = computed(() => {
    this.#groupValue();
    return groupNameTaken(
      this.groupForm.controls.name.value,
      this.groups(),
      this.editingId(),
    );
  });

  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.status === 'error' ? this.#errors.message(state.error) : '';
  });

  protected cardsIn(category: ModuleCategory): readonly ModuleCard[] {
    return this.cards.filter((card) => card.category === category);
  }

  protected moduleLabel(module: PanelModule): MessageKey {
    return `collaborators.module.${module}` as MessageKey;
  }

  protected moduleHint(module: EditableModule): MessageKey {
    return `collaborators.module.${module}.hint`;
  }

  protected categoryLabel(category: ModuleCategory): MessageKey {
    return `collaborators.category.${category}`;
  }

  protected moduleOn(module: EditableModule): boolean {
    return this.selectedModules().has(module);
  }

  protected toggleModule(module: EditableModule): void {
    if (this.groupSaving()) {
      return;
    }
    const next = new Set(this.selectedModules());
    if (next.has(module)) {
      next.delete(module);
    } else {
      next.add(module);
    }
    this.selectedModules.set(next);
  }

  protected nameError(): MessageKey | null {
    this.#groupValue();
    const control = this.groupForm.controls.name;
    if (!this.groupSubmitted() && !control.touched) {
      return null;
    }
    if (control.hasError('required') || control.hasError('minlength')) {
      return 'collaborators.validation.name';
    }
    if (this.nameTaken()) {
      return 'collaborators.validation.duplicate';
    }
    return null;
  }

  protected memberErrorFor(
    name: 'groupId' | 'fullName' | 'email' | 'password',
  ): MessageKey | null {
    this.#memberStatus();
    const control = this.memberForm.controls[name];
    if (!this.memberSubmitted() && !control.touched) {
      return null;
    }
    if (control.valid) {
      return null;
    }
    const keys = {
      groupId: 'collaborators.validation.group',
      fullName: 'collaborators.validation.fullName',
      email: 'collaborators.validation.email',
      password: 'collaborators.validation.password',
    } as const;
    return keys[name];
  }

  protected retry(): void {
    this.#attempt.update((value) => value + 1);
  }

  protected openCreateGroup(): void {
    if (this.groupEditorOpen() && this.editingId() === null) {
      this.#scrollTo('group-editor');
      return;
    }
    this.editingId.set(null);
    this.#keptModules.set([]);
    this.groupSubmitted.set(false);
    this.groupError.set('');
    this.groupForm.reset({ name: '' });
    this.selectedModules.set(new Set(DEFAULT_MODULES));
    this.groupEditorOpen.set(true);
    this.#scrollTo('group-editor');
  }

  protected editGroup(group: CollaboratorGroup): void {
    const editable = new Set<EditableModule>();
    const kept: PanelModule[] = [];
    for (const module of group.modules) {
      if ((EDITABLE_MODULES as readonly string[]).includes(module)) {
        editable.add(module as EditableModule);
      } else {
        kept.push(module);
      }
    }
    this.editingId.set(group.id);
    this.#keptModules.set(kept);
    this.groupSubmitted.set(false);
    this.groupError.set('');
    this.groupForm.reset({ name: group.name });
    this.selectedModules.set(editable);
    this.groupEditorOpen.set(true);
    this.#scrollTo('group-editor');
  }

  protected closeGroupEditor(): void {
    this.groupEditorOpen.set(false);
    this.editingId.set(null);
    this.#keptModules.set([]);
    this.groupSubmitted.set(false);
    this.groupError.set('');
  }

  protected clearGroupForm(): void {
    this.groupSubmitted.set(false);
    this.groupError.set('');
    this.groupForm.reset({ name: '' });
    this.selectedModules.set(new Set(DEFAULT_MODULES));
  }

  protected openMemberEditor(groupId?: string): void {
    if (groupId) {
      this.memberForm.controls.groupId.setValue(groupId);
    }
    if (this.memberEditorOpen()) {
      this.#scrollTo('member-editor');
      return;
    }
    this.memberSubmitted.set(false);
    this.memberError.set('');
    this.showPassword.set(false);
    this.memberEditorOpen.set(true);
    this.#scrollTo('member-editor');
  }

  protected closeMemberEditor(): void {
    this.memberEditorOpen.set(false);
    this.memberSubmitted.set(false);
    this.memberError.set('');
    this.showPassword.set(false);
  }

  protected toggleMembers(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  protected async createGroup(): Promise<void> {
    this.groupSubmitted.set(true);
    if (
      this.groupForm.invalid ||
      this.selectedModules().size === 0 ||
      this.nameTaken() ||
      this.groupSaving()
    ) {
      this.groupForm.markAllAsTouched();
      return;
    }
    this.groupSaving.set(true);
    this.groupError.set('');
    const name = this.groupForm.controls.name.value.trim();
    const modules = [...this.selectedModules(), ...this.#keptModules()];
    const editingId = this.editingId();
    try {
      if (editingId) {
        await firstValueFrom(this.#api.updateGroup(editingId, { name, modules }));
        this.#toast.success('collaborators.updated');
      } else {
        await firstValueFrom(this.#api.createGroup(name, modules));
        this.#toast.success('collaborators.saved');
      }
      this.closeGroupEditor();
      this.#attempt.update((value) => value + 1);
    } catch (error: unknown) {
      this.groupError.set(this.#errors.message(error));
    } finally {
      this.groupSaving.set(false);
    }
  }

  protected async addMember(): Promise<void> {
    this.memberSubmitted.set(true);
    if (this.memberForm.invalid || this.memberSaving()) {
      this.memberForm.markAllAsTouched();
      return;
    }
    this.memberSaving.set(true);
    this.memberError.set('');
    const value = this.memberForm.getRawValue();
    try {
      await firstValueFrom(
        this.#api.addMember(value.groupId, {
          fullName: value.fullName.trim(),
          email: value.email.trim(),
          password: value.password,
        }),
      );
      this.#toast.success('collaborators.memberSaved');
      this.memberForm.reset({ groupId: value.groupId, fullName: '', email: '', password: '' });
      this.memberSubmitted.set(false);
      this.showPassword.set(false);
      this.#attempt.update((count) => count + 1);
    } catch (error: unknown) {
      this.memberError.set(this.#errors.message(error));
    } finally {
      this.memberSaving.set(false);
    }
  }

  #scrollTo(id: string): void {
    queueMicrotask(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
}
