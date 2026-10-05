import React from 'react';
import { CircadianEvent, CircadianPlan, CrewPreferences, FlightLeg } from '../../types/circadian';
import { TimelineView } from '../TimelineView';

interface RosterViewProps {
  plan: CircadianPlan;
  onSelectEvent: (event: CircadianEvent) => void;
  onNudgeEvent: (eventId: string, minutes: number) => void;
  onUpdatePreferences: (updated: Partial<CrewPreferences>) => void;
  customNudges: Record<string, number>;
  onCancelSector?: (flightId: string) => void;
  cancelledFlights?: { flight: FlightLeg; sectorKey: string }[];
  onReinstateFlight?: (sectorKey: string) => void;
  onDelaySector?: (flightId: string, delayMinutes: number) => void;
  onDeleteSector?: (flightId: string) => void;
  onAddStandbyFlight?: (flight: FlightLeg) => void;
  /** Day to open on, e.g. when jumping in from the Month screen. */
  initialDate?: string;
  /** Opens the Month screen on the month containing this date. */
  onOpenMonthSummary?: (dateStr: string) => void;
}

/**
 * The Timeline tab. The Month screen and salary estimate have their own tabs, so this screen shows
 * only the timeline itself.
 */
export const RosterView: React.FC<RosterViewProps> = ({
  plan,
  onSelectEvent,
  onNudgeEvent,
  onUpdatePreferences,
  customNudges,
  onCancelSector,
  cancelledFlights,
  onReinstateFlight,
  onDelaySector,
  onDeleteSector,
  onAddStandbyFlight,
  initialDate,
  onOpenMonthSummary,
}) => (
  <TimelineView
    plan={plan}
    onSelectEvent={onSelectEvent}
    onNudgeEvent={onNudgeEvent}
    onUpdatePreferences={onUpdatePreferences}
    customNudges={customNudges}
    onCancelSector={onCancelSector}
    cancelledFlights={cancelledFlights}
    onReinstateFlight={onReinstateFlight}
    onDelaySector={onDelaySector}
    onDeleteSector={onDeleteSector}
    onAddStandbyFlight={onAddStandbyFlight}
    initialDate={initialDate}
    onOpenMonthSummary={onOpenMonthSummary}
  />
);
