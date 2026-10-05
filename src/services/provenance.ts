import { FlightLeg, ImportSource, StandbyDuty } from '../types/circadian';

/**
 * Why the app believes a duty exists, in one short line: which upload it came from, and whether the
 * person added or changed it. Items with no recorded source (sample rosters, data saved before sources
 * were recorded) get no line rather than a guess.
 */

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const shorten = (title: string) => (title.length > 36 ? `${title.slice(0, 33)}…` : title);
const fromUpload = (src: ImportSource) => `From ${shorten(src.title)}, uploaded ${when(src.at)}`;

export function flightSource(f: FlightLeg): string | null {
  const base = baseSource(f);
  if (!f.operationalDelay) return base;
  const delay = `delayed +${f.operationalDelay.minutes} min (you)`;
  return base ? `${base} · ${delay}` : `Rostered flight · ${delay}`;
}

function baseSource(f: FlightLeg): string | null {
  if (f.userChange === 'added') return 'Added by you';
  if (f.userChange === 'callout') return 'Callout added by you';
  if (f.userChange === 'delayed') {
    const delay = `delayed${f.userDelayMinutes ? ` +${f.userDelayMinutes} min` : ''} by you`;
    return f.importedFrom ? `${fromUpload(f.importedFrom)} · ${delay}` : `Rostered time ${delay}`;
  }
  return f.importedFrom ? fromUpload(f.importedFrom) : null;
}

export function standbySource(sb: StandbyDuty): string | null {
  return sb.importedFrom ? fromUpload(sb.importedFrom) : null;
}
