import type { Union } from '@lspriv/wx-calendar/lib';
import { ICalError } from './error';
import { strictParseInt, clone } from './helpers';
import { ICalendar } from './design';
import {
  ICalTime,
  type WeekDay,
  ICAL_TIME_SUNDAY,
  ICAL_TIME_MONDAY,
  ICAL_TIME_TUESDAY,
  ICAL_TIME_WEDNESDAY,
  ICAL_TIME_THURSDAY,
  ICAL_TIME_FRIDAY,
  ICAL_TIME_SATURDAY,
  fromString as ICalTimeFromStr,
  DEFAULT_WEEK_START
} from './time';

const VALID_BYDAY_PART = /^([+-])?(5[0-3]|[1-4][0-9]|[1-9])?(SU|MO|TU|WE|TH|FR|SA)$/;
const VALID_DAY_NAMES = /^(SU|MO|TU|WE|TH|FR|SA)$/;

enum DOW_MAP {
  SU = ICAL_TIME_SUNDAY,
  MO = ICAL_TIME_MONDAY,
  TU = ICAL_TIME_TUESDAY,
  WE = ICAL_TIME_WEDNESDAY,
  TH = ICAL_TIME_THURSDAY,
  FR = ICAL_TIME_FRIDAY,
  SA = ICAL_TIME_SATURDAY
}

export interface ICalRecurDict {
  freq?: FrequencyValue;
  count?: number;
  interval?: number;
  until?: ICalTime | string;
  wkst?: number | string;
  bysecond?: number;
  byminute?: number;
  byhour?: number;
  byday?: string;
  bymonthday?: number;
  byyearday?: number;
  byweekno?: number;
  bymonth?: number;
  bysetpos?: number;
}

type ICalRecurParts = {
  [K in keyof ICalRecurDict as Uppercase<K>]: ICalRecurDict[K] extends Array<any>
    ? [ICalRecurDict[K]]
    : ICalRecurDict[K];
};

/**
 * This class represents the "recur" value type, with various calculation
 * and manipulation methods.
 */
export class ICalRecur implements ICalRecurDict {
  /** An object holding the BY-parts of the recurrence rule */
  parts: ICalRecurParts;
  /** The interval value for the recurrence rule. */
  interval: number = 1;
  /** The week start day */
  wkst: WeekDay = ICAL_TIME_MONDAY;
  /** The end of the recurrence */
  until?: ICalTime;
  /** The maximum number of occurrences */
  count?: number;
  /** The frequency value. */
  freq?: FrequencyValue;
  /** The class identifier. */
  icalclass = 'icalrecur' as const;
  /** The type name, to be used in the jCal object. */
  icaltype = 'recur' as const;

  constructor(data?: ICalRecurDict) {
    this.parts = {};

    if (data && typeof data === 'object') {
      this.fromData(data);
    }
  }

  fromData(data: ICalRecurDict) {
    for (const key in data) {
      const uckey = key.toUpperCase();

      if (uckey in partDesign) {
        if (Array.isArray(data[key])) {
          this.parts[uckey] = data[key];
        } else {
          this.parts[uckey] = [data[key]];
        }
      } else {
        this[key] = data[key];
      }
    }

    if (this.interval && typeof this.interval != 'number') {
      optionDesign.INTERVAL(this.interval, this);
    }

    if (this.wkst && typeof this.wkst != 'number') {
      this.wkst = icalDayToNumericDay(this.wkst);
    }

    if (this.until && !(this.until instanceof ICalTime)) {
      this.until = ICalTimeFromStr(this.until);
    }
  }

  /**
   * The jCal representation of this recurrence type.
   */
  toJSON() {
    const res: ICalRecurDict = Object.create(null);
    res.freq = this.freq;
    if (this.count) res.count = this.count;

    if (this.interval > 1) res.interval = this.interval;

    for (const k in this.parts) {
      /* istanbul ignore if */
      if (!Object.prototype.hasOwnProperty.call(this.parts, k)) continue;
      const kparts = this.parts[k];
      if (Array.isArray(kparts) && kparts.length == 1) {
        res[k.toLowerCase()] = kparts[0];
      } else {
        res[k.toLowerCase()] = clone(this.parts[k]);
      }
    }

    if (this.until) res.until = this.until.toString();
    if ('wkst' in this && this.wkst !== DEFAULT_WEEK_START) {
      res.wkst = numericDayToIcalDay(this.wkst);
    }
    return res;
  }
}

const parseNumericValue = function (type: string, min: number, max: number, value: string) {
  let result: string = value;
  if (value[0] === '+') result = value.substr(1);
  if (min !== undefined && (value as unknown as number) < min) {
    throw new ICalError(type + ': invalid value "' + value + '" must be > ' + min);
  }
  if (max !== undefined && (value as unknown as number) > max) {
    throw new ICalError(type + ': invalid value "' + value + '" must be < ' + min);
  }
  return strictParseInt(result);
};

/**
 * Convert an ical representation of a day (SU, MO, etc..)
 * into a numeric value of that day.
 * @param str The iCalendar day name
 * @param weekstart The week start weekday, defaults to SUNDAY
 */
