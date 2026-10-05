import { FlightLeg } from '../types/circadian';
import { airportLocalToUtc, getAirportTzOffset, lookupAirport } from '../data/airports';

export interface ManualFlightInput {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  dateStr: string; // YYYY-MM-DD, local date of departure at the origin airport
  depTime: string; // HH:mm, local time at the origin airport
  arrTime: string; // HH:mm, local time at the destination airport
  reportLeadMinutes: number;
  releaseLagMinutes?: number;
}

const MAX_SECTOR_MINUTES = 20 * 60;

/**
 * Builds a FlightLeg from times typed by the user in airport-local time.
 * Returns an error string instead of guessing when the input cannot describe a real sector.
 */
export function buildManualFlight(input: ManualFlightInput): { flight: FlightLeg } | { error: string } {
  const flightNumber = input.flightNumber.trim().toUpperCase();
  const origin = input.origin.trim().toUpperCase();
  const destination = input.destination.trim().toUpperCase();

  if (!flightNumber) return { error: 'Enter a flight number.' };
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) {
    return { error: 'Origin and destination must be 3-letter airport codes (e.g. DEL, BOM).' };
  }
  for (const code of [origin, destination]) {
    if (!lookupAirport(code)) return { error: `${code} isn't a recognised airport code. Please check it.` };
  }

  const dep = airportLocalToUtc(input.dateStr, input.depTime, origin);
  let arr = airportLocalToUtc(input.dateStr, input.arrTime, destination);
  if (!dep || !arr) return { error: 'Enter a valid date, departure time and arrival time.' };

  // Arrival is typed as a clock time only, so roll it forward a day at a time until it follows departure
  let rolls = 0;
  while (arr.getTime() <= dep.getTime() && rolls < 2) {
    arr = new Date(arr.getTime() + 24 * 3600000);
    rolls++;
  }

  const durationMinutes = Math.round((arr.getTime() - dep.getTime()) / 60000);
  if (durationMinutes <= 0 || durationMinutes > MAX_SECTOR_MINUTES) {
    return { error: 'Those times give an impossible flight duration. Check the departure and arrival times.' };
  }

  const depUtc = dep.toISOString();
  const arrUtc = arr.toISOString();

  return {
    flight: {
      id: input.id,
      flightNumber,
      origin,
      originCity: lookupAirport(origin)!.city,
      destination,
      destinationCity: lookupAirport(destination)!.city,
      departureTimeUtc: depUtc,
      arrivalTimeUtc: arrUtc,
      reportTimeUtc: new Date(dep.getTime() - input.reportLeadMinutes * 60000).toISOString(),
      releaseTimeUtc: new Date(arr.getTime() + (input.releaseLagMinutes ?? 30) * 60000).toISOString(),
      originTzOffset: getAirportTzOffset(origin, dep)!,
      destTzOffset: getAirportTzOffset(destination, arr)!,
      durationMinutes,
      isRedEye: false,
    },
  };
}
