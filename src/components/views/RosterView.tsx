import React from 'react';
import { TimelineView, TimelineViewProps } from '../TimelineView';

/**
 * The Days tab (the timeline). The Month screen has its own tab, so this screen shows
 * only the timeline itself.
 */
export const RosterView: React.FC<TimelineViewProps> = (props) => <TimelineView {...props} />;
