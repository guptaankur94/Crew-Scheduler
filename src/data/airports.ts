import airportDb from './airportDb.json';
import { AirportInfo } from '../types/circadian';

export const AIRPORTS: Record<string, AirportInfo> = {
  // Primary Indian Hubs (IndiGo)
  DEL: { iata: 'DEL', name: 'Indira Gandhi International', city: 'Delhi', country: 'India', tzOffset: 5.5, timeZone: 'Asia/Kolkata' },
  BOM: { iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj', city: 'Mumbai', country: 'India', tzOffset: 5.5, timeZone: 'Asia/Kolkata' },
  BLR: { iata: 'BLR', name: 'Kempegowda International', city: 'Bengaluru', country: 'India', tzOffset: 5.5, timeZone: 'Asia/Kolkata' },
  HYD: { iata: 'HYD', name: 'Rajiv Gandhi International', city: 'Hyderabad', country: 'India', tzOffset: 5.5, timeZone: 'Asia/Kolkata' },
  CCU: { iata: 'CCU', name: 'Netaji Subhash Chandra Bose', city: 'Kolkata', country: 'India', tzOffset: 5.5, timeZone: 'Asia/Kolkata' },
  MAA: { iata: 'MAA', name: 'Chennai International', city: 'Chennai', country: 'India', tzOffset: 5.5, timeZone: 'Asia/Kolkata' },
  AMD: { iata: 'AMD', name: 'Sardar Vallabhbhai Patel', city: 'Ahmedabad', country: 'India', tzOffset: 5.5, timeZone: 'Asia/Kolkata' },
  GOI: { iata: 'GOI', name: 'Dabolim / Manohar International', city: 'Goa', country: 'India', tzOffset: 5.5, timeZone: 'Asia/Kolkata' },
  PNQ: { iata: 'PNQ', name: 'Pune Airport', city: 'Pune', country: 'India', tzOffset: 5.5, timeZone: 'Asia/Kolkata' },
  COK: { iata: 'COK', name: 'Cochin International', city: 'Kochi', country: 'India', tzOffset: 5.5, timeZone: 'Asia/Kolkata' },
  GAU: { iata: 'GAU', name: 'Lokpriya Gopinath Bordoloi', city: 'Guwahati', country: 'India', tzOffset: 5.5, timeZone: 'Asia/Kolkata' },
  TRV: { iata: 'TRV', name: 'Thiruvananthapuram International', city: 'Trivandrum', country: 'India', tzOffset: 5.5, timeZone: 'Asia/Kolkata' },
  IXC: { iata: 'IXC', name: 'Chandigarh International', city: 'Chandigarh', country: 'India', tzOffset: 5.5, timeZone: 'Asia/Kolkata' },

  // Middle East Hubs (IndiGo, Emirates, Etihad)
  DXB: { iata: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'UAE', tzOffset: 4, timeZone: 'Asia/Dubai' },
  AUH: { iata: 'AUH', name: 'Zayed International Airport', city: 'Abu Dhabi', country: 'UAE', tzOffset: 4, timeZone: 'Asia/Dubai' },
  DOH: { iata: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar', tzOffset: 3, timeZone: 'Asia/Qatar' },
  MCT: { iata: 'MCT', name: 'Muscat International', city: 'Muscat', country: 'Oman', tzOffset: 4, timeZone: 'Asia/Muscat' },
  BAH: { iata: 'BAH', name: 'Bahrain International', city: 'Manama', country: 'Bahrain', tzOffset: 3, timeZone: 'Asia/Bahrain' },
  KWI: { iata: 'KWI', name: 'Kuwait International', city: 'Kuwait City', country: 'Kuwait', tzOffset: 3, timeZone: 'Asia/Kuwait' },
  RUH: { iata: 'RUH', name: 'King Khalid International', city: 'Riyadh', country: 'Saudi Arabia', tzOffset: 3, timeZone: 'Asia/Riyadh' },
  JED: { iata: 'JED', name: 'King Abdulaziz International', city: 'Jeddah', country: 'Saudi Arabia', tzOffset: 3, timeZone: 'Asia/Riyadh' },

  // Southeast Asia & Far East (IndiGo, Emirates)
  SIN: { iata: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', tzOffset: 8, timeZone: 'Asia/Singapore' },
  BKK: { iata: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', tzOffset: 7, timeZone: 'Asia/Bangkok' },
  HKT: { iata: 'HKT', name: 'Phuket International', city: 'Phuket', country: 'Thailand', tzOffset: 7, timeZone: 'Asia/Bangkok' },
  KUL: { iata: 'KUL', name: 'Kuala Lumpur International', city: 'Kuala Lumpur', country: 'Malaysia', tzOffset: 8, timeZone: 'Asia/Kuala_Lumpur' },
  MLE: { iata: 'MLE', name: 'Velana International', city: 'Malé', country: 'Maldives', tzOffset: 5, timeZone: 'Indian/Maldives' },
  CMB: { iata: 'CMB', name: 'Bandaranaike International', city: 'Colombo', country: 'Sri Lanka', tzOffset: 5.5, timeZone: 'Asia/Colombo' },
  HAN: { iata: 'HAN', name: 'Noi Bai International', city: 'Hanoi', country: 'Vietnam', tzOffset: 7, timeZone: 'Asia/Ho_Chi_Minh' },

  // Europe & Americas (Emirates, Etihad, IndiGo codeshare)
  LHR: { iata: 'LHR', name: 'London Heathrow', city: 'London', country: 'UK', tzOffset: 1, timeZone: 'Europe/London' },
  CDG: { iata: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'France', tzOffset: 2, timeZone: 'Europe/Paris' },
  FRA: { iata: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', tzOffset: 2, timeZone: 'Europe/Berlin' },
  IST: { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey', tzOffset: 3, timeZone: 'Europe/Istanbul' },
  JFK: { iata: 'JFK', name: 'John F. Kennedy International', city: 'New York', country: 'USA', tzOffset: -4, timeZone: 'America/New_York' },
  ORD: { iata: 'ORD', name: 'O\'Hare International', city: 'Chicago', country: 'USA', tzOffset: -5, timeZone: 'America/Chicago' },
  SFO: { iata: 'SFO', name: 'San Francisco International', city: 'San Francisco', country: 'USA', tzOffset: -7, timeZone: 'America/Los_Angeles' },
  SYD: { iata: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australia', tzOffset: 10, timeZone: 'Australia/Sydney' },
};

export interface AirportRecord {
  iata: string;
  city: string;
  country: string;
  timeZone: string; // IANA zone, e.g. 'Asia/Kolkata'
}

const REFERENCE: Record<string, string[]> = airportDb.airports;

/**
 * The airport reference layer. Every airport with an IATA code in the offline dataset (airportsdata,
 * MIT licence) resolves to a verified record. Unknown codes return undefined: nothing is ever guessed.
 */
export function lookupAirport(iata: string): AirportRecord | undefined {
  const code = iata.trim().toUpperCase();
  const curated = AIRPORTS[code];
  if (curated?.timeZone) return { iata: code, city: curated.city, country: curated.country, timeZone: curated.timeZone };
  const row = REFERENCE[code];
  if (!row) return undefined;
  return { iata: code, timeZone: row[0], city: row[1] || code, country: row[2] };
}

export function isKnownAirport(iata: string): boolean {
  return lookupAirport(iata) !== undefined;
}

/**
 * UTC offset (in hours) of an IANA time zone at a specific instant.
 * Unlike the static `tzOffset` field, this accounts for daylight saving time.
 */
export function tzOffsetHoursAt(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallClockAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  const atSeconds = Math.floor(at.getTime() / 1000) * 1000;
  return Math.round((wallClockAsUtc - atSeconds) / 60000) / 60;
}

/**
 * UTC offset (in hours) of a verified airport at a specific instant, including daylight saving.
 * Returns undefined for an unknown airport or an invalid instant, so callers can never assume one.
 */
export function getAirportTzOffset(iata: string, at: Date | string): number | undefined {
  const airport = lookupAirport(iata);
  if (!airport) return undefined;
  const instant = typeof at === 'string' ? new Date(at) : at;
  if (isNaN(instant.getTime())) return undefined;
  try {
    return tzOffsetHoursAt(airport.timeZone, instant);
  } catch {
    return undefined;
  }
}

/**
 * Converts a wall-clock time at an airport (e.g. '2026-10-01', '06:30' at LHR) into a UTC Date,
 * using the airport's offset on that date. For an unknown airport an explicit `knownOffset` must be
 * supplied (for example one the user has already confirmed); otherwise the result is null.
 */
export function airportLocalToUtc(dateStr: string, timeStr: string, iata: string, knownOffset?: number): Date | null {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const naiveMs = Date.parse(`${dateStr}T${timeStr}:00Z`);
  if (isNaN(naiveMs)) return null;
  if (!isKnownAirport(iata)) {
    return knownOffset === undefined ? null : new Date(naiveMs - knownOffset * 3600000);
  }
  // First guess with the offset at the naive instant, then refine once so times near a clock change settle
  let offset = getAirportTzOffset(iata, new Date(naiveMs))!;
  offset = getAirportTzOffset(iata, new Date(naiveMs - offset * 3600000))!;
  return new Date(naiveMs - offset * 3600000);
}