const icalDayToNumericDay = (str: string, weekstart?: WeekDay) => {
  //XXX: this is here so we can deal
  //     with possibly invalid string values.
  const firstDow = weekstart || ICAL_TIME_SUNDAY;
  return (((DOW_MAP[str] - firstDow + 7) % 7) + 1) as WeekDay;
};

/**
 * Convert a numeric day value into its ical representation (SU, MO, etc..)
 */
export const numericDayToIcalDay = (num: number, weekstart?: WeekDay) => {
  //XXX: this is here so we can deal with possibly invalid number values.
  //     Also, this allows consistent mapping between day numbers and day
  //     names for external users.
  const firstDow = weekstart || ICAL_TIME_SUNDAY;
  let dow = num + firstDow - ICAL_TIME_SUNDAY;
  if (dow > 7) dow -= 7;
  return DOW_MAP[dow];
};

const partDesign = {
  BYSECOND: parseNumericValue.bind(null, 'BYSECOND', 0, 60),
  BYMINUTE: parseNumericValue.bind(null, 'BYMINUTE', 0, 59),
  BYHOUR: parseNumericValue.bind(null, 'BYHOUR', 0, 23),
  BYDAY: function (value) {
    if (VALID_BYDAY_PART.test(value)) {
      return value;
    } else {
      throw new Error('invalid BYDAY value "' + value + '"');
    }
  },
  BYMONTHDAY: parseNumericValue.bind(null, 'BYMONTHDAY', -31, 31),
  BYYEARDAY: parseNumericValue.bind(null, 'BYYEARDAY', -366, 366),
  BYWEEKNO: parseNumericValue.bind(null, 'BYWEEKNO', -53, 53),
  BYMONTH: parseNumericValue.bind(null, 'BYMONTH', 1, 12),
  BYSETPOS: parseNumericValue.bind(null, 'BYSETPOS', -366, 366)
};

/**
 * Possible frequency values for the FREQ part
 * (YEARLY, MONTHLY, WEEKLY, DAILY, HOURLY, MINUTELY, SECONDLY)
 */
const ALLOWED_FREQ = ['SECONDLY', 'MINUTELY', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;

type FrequencyValue = Union<typeof ALLOWED_FREQ>;

const optionDesign = {
  FREQ: function (value: string, dict: ICalRecurDict) {
    // yes this is actually equal or faster then regex.
    // upside here is we can enumerate the valid values.
    if (ALLOWED_FREQ.indexOf(value as FrequencyValue) !== -1) {
      dict.freq = value as FrequencyValue;
    } else {
      throw new ICalError('invalid frequency "' + value + '" expected: "' + ALLOWED_FREQ.join(', ') + '"');
    }
  },
  COUNT: function (value: string, dict: ICalRecurDict) {
    dict.count = strictParseInt(value);
  },
  INTERVAL: function (value: string, dict: ICalRecurDict) {
    dict.interval = strictParseInt(value);
    if (dict.interval < 1) {
      // 0 or negative values are not allowed, some engines seem to generate
      // it though. Assume 1 instead.
      dict.interval = 1;
    }
  },
  UNTIL: function (value: string, dict: ICalRecurDict, fmtIcal?: boolean) {
    if (value.length > 10) {
      dict.until = ICalendar.value['date-time'].fromICAL!(value);
    } else {
      dict.until = ICalendar.value.date.fromICAL!(value);
    }
    if (!fmtIcal) {
      dict.until = ICalTimeFromStr(dict.until);
    }
  },
  WKST: function (value: string, dict: ICalRecurDict) {
    if (VALID_DAY_NAMES.test(value)) {
      dict.wkst = icalDayToNumericDay(value);
    } else {
      throw new ICalError('invalid WKST value "' + value + '"');
    }
  }
};

export const stringToData = (str: string, fmtIcal: boolean) => {
  const dict: ICalRecurDict = Object.create(null);

  // split is slower in FF but fast enough.
  // v8 however this is faster then manual split?
  const values = str.split(';');
  const len = values.length;

  for (let i = 0; i < len; i++) {
    const parts = values[i].split('=');
    const ucname = parts[0].toUpperCase();
    const lcname = parts[0].toLowerCase();
    const name = fmtIcal ? lcname : ucname;
    const value = parts[1];

    if (ucname in partDesign) {
      const partArr = value.split(',');
      let partArrIdx = 0;
      const partArrLen = partArr.length;

      for (; partArrIdx < partArrLen; partArrIdx++) {
        partArr[partArrIdx] = partDesign[ucname](partArr[partArrIdx]);
      }
      dict[name] = partArr.length == 1 ? partArr[0] : partArr;
    } else if (ucname in optionDesign) {
      optionDesign[ucname](value, dict, fmtIcal);
    } else {
      // Don't swallow unknown values. Just set them as they are.
      dict[lcname] = value;
    }
  }

  return dict;
};

/**
 * Creates a new instance using members from the passed
 * data object.
 */
export const fromData = (data: ICalRecurDict) => new ICalRecur(data);
