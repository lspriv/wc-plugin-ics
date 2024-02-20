import { isStrictlyNaN } from './helpers';
import { ICalError } from './error';

const DURATION_LETTERS = /([PDWHMTS]{1,1})/;

export interface ICalDurationDict {
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  isNegative?: boolean;
}

/**
 * This class represents the "duration" value type, with various calculation
 * and manipulation methods.
 */
export class ICalDuration {
  weeks: number = 0;
  days: number = 0;
  hours: number = 0;
  minutes: number = 0;
  seconds: number = 0;
  isNegative: boolean = false;
  icalclass = 'icalduration';
  icaltype = 'duration';

  constructor(data?: ICalDurationDict) {
    this.fromData(data);
  }

  /**
   * Sets up the current instance using members from the passed data object.Sets up the current instance using members from the passed data object.
   * @param data
   */
  fromData(data?: ICalDurationDict) {
    const props = ['weeks', 'days', 'hours', 'minutes', 'seconds', 'isNegative'];
    for (const key in props) {
      /* istanbul ignore if */
      if (!props.hasOwnProperty(key)) continue;
      var prop = props[key];
      if (data && prop in data) {
        this[prop] = data[prop];
      } else {
        this[prop] = 0;
      }
    }
  }

  /**
   * The duration value expressed as a number of seconds.
   */
  toSeconds() {
    var seconds = this.seconds + 60 * this.minutes + 3600 * this.hours + 86400 * this.days + 7 * 86400 * this.weeks;
    return this.isNegative ? -seconds : seconds;
  }

  /** The string representation of this duration. */
  toString(): string {
    if (this.toSeconds() == 0) {
      return 'PT0S';
    } else {
      let str = '';
      if (this.isNegative) str += '-';
      str += 'P';
      if (this.weeks) str += this.weeks + 'W';
      if (this.days) str += this.days + 'D';

      if (this.hours || this.minutes || this.seconds) {
        str += 'T';
        if (this.hours) str += this.hours + 'H';
        if (this.minutes) str += this.minutes + 'M';
        if (this.seconds) str += this.seconds + 'S';
      }
      return str;
    }
  }
}

export const fromString = (str: string) => {
  let pos = 0;
  const dict = Object.create(null);
  let chunks = 0;

  while ((pos = str.search(DURATION_LETTERS)) !== -1) {
    const type = str[pos];
    const numeric = str.substr(0, pos);
    str = str.substr(pos + 1);
    chunks += parseDurationChunk(type, numeric, dict);
  }

  if (chunks < 2) {
    // There must be at least a chunk with "P" and some unit chunk
    throw new ICalError('invalid duration value: Not enough duration components in "' + str + '"');
  }

  return new ICalDuration(dict);
};

/**
 * Internal helper function to handle a chunk of a duration.
 * @param letter type of duration chunk
 * @param number numeric value or -/+
 * @param target target to assign values to
 */
const parseDurationChunk = (letter: string, number: string | number, target: ICalDurationDict) => {
  let type;
  switch (letter) {
    case 'P':
      if (number && number === '-') {
        target.isNegative = true;
      } else {
        target.isNegative = false;
      }
      // period
      break;
    case 'D':
      type = 'days';
      break;
    case 'W':
      type = 'weeks';
      break;
    case 'H':
      type = 'hours';
      break;
    case 'M':
      type = 'minutes';
      break;
    case 'S':
      type = 'seconds';
      break;
    default:
      // Not a valid chunk
      return 0;
  }

  if (type) {
    if (!number && number !== 0) {
      throw new ICalError('invalid duration value: Missing number before "' + letter + '"');
    }
    const num = parseInt(number as string, 10);
    if (isStrictlyNaN(num)) {
      throw new ICalError('invalid duration value: Invalid number "' + number + '" before "' + letter + '"');
    }
    target[type] = num;
  }

  return 1;
};

/**
 * Checks if the given string is an iCalendar duration value.
 */
export const isValueString = (str: string) => str[0] === 'P' || str[1] === 'P';
