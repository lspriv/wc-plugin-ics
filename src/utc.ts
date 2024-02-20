import { strictParseInt, trunc, pad2 } from './helpers';
import { ICalendar } from './design';
/**
 * Creates a new UtcOffset instance from the passed string.
 */
export const fromString = str => {
  // -05:00
  var options: UtcOffsetOptions = {};
  //TODO: support seconds per rfc5545 ?
  options.factor = str[0] === '+' ? 1 : -1;
  options.hours = strictParseInt(str.substr(1, 2));
  options.minutes = strictParseInt(str.substr(4, 2));

  return new UtcOffset(options);
};

export const fromSeconds = (seconds: number) => {
  const instance = new UtcOffset();
  instance.fromSeconds(seconds);
  return instance;
};

interface UtcOffsetOptions {
  hours?: number;
  minutes?: number;
  factor?: number;
}

export class UtcOffset {
  /** The hours in the utc-offset */
  hours: number = 0;
  /** The minutes in the utc-offset */
  minutes: number = 0;
  /** The sign of the utc offset, 1 for positive offset, -1 for negative */
  factor: number = 1;
  /** The type name, to be used in the jCal object. */
  icaltype = <const>'utc-offset';

  constructor(options?: UtcOffsetOptions) {
    this.fromData(options);
  }

  /**
   * Sets up the current instance using members from the passed data object.
   */
  fromData(options?: UtcOffsetOptions) {
    if (options) {
      for (var key in options) {
        /* istanbul ignore else */
        if (options.hasOwnProperty(key)) {
          this[key] = options[key];
        }
      }
    }
    this.normalize();
  }

  normalize() {
    // Range: 97200 seconds (with 1 hour inbetween)
    var secs = this.toSeconds();
    var factor = this.factor;
    while (secs < -43200) {
      // = UTC-12:00
      secs += 97200;
    }
    while (secs > 50400) {
      // = UTC+14:00
      secs -= 97200;
    }
    this.fromSeconds(secs);
    // Avoid changing the factor when on zero seconds
    if (secs == 0) {
      this.factor = factor;
    }
  }

  /**
   * Convert the current offset to a value in seconds
   */
  toSeconds() {
    return this.factor * (60 * this.minutes + 3600 * this.hours);
  }

  /**
   * Sets up the current instance from the given seconds value. The seconds
   * value is truncated to the minute. Offsets are wrapped when the world
   * ends, the hour after UTC+14:00 is UTC-12:00.
   */
  fromSeconds(seconds: number) {
    let secs = Math.abs(seconds);
    this.factor = seconds < 0 ? -1 : 1;
    this.hours = trunc(secs / 3600);
    secs -= this.hours * 3600;
    this.minutes = trunc(secs / 60);
    return this;
  }

  /**
   * Compare this utc offset with another one.
   */
  compare(other: UtcOffset) {
    var a = this.toSeconds();
    var b = other.toSeconds();
    return +(a > b) - +(b > a);
  }

  /**
   * Returns a clone of the utc offset object.
   */
  clone() {
    return fromSeconds(this.toSeconds());
  }

  /**
   * The iCalendar string representation of this utc-offset.
   */
  toICALString() {
    return ICalendar.value['utc-offset'].toICAL!(this.toString());
  }

  /**
   * The string representation of this utc-offset.
   */
  toString() {
    return (this.factor == 1 ? '+' : '-') + pad2(this.hours) + ':' + pad2(this.minutes);
  }
}
