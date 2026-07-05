import { EventEmitter } from 'events';

const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

export const Events = {
  ATTENDANCE_MARKED: 'attendance:marked',
  INCIDENT_REPORTED: 'incident:reported',
  INCIDENT_UPDATED: 'incident:updated',
  SCHEDULE_REGENERATED: 'schedule:regenerated',
  INVIGILATOR_LOG_ADDED: 'invigilator:log_added',
  EMERGENCY_BROADCAST: 'broadcast:emergency',
  REPLACEMENT_REQUESTED: 'replacement:requested',
  REPLACEMENT_RESOLVED: 'replacement:resolved',
};

export default eventBus;
