import React, { useState } from 'react';
import { CircadianEvent, CircadianPlan, CrewPreferences, FlightLeg } from '../../types/circadian';
import { TimelineView } from '../TimelineView';
import { MasterRosterOverview } from '../MasterRosterOverview';
import { Calendar, FileText, Clock } from 'lucide-react';

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
  initialTab?: 'timeline' | 'sheet';
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
  initialTab = 'timeline',
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'sheet'>(initialTab);
  const [timelineDate, setTimelineDate] = useState<string | undefined>(undefined);

  return (
    <div className="space-y-4">
      {/* 1. Presentation Mode Switcher Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Roster Presentation Mode
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'timeline'
                ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Chrono Timeline</span>
          </button>
          <button
            onClick={() => setActiveTab('sheet')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'sheet'
                ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Master Duty Sheet (AIMS)</span>
          </button>
        </div>
      </div>

      {/* 2. Render Active Mode */}
      {activeTab === 'timeline' ? (
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
          onSwitchToMasterSheet={() => setActiveTab('sheet')}
          initialDate={timelineDate}
        />
      ) : (
        <MasterRosterOverview
          plan={plan}
          onJumpToTimeline={(dateStr) => {
            setTimelineDate(dateStr);
            setActiveTab('timeline');
          }}
          onSelectEvent={onSelectEvent}
        />
      )}
    </div>
  );
};
