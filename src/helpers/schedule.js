import { valueKey } from '@/helpers/firebase';

export function hasNoExistingSchedule(schedule) {
  return schedule[valueKey] === null;
}
export function isScheduleDisabled(schedule) {
  return schedule[valueKey] === false;
}
