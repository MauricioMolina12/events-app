import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '@core/api';
import type { ThemePreference } from '@core/ui/theme.service';

export interface WorkspaceSettings {
  readonly displayName: string;
  readonly description: string | null;
  readonly nameCustomized: boolean;
  readonly primaryColor: string;
  readonly colorCustomized: boolean;
  readonly logoUrl: string | null;
  readonly markUrl: string | null;
  readonly updatedAt: string;
}

export interface WorkspacePatch {
  readonly displayName?: string;
  readonly description?: string | null;
  readonly primaryColor?: string;
}

export interface UserPreferences {
  readonly theme: ThemePreference;
  readonly persisted: boolean;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceApi {
  readonly #api = inject(ApiClient);

  get(): Observable<WorkspaceSettings> {
    return this.#api.get<WorkspaceSettings>('workspace');
  }

  patch(body: WorkspacePatch): Observable<WorkspaceSettings> {
    return this.#api.patch<WorkspaceSettings>('workspace', body);
  }

  restore(): Observable<WorkspaceSettings> {
    return this.#api.post<WorkspaceSettings>('workspace/restore', {});
  }

  uploadLogo(file: File): Observable<WorkspaceSettings> {
    return this.#api.postForm<WorkspaceSettings>('workspace/logo', fileBody(file));
  }

  deleteLogo(): Observable<WorkspaceSettings> {
    return this.#api.delete<WorkspaceSettings>('workspace/logo');
  }

  uploadMark(file: File): Observable<WorkspaceSettings> {
    return this.#api.postForm<WorkspaceSettings>('workspace/mark', fileBody(file));
  }

  deleteMark(): Observable<WorkspaceSettings> {
    return this.#api.delete<WorkspaceSettings>('workspace/mark');
  }

  preferences(): Observable<UserPreferences> {
    return this.#api.get<UserPreferences>('me/preferences');
  }

  saveTheme(theme: ThemePreference): Observable<UserPreferences> {
    return this.#api.patch<UserPreferences>('me/preferences', { theme });
  }
}

function fileBody(file: File): FormData {
  const body = new FormData();
  body.set('file', file);
  return body;
}
