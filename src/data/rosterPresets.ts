import { RosterData } from '../types/circadian';

export interface RosterPreset {
  id: string;
  name: string;
  airline?: string;
  airlineName?: string;
  badge: string;
  description: string;
  roster: RosterData;
}

// Generate dates relative to current date (e.g. day 0 to day 29)
function getIsoDates() {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  
  const d = (dayOffset: number, hour: number, minute: number = 0) => {
    const target = new Date(base.getTime() + dayOffset * 86400000 + hour * 3600000 + minute * 60000);
    return target.toISOString();
  };

  return { d, base };
}

export function getPresets(): RosterPreset[] {
  const { d } = getIsoDates();

  return [
    // 1. FLAGSHIP 30-DAY MONTHLY CABIN CREW ROSTER
    {
      id: 'monthly-30day-roster',
      name: 'Full 30-Day Monthly Roster (32 Sectors & Layovers)',
      badge: '30-Day Full Month',
      description: 'Comprehensive 30-day cabin crew roster: domestic shuttles, red-eye Gulf sectors (DXB/DOH), Singapore layover, weekly rest days (WKOFF), and standby duty.',
      roster: {
        id: 'roster-30day-full',
        airline: 'airline',
        homeBase: 'DEL',
        homeBaseTzOffset: 5.5,
        totalDays: 30,
        parsedAt: new Date().toISOString(),
        flights: [
          // WEEK 1: Early morning domestic & red-eye
          // Day 0: DEL -> BOM -> BLR
          {
            id: 'fl-01',
            flightNumber: '6E 205',
            origin: 'DEL',
            originCity: 'Delhi',
            destination: 'BOM',
            destinationCity: 'Mumbai',
            departureTimeUtc: d(0, 1, 0), // 06:30 IST
            arrivalTimeUtc: d(0, 3, 15), // 08:45 IST
            reportTimeUtc: d(0, 0, 0), // 05:30 IST
            releaseTimeUtc: d(0, 3, 45),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 135,
            aircraftType: 'A321neo',
          },
          {
            id: 'fl-02',
            flightNumber: '6E 5312',
            origin: 'BOM',
            originCity: 'Mumbai',
            destination: 'BLR',
            destinationCity: 'Bengaluru',
            departureTimeUtc: d(0, 4, 45), // 10:15 IST
            arrivalTimeUtc: d(0, 6, 30), // 12:00 IST
            reportTimeUtc: d(0, 4, 15),
            releaseTimeUtc: d(0, 7, 0),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 105,
            aircraftType: 'A320neo',
          },
          // Day 1: BLR -> HYD -> DEL
          {
            id: 'fl-03',
            flightNumber: '6E 6814',
            origin: 'BLR',
            originCity: 'Bengaluru',
            destination: 'HYD',
            destinationCity: 'Hyderabad',
            departureTimeUtc: d(1, 1, 30), // 07:00 IST
            arrivalTimeUtc: d(1, 2, 45), // 08:15 IST
            reportTimeUtc: d(1, 0, 30),
            releaseTimeUtc: d(1, 3, 15),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 75,
            aircraftType: 'A320neo',
          },
          {
            id: 'fl-04',
            flightNumber: '6E 2108',
            origin: 'HYD',
            originCity: 'Hyderabad',
            destination: 'DEL',
            destinationCity: 'Delhi',
            departureTimeUtc: d(1, 4, 15), // 09:45 IST
            arrivalTimeUtc: d(1, 6, 45), // 12:15 IST
            reportTimeUtc: d(1, 3, 45),
            releaseTimeUtc: d(1, 7, 15),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 150,
            aircraftType: 'A321neo',
          },
          // Day 2: DEL -> CCU -> DEL (Afternoon Turn)
          {
            id: 'fl-05',
            flightNumber: '6E 213',
            origin: 'DEL',
            originCity: 'Delhi',
            destination: 'CCU',
            destinationCity: 'Kolkata',
            departureTimeUtc: d(2, 8, 30), // 14:00 IST
            arrivalTimeUtc: d(2, 10, 45), // 16:15 IST
            reportTimeUtc: d(2, 7, 30),
            releaseTimeUtc: d(2, 11, 15),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 135,
            aircraftType: 'A321neo',
          },
          {
            id: 'fl-06',
            flightNumber: '6E 214',
            origin: 'CCU',
            originCity: 'Kolkata',
            destination: 'DEL',
            destinationCity: 'Delhi',
            departureTimeUtc: d(2, 11, 45), // 17:15 IST
            arrivalTimeUtc: d(2, 14, 0), // 19:30 IST
            reportTimeUtc: d(2, 11, 15),
            releaseTimeUtc: d(2, 14, 30),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 135,
            aircraftType: 'A321neo',
          },
          // Day 3: DEL -> DXB Red-Eye (Departing 01:00 IST / 19:30 UTC)
          {
            id: 'fl-07',
            flightNumber: '6E 1401',
            origin: 'DEL',
            originCity: 'Delhi',
            destination: 'DXB',
            destinationCity: 'Dubai',
            departureTimeUtc: d(3, 19, 30), // 01:00 IST
            arrivalTimeUtc: d(3, 23, 15), // 04:45 IST / 03:15 DXB
            reportTimeUtc: d(3, 18, 0), // 23:30 IST
            releaseTimeUtc: d(4, 0, 0),
            originTzOffset: 5.5,
            destTzOffset: 4,
            durationMinutes: 225,
            aircraftType: 'A321neo',
            isRedEye: true,
          },
          // Day 4: DXB -> DEL Return (05:00 DXB / 06:30 IST)
          {
            id: 'fl-08',
            flightNumber: '6E 1402',
            origin: 'DXB',
            originCity: 'Dubai',
            destination: 'DEL',
            destinationCity: 'Delhi',
            departureTimeUtc: d(4, 1, 0), // 06:30 IST
            arrivalTimeUtc: d(4, 4, 30), // 10:00 IST
            reportTimeUtc: d(4, 0, 15),
            releaseTimeUtc: d(4, 5, 0),
            originTzOffset: 4,
            destTzOffset: 5.5,
            durationMinutes: 210,
            aircraftType: 'A321neo',
            isRedEye: true,
          },
          // Day 5: OFF DAY (Rest & Circadian Alignment)
          // Day 6: OFF DAY (Rest & Sleep Banking)

          // WEEK 2: Domestic Western trunk & Doha Gulf
          // Day 7: DEL -> BOM Evening
          {
            id: 'fl-09',
            flightNumber: '6E 201',
            origin: 'DEL',
            originCity: 'Delhi',
            destination: 'BOM',
            destinationCity: 'Mumbai',
            departureTimeUtc: d(7, 12, 0), // 17:30 IST
            arrivalTimeUtc: d(7, 14, 15), // 19:45 IST
            reportTimeUtc: d(7, 11, 0),
            releaseTimeUtc: d(7, 14, 45),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 135,
            aircraftType: 'A321neo',
          },
          // Day 8: BOM -> GOI -> BOM
          {
            id: 'fl-10',
            flightNumber: '6E 501',
            origin: 'BOM',
            originCity: 'Mumbai',
            destination: 'GOI',
            destinationCity: 'Goa',
            departureTimeUtc: d(8, 3, 30), // 09:00 IST
            arrivalTimeUtc: d(8, 4, 45), // 10:15 IST
            reportTimeUtc: d(8, 2, 30),
            releaseTimeUtc: d(8, 5, 15),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 75,
            aircraftType: 'A320neo',
          },
          {
            id: 'fl-11',
            flightNumber: '6E 502',
            origin: 'GOI',
            originCity: 'Goa',
            destination: 'BOM',
            destinationCity: 'Mumbai',
            departureTimeUtc: d(8, 6, 0), // 11:30 IST
            arrivalTimeUtc: d(8, 7, 15), // 12:45 IST
            reportTimeUtc: d(8, 5, 30),
            releaseTimeUtc: d(8, 7, 45),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 75,
            aircraftType: 'A320neo',
          },
          // Day 9: BOM -> DOH Red-Eye (01:30 IST)
          {
            id: 'fl-12',
            flightNumber: '6E 1307',
            origin: 'BOM',
            originCity: 'Mumbai',
            destination: 'DOH',
            destinationCity: 'Doha',
            departureTimeUtc: d(9, 20, 0), // 01:30 IST (+1)
            arrivalTimeUtc: d(9, 23, 45), // 05:15 IST / 02:45 DOH
            reportTimeUtc: d(9, 18, 30),
            releaseTimeUtc: d(10, 0, 30),
            originTzOffset: 5.5,
            destTzOffset: 3,
            durationMinutes: 225,
            aircraftType: 'A320neo',
            isRedEye: true,
          },
          // Day 10: DOH -> BOM Return
          {
            id: 'fl-13',
            flightNumber: '6E 1308',
            origin: 'DOH',
            originCity: 'Doha',
            destination: 'BOM',
            destinationCity: 'Mumbai',
            departureTimeUtc: d(10, 1, 30), // 04:30 DOH / 07:00 IST
            arrivalTimeUtc: d(10, 5, 15), // 10:45 IST
            reportTimeUtc: d(10, 0, 45),
            releaseTimeUtc: d(10, 5, 45),
            originTzOffset: 3,
            destTzOffset: 5.5,
            durationMinutes: 225,
            aircraftType: 'A320neo',
            isRedEye: true,
          },
          // Day 11: BOM -> DEL Repositioning
          {
            id: 'fl-14',
            flightNumber: '6E 2487',
            origin: 'BOM',
            originCity: 'Mumbai',
            destination: 'DEL',
            destinationCity: 'Delhi',
            departureTimeUtc: d(11, 10, 30), // 16:00 IST
            arrivalTimeUtc: d(11, 12, 45), // 18:15 IST
            reportTimeUtc: d(11, 9, 30),
            releaseTimeUtc: d(11, 13, 15),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 135,
            aircraftType: 'A321neo',
          },
          // Day 12: OFF DAY (Weekly Rest)
          // Day 13: OFF DAY (Sleep Banking)

          // WEEK 3: Singapore International Layover & Domestic North
          // Day 14: DEL -> SIN (13:00 IST departure)
          {
            id: 'fl-15',
            flightNumber: '6E 1007',
            origin: 'DEL',
            originCity: 'Delhi',
            destination: 'SIN',
            destinationCity: 'Singapore',
            departureTimeUtc: d(14, 7, 30), // 13:00 IST
            arrivalTimeUtc: d(14, 13, 15), // 21:15 SIN / 18:45 IST
            reportTimeUtc: d(14, 6, 0),
            releaseTimeUtc: d(14, 14, 0),
            originTzOffset: 5.5,
            destTzOffset: 8,
            durationMinutes: 345,
            aircraftType: 'A321neo LR',
          },
          // Day 15: Singapore 28h Layover (Rest day on Home Base Time)
          // Day 16: SIN -> DEL Red-Eye (04:00 SIN / 01:30 IST)
          {
            id: 'fl-16',
            flightNumber: '6E 1008',
            origin: 'SIN',
            originCity: 'Singapore',
            destination: 'DEL',
            destinationCity: 'Delhi',
            departureTimeUtc: d(16, 20, 0), // 04:00 SIN / 01:30 IST (+1)
            arrivalTimeUtc: d(17, 2, 15), // 07:45 IST
            reportTimeUtc: d(16, 18, 30),
            releaseTimeUtc: d(17, 3, 0),
            originTzOffset: 8,
            destTzOffset: 5.5,
            durationMinutes: 375,
            aircraftType: 'A321neo LR',
            isRedEye: true,
          },
          // Day 17: DEL Arrival Day + Sleep Recovery
          // Day 18: OFF DAY (Post Long-Haul Rest)
          // Day 19: DEL -> PNQ -> DEL (Pune Afternoon Turn)
          {
            id: 'fl-17',
            flightNumber: '6E 6105',
            origin: 'DEL',
            originCity: 'Delhi',
            destination: 'PNQ',
            destinationCity: 'Pune',
            departureTimeUtc: d(19, 9, 30), // 15:00 IST
            arrivalTimeUtc: d(19, 11, 45), // 17:15 IST
            reportTimeUtc: d(19, 8, 30),
            releaseTimeUtc: d(19, 12, 15),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 135,
            aircraftType: 'A320neo',
          },
          {
            id: 'fl-18',
            flightNumber: '6E 6106',
            origin: 'PNQ',
            originCity: 'Pune',
            destination: 'DEL',
            destinationCity: 'Delhi',
            departureTimeUtc: d(19, 12, 45), // 18:15 IST
            arrivalTimeUtc: d(19, 15, 0), // 20:30 IST
            reportTimeUtc: d(19, 12, 15),
            releaseTimeUtc: d(19, 15, 30),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 135,
            aircraftType: 'A320neo',
          },
          // Day 20: DEL -> IXC -> DEL (Chandigarh Shuttles)
          {
            id: 'fl-19',
            flightNumber: '6E 211',
            origin: 'DEL',
            originCity: 'Delhi',
            destination: 'IXC',
            destinationCity: 'Chandigarh',
            departureTimeUtc: d(20, 5, 30), // 11:00 IST
            arrivalTimeUtc: d(20, 6, 30), // 12:00 IST
            reportTimeUtc: d(20, 4, 30),
            releaseTimeUtc: d(20, 7, 0),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 60,
            aircraftType: 'ATR 72-600',
          },
          {
            id: 'fl-20',
            flightNumber: '6E 212',
            origin: 'IXC',
            originCity: 'Chandigarh',
            destination: 'DEL',
            destinationCity: 'Delhi',
            departureTimeUtc: d(20, 7, 30), // 13:00 IST
            arrivalTimeUtc: d(20, 8, 30), // 14:00 IST
            reportTimeUtc: d(20, 7, 0),
            releaseTimeUtc: d(20, 9, 0),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 60,
            aircraftType: 'ATR 72-600',
          },

          // WEEK 4: Bangkok Sector & Southern Trunk
          // Day 21: DEL -> BKK
          {
            id: 'fl-21',
            flightNumber: '6E 1053',
            origin: 'DEL',
            originCity: 'Delhi',
            destination: 'BKK',
            destinationCity: 'Bangkok',
            departureTimeUtc: d(21, 3, 0), // 08:30 IST
            arrivalTimeUtc: d(21, 7, 45), // 14:45 BKK / 13:15 IST
            reportTimeUtc: d(21, 1, 30),
            releaseTimeUtc: d(21, 8, 30),
            originTzOffset: 5.5,
            destTzOffset: 7,
            durationMinutes: 285,
            aircraftType: 'A321neo',
          },
          // Day 22: Bangkok 24h Layover
          // Day 23: BKK -> DEL
          {
            id: 'fl-22',
            flightNumber: '6E 1054',
            origin: 'BKK',
            originCity: 'Bangkok',
            destination: 'DEL',
            destinationCity: 'Delhi',
            departureTimeUtc: d(23, 8, 0), // 15:00 BKK / 13:30 IST
            arrivalTimeUtc: d(23, 13, 0), // 18:30 IST
            reportTimeUtc: d(23, 6, 30),
            releaseTimeUtc: d(23, 13, 45),
            originTzOffset: 7,
            destTzOffset: 5.5,
            durationMinutes: 300,
            aircraftType: 'A321neo',
          },
          // Day 24: OFF DAY (Weekly Rest)
          // Day 25: DEL -> MAA -> DEL (Chennai Trunk)
          {
            id: 'fl-23',
            flightNumber: '6E 2205',
            origin: 'DEL',
            originCity: 'Delhi',
            destination: 'MAA',
            destinationCity: 'Chennai',
            departureTimeUtc: d(25, 4, 30), // 10:00 IST
            arrivalTimeUtc: d(25, 7, 30), // 13:00 IST
            reportTimeUtc: d(25, 3, 15),
            releaseTimeUtc: d(25, 8, 0),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 180,
            aircraftType: 'A321neo',
          },
          {
            id: 'fl-24',
            flightNumber: '6E 2206',
            origin: 'MAA',
            originCity: 'Chennai',
            destination: 'DEL',
            destinationCity: 'Delhi',
            departureTimeUtc: d(25, 8, 45), // 14:15 IST
            arrivalTimeUtc: d(25, 11, 45), // 17:15 IST
            reportTimeUtc: d(25, 8, 15),
            releaseTimeUtc: d(25, 12, 15),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 180,
            aircraftType: 'A321neo',
          },
          // Day 26: DEL -> AMD -> DEL (Ahmedabad Evening)
          {
            id: 'fl-25',
            flightNumber: '6E 245',
            origin: 'DEL',
            originCity: 'Delhi',
            destination: 'AMD',
            destinationCity: 'Ahmedabad',
            departureTimeUtc: d(26, 13, 0), // 18:30 IST
            arrivalTimeUtc: d(26, 14, 30), // 20:00 IST
            reportTimeUtc: d(26, 12, 0),
            releaseTimeUtc: d(26, 15, 0),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 90,
            aircraftType: 'A320neo',
          },
          {
            id: 'fl-26',
            flightNumber: '6E 246',
            origin: 'AMD',
            originCity: 'Ahmedabad',
            destination: 'DEL',
            destinationCity: 'Delhi',
            departureTimeUtc: d(26, 15, 30), // 21:00 IST
            arrivalTimeUtc: d(26, 17, 0), // 22:30 IST
            reportTimeUtc: d(26, 15, 0),
            releaseTimeUtc: d(26, 17, 30),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 90,
            aircraftType: 'A320neo',
          },
          // Day 27: OFF DAY (Rest)

          // WEEK 5: Month-End Shuttles & Standby
          // Day 28: DEL -> BOM -> DEL
          {
            id: 'fl-27',
            flightNumber: '6E 5001',
            origin: 'DEL',
            originCity: 'Delhi',
            destination: 'BOM',
            destinationCity: 'Mumbai',
            departureTimeUtc: d(28, 2, 0), // 07:30 IST
            arrivalTimeUtc: d(28, 4, 15), // 09:45 IST
            reportTimeUtc: d(28, 1, 0),
            releaseTimeUtc: d(28, 4, 45),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 135,
            aircraftType: 'A321neo',
          },
          {
            id: 'fl-28',
            flightNumber: '6E 5002',
            origin: 'BOM',
            originCity: 'Mumbai',
            destination: 'DEL',
            destinationCity: 'Delhi',
            departureTimeUtc: d(28, 5, 30), // 11:00 IST
            arrivalTimeUtc: d(28, 7, 45), // 13:15 IST
            reportTimeUtc: d(28, 5, 0),
            releaseTimeUtc: d(28, 8, 15),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 135,
            aircraftType: 'A321neo',
          },
          // Day 29: Standby Duty / Home Base Rest
        ],
        layovers: [
          {
            id: 'lay-sin-month',
            airport: 'SIN',
            city: 'Singapore',
            tzOffset: 8,
            startUtc: d(14, 14, 0),
            endUtc: d(16, 18, 30),
            durationHours: 28.5,
            strategy: 'home_base_time',
          },
          {
            id: 'lay-bkk-month',
            airport: 'BKK',
            city: 'Bangkok',
            tzOffset: 7,
            startUtc: d(21, 8, 30),
            endUtc: d(23, 6, 30),
            durationHours: 22.0,
            strategy: 'home_base_time',
          },
        ],
      },
    },

    // 2. SHORT 4-DAY DOMESTIC ROTATION
    {
      id: 'indigo-domestic-del-bom-blr',
      name: '4-Day Domestic Multi-Sector (Early Shift)',
      badge: '4-Day Rotation',
      description: 'High-frequency domestic roster with 04:30 AM check-in, multiple turnarounds (DEL-BOM-BLR-HYD-DEL), testing anchor sleep banking.',
      roster: {
        id: 'roster-indigo-dom-01',
        airline: 'airline',
        homeBase: 'DEL',
        homeBaseTzOffset: 5.5,
        totalDays: 4,
        parsedAt: new Date().toISOString(),
        flights: [
          {
            id: 'fl-101',
            flightNumber: '6E 205',
            origin: 'DEL',
            originCity: 'Delhi',
            destination: 'BOM',
            destinationCity: 'Mumbai',
            departureTimeUtc: d(0, 1, 0),
            arrivalTimeUtc: d(0, 3, 15),
            reportTimeUtc: d(0, 0, 0),
            releaseTimeUtc: d(0, 3, 45),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 135,
            aircraftType: 'A321neo',
          },
          {
            id: 'fl-102',
            flightNumber: '6E 5312',
            origin: 'BOM',
            originCity: 'Mumbai',
            destination: 'BLR',
            destinationCity: 'Bengaluru',
            departureTimeUtc: d(0, 4, 45),
            arrivalTimeUtc: d(0, 6, 30),
            reportTimeUtc: d(0, 4, 15),
            releaseTimeUtc: d(0, 7, 0),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 105,
            aircraftType: 'A320neo',
          },
          {
            id: 'fl-103',
            flightNumber: '6E 6814',
            origin: 'BLR',
            originCity: 'Bengaluru',
            destination: 'HYD',
            destinationCity: 'Hyderabad',
            departureTimeUtc: d(1, 1, 30),
            arrivalTimeUtc: d(1, 2, 45),
            reportTimeUtc: d(1, 0, 30),
            releaseTimeUtc: d(1, 3, 15),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 75,
            aircraftType: 'A320neo',
          },
          {
            id: 'fl-104',
            flightNumber: '6E 2108',
            origin: 'HYD',
            originCity: 'Hyderabad',
            destination: 'DEL',
            destinationCity: 'Delhi',
            departureTimeUtc: d(1, 4, 15),
            arrivalTimeUtc: d(1, 6, 45),
            reportTimeUtc: d(1, 3, 45),
            releaseTimeUtc: d(1, 7, 15),
            originTzOffset: 5.5,
            destTzOffset: 5.5,
            durationMinutes: 150,
            aircraftType: 'A321neo',
          },
        ],
        layovers: [],
      },
    },

    // 3. RED-EYE GULF TURNAROUND
    {
      id: 'indigo-redeye-gulf-bom-dxb',
      name: 'Red-Eye Gulf Turnaround (BOM-DXB-BOM)',
      badge: 'Red-Eye Sector',
      description: 'Overnight Gulf turnaround operating in Window of Circadian Low (WOCL 02:00-06:00 IST). Pre-duty nap & morning melatonin protection.',
      roster: {
        id: 'roster-redeye-02',
        airline: 'airline',
        homeBase: 'BOM',
        homeBaseTzOffset: 5.5,
        totalDays: 3,
        parsedAt: new Date().toISOString(),
        flights: [
          {
            id: 'fl-201',
            flightNumber: '6E 1401',
            origin: 'BOM',
            originCity: 'Mumbai',
            destination: 'DXB',
            destinationCity: 'Dubai',
            departureTimeUtc: d(0, 19, 30),
            arrivalTimeUtc: d(0, 23, 0),
            reportTimeUtc: d(0, 18, 0),
            releaseTimeUtc: d(0, 23, 45),
            originTzOffset: 5.5,
            destTzOffset: 4,
            durationMinutes: 210,
            aircraftType: 'A321neo',
            isRedEye: true,
          },
          {
            id: 'fl-202',
            flightNumber: '6E 1402',
            origin: 'DXB',
            originCity: 'Dubai',
            destination: 'BOM',
            destinationCity: 'Mumbai',
            departureTimeUtc: d(1, 0, 45),
            arrivalTimeUtc: d(1, 4, 15),
            reportTimeUtc: d(1, 0, 0),
            releaseTimeUtc: d(1, 4, 45),
            originTzOffset: 4,
            destTzOffset: 5.5,
            durationMinutes: 210,
            aircraftType: 'A321neo',
            isRedEye: true,
          },
        ],
        layovers: [],
      },
    },
  ];
}
