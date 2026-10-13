import { RosterData, RosterHistoryEntry } from '../types/circadian';

/*
 * SMALLER CHANGE HISTORY ON THE DEVICE
 *
 * Each history entry keeps a full copy of the roster (for Undo and "Restore this point"), so the same flights are
 * repeated in every entry. On save, every flight, standby and listed day is stored once in a shared pool and the
 * entries point to it; on load they are put back exactly as they were. Nothing is lost.
 */

const LISTS = ['flights', 'standbyDuties', 'otherDuties'] as const;
type ListKey = (typeof LISTS)[number];

export interface CompactHistory {
  v: 2;
  pool: unknown[];
  entries: unknown[];
}

export function compactHistory(entries: RosterHistoryEntry[]): CompactHistory {
  const pool: unknown[] = [];
  const index = new Map<string, number>();
  const ref = (item: unknown) => {
    const key = JSON.stringify(item);
    let i = index.get(key);
    if (i === undefined) {
      i = pool.length;
      pool.push(item);
      index.set(key, i);
    }
    return i;
  };
  const shrink = (r?: RosterData) => {
    if (!r) return r;
    const out: Record<string, unknown> = { ...r };
    for (const k of LISTS) if (Array.isArray(r[k])) out[k] = { $ref: (r[k] as unknown[]).map(ref) };
    return out;
  };
  return { v: 2, pool, entries: entries.map((e) => ({ ...e, rosterSnapshot: shrink(e.rosterSnapshot), previousSnapshot: shrink(e.previousSnapshot) })) };
}

export function expandHistory(stored: unknown): RosterHistoryEntry[] {
  if (Array.isArray(stored)) return stored as RosterHistoryEntry[]; // saved before compaction
  const c = stored as CompactHistory;
  if (!c || c.v !== 2 || !Array.isArray(c.pool) || !Array.isArray(c.entries)) return [];
  const grow = (r?: Record<string, unknown>) => {
    if (!r) return r;
    const out: Record<string, unknown> = { ...r };
    for (const k of LISTS as readonly ListKey[]) {
      const v = r[k] as { $ref?: number[] } | undefined;
      if (v && Array.isArray(v.$ref)) out[k] = v.$ref.map((i) => c.pool[i]);
    }
    return out as unknown as RosterData;
  };
  return c.entries.map((e) => {
    const entry = e as RosterHistoryEntry & { rosterSnapshot?: Record<string, unknown>; previousSnapshot?: Record<string, unknown> };
    const out = { ...entry, rosterSnapshot: grow(entry.rosterSnapshot), previousSnapshot: grow(entry.previousSnapshot) } as RosterHistoryEntry;
    if (out.rosterSnapshot === undefined) delete out.rosterSnapshot;
    if (out.previousSnapshot === undefined) delete out.previousSnapshot;
    return out;
  });
}
