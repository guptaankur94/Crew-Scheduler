import React from 'react';
import { CircadianEvent, CircadianPlan, CrewPreferences, FlightLeg } from '../../types/circadian';
import { TimelineView } from '../TimelineView';

interface RosterViewProps {
  plan: CircadianPlan;
  onSelectEvent: (event: CircadianEvent) => void;
  onNudgeEvent: (eventId: string, minutes: number) => void;
  onUpdatePreferences: (updated: Partial<CrewPreferences>) => void;
  customNudges: Record<string, number>;
  onCancelSector?: (flightId: string, convertToLayover: boolean) => void;
  onDelaySector?: (flightId: string, delayMinutes: number) => void;
  onDeleteSector?: (flightId: string) => void;
  onAddStandbyFlight?: (flight: FlightLeg) => void;
}

export const RosterView: React.FC<RosterViewProps> = ({
  plan,
  onSelectEvent,
  onNudgeEvent,
  onUpdatePreferences,
  customNudges,
  onCancelSector,
  onDelaySector,
  onDeleteSector,
  onAddStandbyFlight,
}) => {
  return (
    <div className="space-y-4">
      <TimelineView
        plan={plan}
        onSelectEvent={onSelectEvent}
        onNudgeEvent={onNudgeEvent}
        onUpdatePreferences={onUpdatePreferences}
        customNudges={customNudges}
        onCancelSector={onCancelSector}
        onDelaySector={onDelaySector}
        onDeleteSector={onDeleteSector}
        onAddStandbyFlight={onAddStandbyFlight}
      />
    </div>
  );
};
