import type { MessageKey } from '@core/i18n';
import type { EventPhase } from './dashboard.api';

export type PhaseTone = 'success' | 'info' | 'warning' | 'neutral';

const TONES: Record<EventPhase, PhaseTone> = {
  in_progress: 'success',
  registration_open: 'success',
  upcoming: 'info',
  registration_closed: 'warning',
  finished: 'neutral',
  draft: 'neutral',
  archived: 'neutral',
};

export function phaseTone(phase: EventPhase): PhaseTone {
  return TONES[phase];
}

export function phaseLabel(phase: EventPhase): MessageKey {
  return `dash.phase.${phase}` as MessageKey;
}

/** Live phases pulse; a finished, draft or archived event never looks active. */
export function isLivePhase(phase: EventPhase): boolean {
  return phase === 'in_progress' || phase === 'registration_open';
}
