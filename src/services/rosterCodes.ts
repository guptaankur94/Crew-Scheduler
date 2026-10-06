import { OtherDuty } from '../types/circadian';

/*
 * ROSTER CODES
 *
 * What the common day codes printed on airline rosters mean. When a printed code is in this list, the list decides
 * the kind of day, not the AI reader, so the same code always means the same thing. Codes not listed fall back to
 * what the reader chose. Add airline-specific codes here as crew report them (with the airline in a comment).
 */

const DAY_CODES: Record<string, OtherDuty['kind']> = {
  // Days off
  OFF: 'off', DO: 'off', 'D/O': 'off', RD: 'off', GD: 'off', 'G/D': 'off', WOFF: 'off', WKOFF: 'off', ROFF: 'off', 'DAY OFF': 'off',
  // Leave
  AL: 'leave', CL: 'leave', PL: 'leave', LV: 'leave', LVE: 'leave', ML: 'leave', LEAVE: 'leave', HOL: 'leave',
  // Sick
  SCK: 'sick', SL: 'sick', 'S/L': 'sick', SICK: 'sick',
  // Training and simulator
  SIM: 'training', TRG: 'training', TRN: 'training', CRM: 'training', 'G/S': 'training', GS: 'training', SEP: 'training', REC: 'training', TRAINING: 'training',
};

/** Standby codes: home or airport. */
const STANDBY_CODES: Record<string, 'home' | 'airport'> = {
  SBY: 'home', HSBY: 'home', HSB: 'home', RSV: 'home', RSRV: 'home',
  ASBY: 'airport', ASB: 'airport', APSB: 'airport', 'AP SBY': 'airport',
};

const norm = (code: string) => code.trim().toUpperCase().replace(/\s+/g, ' ');

/** The kind of day a printed code means, if the code is a known one. */
export function dayKindForCode(code: string | undefined): OtherDuty['kind'] | undefined {
  return code ? DAY_CODES[norm(code)] : undefined;
}

/** Home or airport standby, if the printed code is a known standby code. */
export function standbyKindForCode(code: string | undefined): 'home' | 'airport' | undefined {
  return code ? STANDBY_CODES[norm(code)] : undefined;
}
