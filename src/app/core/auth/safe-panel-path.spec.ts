import { describe, expect, it } from 'vitest';
import { safePanelPath } from './safe-panel-path';

describe('safePanelPath', () => {
  it('keeps an internal panel path, including its own query and hash', () => {
    expect(safePanelPath('/panel')).toBe('/panel');
    expect(safePanelPath('/panel/cupos')).toBe('/panel/cupos');
    expect(safePanelPath('  /panel/cupos?evento=1#detalle  ')).toBe('/panel/cupos?evento=1#detalle');
  });

  it('rejects external, protocol-relative and auth screens', () => {
    expect(safePanelPath('https://evil.test/panel')).toBeNull();
    expect(safePanelPath('//evil.test/panel')).toBeNull();
    expect(safePanelPath('/\\evil.test')).toBeNull();
    expect(safePanelPath('/panel/login')).toBeNull();
    expect(safePanelPath('/panel/signup')).toBeNull();
    expect(safePanelPath('/panel/login/extra')).toBeNull();
    expect(safePanelPath('javascript:alert(1)')).toBeNull();
  });

  it('rejects paths that normalize outside the panel or hide an absolute url', () => {
    expect(safePanelPath('/panel/../secret')).toBeNull();
    expect(safePanelPath('/panel/%2e%2e/%2e%2e/evil')).toBeNull();
    expect(safePanelPath('/panel/cupos?next=https://evil.test')).toBeNull();
    expect(safePanelPath('/panel/cupos?next=//evil.test')).toBeNull();
    expect(safePanelPath('/panel/cupos#https://evil.test')).toBeNull();
  });

  it('rejects empty values, control characters and non-strings', () => {
    expect(safePanelPath('')).toBeNull();
    expect(safePanelPath('/panel/cupos\n')).toBeNull();
    expect(safePanelPath(null)).toBeNull();
    expect(safePanelPath(undefined)).toBeNull();
    expect(safePanelPath({ toString: () => '/panel' })).toBeNull();
  });
});
