import { ICalComponent } from './component';
import { parse } from './parse';

const OPTIONS = ['tzid', 'location', 'tznames', 'latitude', 'longitude'] as const;

interface TimezoneOptions {
  /** can be set to either a string containing the component data, or an already parsed ICAL.Component */
  component?: string | ICalComponent;
  /** The timezone identifier */
  tzid?: string;
  /** An alternative string representation of the timezone */
  tznames?: string;
  /** The timezone location */
  location?: string;
  /** The latitude of the timezone */
  latitude?: number;
  /** The longitude of the timezone */
  longitude?: number;
}

/**
 * Creates a new ICAL.Timezone instance from the passed data object.
 */
export const fromData = function (date: TimezoneOptions) {
  const zone = new ICalTimezone();
  return zone.fromData(date);
};

/**
 * Timezone representation, created by passing in a tzid and component.
 */
export class ICalTimezone {
  expandedUntilYear: number = 0;
  component: ICalComponent | null = null;
  changes: any[] = [];
  tzid: string = '';

  constructor(data?: ICalComponent | TimezoneOptions) {
    this.fromData(data);
  }

  /** Sets up the current instance using members from the passed data object. */
  public fromData(data?: ICalComponent | TimezoneOptions) {
    this.expandedUntilYear = 0;
    this.changes = [];

    if (data instanceof ICalComponent) {
      // Either a component is passed directly
      this.component = data;
    } else {
      // Otherwise the component may be in the data object
      if (data && 'component' in data) {
        if (typeof data.component == 'string') {
          // If a string was passed, parse it as a component
          const jCal = parse(data.component);
          this.component = new ICalComponent(jCal);
        } else if (data.component instanceof ICalComponent) {
          // If it was a component already, then just set it
          this.component = data.component;
        } else {
          // Otherwise just null out the component
          this.component = null;
        }
      }

      // Copy remaining passed properties
      for (const key in OPTIONS) {
        /* istanbul ignore else */
        if (Object.prototype.hasOwnProperty.call(OPTIONS, key)) {
          const prop = OPTIONS[key];
          if (data && prop in data) {
            this[prop] = data[prop];
          }
        }
      }
    }

    // If we have a component but no TZID, attempt to get it from the
    // component's properties.
    if (this.component instanceof ICalComponent && !this.tzid) {
      this.tzid = this.component.getFirstPropertyValue('tzid') || '';
    }

    return this;
  }
}

/**
 * Singleton class to contain timezones.  Right now it is all manual registry in
 * the future we may use this class to download timezone information or handle
 * loading pre-expanded timezones.
 */
export class ICalTimezoneService {
  public static zones: Array<ICalTimezone> = [];

  /**
   * Returns a timezone by its tzid if present.
   * @param tzid Timezone identifier (e.g. America/Los_Angeles)
   */
  public static getZone(tzid: string) {
    return this.zones[tzid];
  }
}

export const localTimezone: ICalTimezone = fromData({
  tzid: 'floating'
});

export const utcTimezone: ICalTimezone = fromData({
  tzid: 'UTC'
});
