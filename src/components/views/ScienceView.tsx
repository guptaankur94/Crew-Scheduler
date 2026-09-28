import React from 'react';
import { ScienceLab } from '../ScienceLab';

interface ScienceViewProps {
  onBackToToday: () => void;
}

export const ScienceView: React.FC<ScienceViewProps> = ({ onBackToToday }) => {
  return (
    <div className="space-y-4">
      <ScienceLab onClose={onBackToToday} />
    </div>
  );
};
