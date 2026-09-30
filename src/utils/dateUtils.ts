/**
 * Aviation Date & Time Formatting Utilities
 * Standardizes date formatting to ICAO / airline crew conventions (e.g., '1-Sep', '2-Sep', '14-Oct')
 */

export interface AviationDateOptions {
  padDay?: boolean; // false: '1-Sep', true: '01-Sep'
  uppercase?: boolean; // false: '1-Sep', true: '1-SEP'
  includeYear?: boolean; // false: '1-Sep', true: '1-Sep-26'
  includeWeekday?: boolean; // false: '1-Sep', true: 'Mon, 1-Sep'
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Normalizes string, Date or timestamp into a consistent Date object
 * Handles YYYY-MM-DD strings without timezone shift.
 */
function parseToUtcDate(input: string | Date | number): Date | null {
  if (!input) return null;

  if (typeof input === 'string') {
    // Pure YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      const [year, month, day] = input.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    }
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  return isNaN(input.getTime()) ? null : input;
}

/**
 * Formats a date or date string into standard aviation format: '1-Sep', '2-Sep', '15-Oct'
 * 
 * @param dateInput - ISO string, YYYY-MM-DD, or Date object
 * @param options - Customization for padding, uppercase, weekday, year
 * @returns Formatted aviation string e.g. '1-Sep'
 */
export function formatAviationDate(
  dateInput: string | Date | number,
  options?: AviationDateOptions
): string {
  const date = parseToUtcDate(dateInput);
  if (!date) return '';

  const day = date.getUTCDate();
  const monthIdx = date.getUTCMonth();
  const monthStr = MONTH_NAMES[monthIdx];

  const formattedDay = options?.padDay ? day.toString().padStart(2, '0') : day.toString();
  let formattedMonth = monthStr;
  if (options?.uppercase) {
    formattedMonth = formattedMonth.toUpperCase();
  }

  let result = `${formattedDay}-${formattedMonth}`;

  if (options?.includeYear) {
    const yearShort = date.getUTCFullYear().toString().slice(-2);
    result = `${result}-${yearShort}`;
  }

  if (options?.includeWeekday) {
    const weekdayStr = WEEKDAY_NAMES[date.getUTCDay()];
    result = `${weekdayStr}, ${result}`;
  }

  return result;
}

/**
 * Formats a date range into standard aviation shorthand: '1-Sep – 7-Sep' or '29-Aug – 4-Sep'
 */
export function formatAviationDateRange(
  startInput: string | Date | number,
  endInput: string | Date | number,
  options?: AviationDateOptions
): string {
  const startStr = formatAviationDate(startInput, options);
  const endStr = formatAviationDate(endInput, options);
  if (!startStr && !endStr) return '';
  if (!startStr) return endStr;
  if (!endStr) return startStr;
  return `${startStr} – ${endStr}`;
}

/**
 * Formats Month and Year: e.g. 'Sep 2026'
 */
export function formatAviationMonthYear(dateInput: string | Date | number): string {
  const date = parseToUtcDate(dateInput);
  if (!date) return '';
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Calculates duty debrief end time given a flight touchdown/arrival time string (e.g. '13:45') and debrief duration in minutes
 */
export function calculateDebriefEndTime(timeStr: string, debriefMinutes: number = 30): string {
  if (!timeStr) return '--:--';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const totalM = h * 60 + m + debriefMinutes;
  const newH = Math.floor((totalM % 1440) / 60);
  const newM = totalM % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
}

/**
 * Given a YYYY-MM-DD date string, returns the prior calendar day's YYYY-MM-DD string
 */
export function getPriorDayDateStr(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0));
  return date.toISOString().slice(0, 10);
}
