import React from 'react';
import { TimelineView, TimelineViewProps } from '../TimelineView';

/**
 * The Timeline tab. The Month screen and salary estimate have their own tabs, so this screen shows
 * only the timeline itself.
 */
export const RosterView: React.FC<TimelineViewProps> = (props) => <TimelineView {...props} />;
