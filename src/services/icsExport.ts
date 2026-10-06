import { CircadianEvent, CircadianPlan } from '../types/circadian';

// Helper to format ISO date into ICS format: YYYYMMDDTHHmmssZ
function toIcsDate(isoUtc: string): string {
  const d = new Date(isoUtc);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function generateIcsFile(plan: CircadianPlan): string {
  const { events, roster } = plan;
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CrewCircadian//Aviation Circadian Fatigue Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${roster.airline.toUpperCase()} Roster & Circadian Planner`,
    'X-WR-TIMEZONE:UTC',
  ];

  // Guardrail notes (alcohol before duty, hard exercise before sleep) stay in the app, not in the calendar
  events.filter((e) => e.type !== 'alcohol_cutoff' && e.type !== 'exercise_cutoff').forEach((event: CircadianEvent) => {
    const dtStart = toIcsDate(event.startUtc);
    const dtEnd = toIcsDate(event.endUtc);
    const summary = `${event.title}`;
    const description = `${event.subtitle}\\n\\nSource: ${event.scientificCitation.organization} - ${event.scientificCitation.studyTitle}\\nTakeaway: ${event.scientificCitation.actionableTip}`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}-${Date.now()}@crewcircadian.aistudio`,
      `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `STATUS:CONFIRMED`,
      `TRANSP:${event.type.includes('sleep') || event.type.includes('flight') ? 'OPAQUE' : 'TRANSPARENT'}`
    );

    // Set reminder alarms:
    // For caffeine cutoffs: alarm 15 mins prior
    // For anchor sleep / recovery sleep: alarm 30 mins prior
    // For flights: alarm 120 mins prior
    if (event.type === 'caffeine_cutoff') {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:Caffeine cutoff starting soon - protect your sleep!',
        'TRIGGER:-PT15M',
        'END:VALARM'
      );
    } else if (event.type.includes('sleep')) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:Wind-down for scheduled sleep block (darkness & cool room)',
        'TRIGGER:-PT30M',
        'END:VALARM'
      );
    } else if (event.type === 'flight') {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:Flight Departure: ${event.title}`,
        'TRIGGER:-PT120M',
        'END:VALARM'
      );
    }

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcsFile(plan: CircadianPlan) {
  const icsContent = generateIcsFile(plan);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CrewCircadian_${plan.roster.airline}_${new Date().toISOString().slice(0, 10)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
