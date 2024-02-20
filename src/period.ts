import { ICalError } from './error';
import { type ICalProperty } from './property';
import { ICalDuration, isValueString, fromString as ICalDurationFromStr } from './duration';
import { ICalTime, fromString as ICalTimeFromStr, fromDateTimeString } from './time';

export type ICalPeriodData = [string, string];

export interface ICalPeriodDict {
  start?: ICalTime;
  end?: ICalTime;
  duration?: ICalDuration;
}

/**
 * This class represents the "period" value type, with various calculation
 * and manipulation methods.
 */
export class ICalPeriod {
  start?: ICalTime;
  end?: ICalTime;
  duration?: ICalDuration;

  constructor(data?: ICalPeriodDict) {
    if (data && 'start' in data) {
      if (data.start && !(data.start instanceof ICalTime)) {
        throw new TypeError('.start must be an instance of ICAL.Time');
      }
      this.start = data.start;
    }

    if (data && data.end && data.duration) {
      throw new ICalError('cannot accept both end and duration');
    }

    if (data && 'end' in data) {
      if (data.end && !(data.end instanceof ICalTime)) {
        throw new TypeError('.end must be an instance of ICAL.Time');
      }
      this.end = data.end;
    }

    if (data && 'duration' in data) {
      if (data.duration && !(data.duration instanceof ICalDuration)) {
        throw new TypeError('.duration must be an instance of ICAL.Duration');
      }
      this.duration = data.duration;
    }
  }

  /**
   * The jCal representation of this period type.
   */
  toJSON(): ICalPeriodData {
    return [this.start!.toString(), (this.end || this.duration)!.toString()];
  }
}

export const fromData = (data: ICalPeriodDict) => {
  return new ICalPeriod(data);
};

export const fromJSON = (data: ICalPeriodData, prop: ICalProperty, lenient: boolean) => {
  const fromDateOrDateTimeString = (value: string) =>
    lenient ? ICalTimeFromStr(value, prop) : fromDateTimeString(value, prop);

  return isValueString(data[1])
    ? fromData({
        start: fromDateOrDateTimeString(data[0]),
        duration: ICalDurationFromStr(data[1])
      })
    : fromData({
        start: fromDateOrDateTimeString(data[0]),
        end: fromDateOrDateTimeString(data[1])
      });
};
