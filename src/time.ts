import { ICalTimezone, ICalTimezoneService, localTimezone, utcTimezone } from './timezone';
import { type ICalProperty } from './property';
import { strictParseInt, pad2 } from './helpers';

interface ICalTimeDate {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  isDate?: boolean;
  timezone?: string;
  icaltype?: string;
  zone?: ICalTimezone;
}

export type WeekDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const ICAL_TIME_SUNDAY = 1;
export const ICAL_TIME_MONDAY = 2;
export const ICAL_TIME_TUESDAY = 3;
export const ICAL_TIME_WEDNESDAY = 4;
export const ICAL_TIME_THURSDAY = 5;
export const ICAL_TIME_FRIDAY = 6;
export const ICAL_TIME_SATURDAY = 7;

export const DEFAULT_WEEK_START = ICAL_TIME_MONDAY;

export class ICalTime {
  private time: ICalTimeDate;

  private year?: number;
  private month?: number;
  private day?: number;
  private hour?: number;
  private minute?: number;
  private second?: number;
  private isDate?: boolean;
  private zone?: ICalTimezone;

  private cachedUnixTime?: number | null;

  constructor(date: ICalTimeDate, zone?: ICalTimezone) {
    this.time = Object.create(null);
    this.time.year = 0;
    this.time.month = 1;
    this.time.day = 1;
    this.time.hour = 0;
    this.time.minute = 0;
    this.time.second = 0;
    this.time.isDate = false;

    this.fromData(date, zone);
  }

  /**
   * Sets up the current instance using members from the passed data object.
   */
  fromData(date?: ICalTimeDate, zone?: ICalTimezone) {
    if (date) {
      for (const key in date) {
        /* istanbul ignore else */
        if (Object.prototype.hasOwnProperty.call(date, key)) {
          // ical type cannot be set
          if (key === 'icaltype') continue;
          this[key] = date[key];
        }
      }
    }

    if (zone) this.zone = zone;

    if (date && !('isDate' in date)) {
      this.isDate = !('hour' in date);
    } else if (date && 'isDate' in date) {
      this.isDate = date.isDate!;
    }

    if (date && 'timezone' in date) {
      const zone = ICalTimezoneService.getZone(date.timezone!);
      this.zone = zone || localTimezone;
    }

    if (date && 'zone' in date) this.zone = date.zone!;

    if (!this.zone) this.zone = localTimezone;

    this.cachedUnixTime = null;
    return this;
  }

  /**
   * The string representation of this date/time, in jCal form
   * (including : and - separators).
   */
  toString(): string {
    let result = this.year! + '-' + pad2(this.month!) + '-' + pad2(this.day!);
    if (!this.isDate) {
      result += 'T' + pad2(this.hour!) + ':' + pad2(this.minute!) + ':' + pad2(this.second!);
      if (this.zone === utcTimezone) result += 'Z';
    }
    return result;
  }
}

/**
 * Returns a new ICAL.Time instance from a date-time string, e.g
 * 2015-01-02T03:04:05. If a property is specified, the timezone is set up
 * from the property's TZID parameter.
 * @param value The string to create from
 * @param prop The property the date belongs to
 */
export const fromDateTimeString = (value: string, prop?: ICalProperty) => {
  if (value.length < 19) {
    throw new Error('invalid date-time value: "' + value + '"');
  }

  const zone = value[19] && value[19] === 'Z' ? 'Z' : prop ? prop.getParameter('tzid') : void 0;

  return new ICalTime({
    year: strictParseInt(value.substr(0, 4)),
    month: strictParseInt(value.substr(5, 2)),
    day: strictParseInt(value.substr(8, 2)),
    hour: strictParseInt(value.substr(11, 2)),
    minute: strictParseInt(value.substr(14, 2)),
    second: strictParseInt(value.substr(17, 2)),
    timezone: zone
  });
};

/**
 * Returns a new ICAL.Time instance from a date string, e.g 2015-01-02.
 * @param value The string to create from
 */
export const fromDateString = (value: string) => {
  // Dates should have no timezone.
  // Google likes to sometimes specify Z on dates
  // we specifically ignore that to avoid issues.
  return new ICalTime({
    year: strictParseInt(value.substr(0, 4)),
    month: strictParseInt(value.substr(5, 2)),
    day: strictParseInt(value.substr(8, 2)),
    isDate: true
  });
};

/**
 * Returns a new ICAL.Time instance from a date or date-time string,
 * @param value The string to create from
 * @param prop The property the date belongs to
 */
export const fromString = (value: string, prop?: ICalProperty) => {
  if (value.length > 10) {
    return fromDateTimeString(value, prop);
  } else {
    return fromDateString(value);
  }
};
