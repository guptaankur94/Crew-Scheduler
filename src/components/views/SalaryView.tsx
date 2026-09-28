import React from 'react';
import { CircadianPlan, CrewPreferences } from '../../types/circadian';
import { SalarySection } from '../SalarySection';

interface SalaryViewProps {
  plan: CircadianPlan;
  onUpdatePreferences: (updated: Partial<CrewPreferences>) => void;
}

export const SalaryView: React.FC<SalaryViewProps> = ({
  plan,
  onUpdatePreferences,
}) => {
  return (
    <div className="space-y-4">
      {/* Full Dedicated Salary Studio */}
      <SalarySection
        plan={plan}
        onUpdatePreferences={onUpdatePreferences}
        isModal={false}
      />
    </div>
  );
};
