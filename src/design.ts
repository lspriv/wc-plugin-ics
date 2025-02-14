import { isStrictlyNaN } from './helpers';
import { fromString as ICalUtcFromStr, type UtcOffset } from './utc';
import { fromString as ICalBinaryFromStr, type ICalBinary } from './binary';
import { ICalTime, fromString as ICalTimeFromStr, fromDateString, fromDateTimeString } from './time';
import { type ICalDuration, fromString as ICalDurationFromStr, isValueString } from './duration';
import { type ICalPeriodData, fromJSON as ICalPeriodFromJson, ICalPeriod } from './period';
import { type ICalProperty } from './property';
import {
  type ICalRecurDict,
  type ICalRecur,
  fromData as ICalRecurFromData,
  stringToData as ICalRecurStrToData
  // numericDayToIcalDay
} from './recur';

const FROM_ICAL_NEWLINE = /\\\\|\\;|\\,|\\[Nn]/g;
// const TO_ICAL_NEWLINE = /\\|;|,|\n/g;

const STRICT = true;
export const DEFAULT_TYPE = 'unknown';

export type DesignValueType<T, U = any> = {
  /** An array of valid values for this value type (currently unused) */
  values?: string[];
  /** A regular expression the value type must match (currently unused) */
  matches?: RegExp;
  fromICAL?(value: string, escape?: string): T;
  // toICAL?(value: T, escape?: string): string;
  decorate?(value: T, prop?: ICalProperty): U;
  // undecorate?(value: U): T;
};

export type DesignParamType = {
  matches?: RegExp;
  values?: string[];
  valueType?: string;
  allowXName?: boolean;
  allowIanaToken?: boolean;
  multiValue?: string;
  multiValueSeparateDQuote?: boolean;
};

export type DesignPropType = {
  defaultType: string;
  allowedTypes?: string[];
  multiValue?: string;
  structuredValue?: string;
  detectType?(str: string): string;
};

const replaceNewlineReplace = (str: string) => {
  switch (str) {
    case '\\\\':
      return '\\';
    case '\\;':
      return ';';
    case '\\,':
      return ',';
    case '\\n':
    case '\\N':
      return '\n';
    /* istanbul ignore next */
    default:
      return str;
  }
};

const replaceNewline = (value: string, newline: RegExp, escape: string) => {
  // avoid regex when possible.
  if (value.indexOf('\\') === -1) return value;
  if (escape) newline = new RegExp(newline.source + '|\\\\' + escape);
  return value.replace(newline, replaceNewlineReplace);
};

const createTextType = (fromline: RegExp): DesignValueType<string> => ({
  matches: /.*/,
  fromICAL: function (value, escape) {
    return replaceNewline(value, fromline, escape!);
  }
  // toICAL: function (value, escape) {
  //   let regEx = toline;
  //   if (escape) regEx = new RegExp(regEx.source + '|' + escape);
  //   return value.replace(regEx, function (str) {
  //     switch (str) {
  //       case '\\':
  //         return '\\\\';
  //       case ';':
  //         return '\\;';
  //       case ',':
  //         return '\\,';
  //       case '\n':
  //         return '\\n';
  //       /* istanbul ignore next */
  //       default:
  //         return str;
  //     }
  //   });
  // }
});

interface DesignValue {
  boolean: DesignValueType<boolean>;
  float: DesignValueType<number>;
  integer: DesignValueType<number>;
  'utc-offset': DesignValueType<string, UtcOffset>;
  text: DesignValueType<string>;
  uri: DesignValueType<any>;
  binary: DesignValueType<any, ICalBinary>;
  'cal-address': DesignValueType<any>;
  date: DesignValueType<string, any>;
  'date-time': DesignValueType<string, ICalTime>;
  duration: DesignValueType<string, ICalDuration>;
  period: DesignValueType<ICalPeriodData, ICalPeriod>;
  recur: DesignValueType<ICalRecurDict, ICalRecur>;
  time: DesignValueType<string>;
}

type DesignParam = Record<string, DesignParamType>;
type DesignProp = Record<string, DesignPropType>;

export interface DesignSet {
  value: DesignValue;
  param: DesignParam;
  property: DesignProp;
}

// When adding a value here, be sure to add it to the parameter types!
const ICalValues: DesignValue = {
  boolean: {
    values: ['TRUE', 'FALSE'],
    fromICAL: function (value) {
      switch (value) {
        case 'TRUE':
          return true;
        case 'FALSE':
          return false;
        default:
          // TODO: parser warning
          return false;
      }
    }
    // toICAL: function (value) {
    //   return value ? 'TRUE' : 'FALSE';
    // }
  },
  float: {
    matches: /^[+-]?\d+\.\d+$/,
    fromICAL: function (value) {
      const parsed = parseFloat(value);
      // TODO: parser warning
      return isStrictlyNaN(parsed) ? 0.0 : parsed;
    }
    // toICAL: function (value) {
    //   return String(value);
    // }
  },
  integer: {
    fromICAL: function (value) {
      const parsed = parseInt(value);
      return isStrictlyNaN(parsed) ? 0 : parsed;
    }
    // toICAL: function (value) {
    //   return String(value);
    // }
  },
  'utc-offset': {
    fromICAL: function (value) {
      if (value.length < 6) {
        // no seconds
        // -05:00
        return value.substr(0, 3) + ':' + value.substr(3, 2);
      } else {
        // seconds
        // -05:00:00
        return value.substr(0, 3) + ':' + value.substr(3, 2) + ':' + value.substr(5, 2);
      }
    },
    // toICAL: function (value) {
    //   if (value.length < 7) {
    //     // no seconds
    //     // -0500
    //     return value.substr(0, 3) + value.substr(4, 2);
    //   } else {
    //     // seconds
    //     // -050000
    //     return value.substr(0, 3) + value.substr(4, 2) + value.substr(7, 2);
    //   }
    // },
    decorate: function (value) {
      return ICalUtcFromStr(value);
    }

    // undecorate: function (value) {
    //   return value.toString();
    // }
  },
  text: createTextType(FROM_ICAL_NEWLINE),
  uri: {},
  binary: {
    decorate: function (aString) {
      return ICalBinaryFromStr(aString);
    }
    // undecorate: function (aBinary) {
    //   return aBinary.toString();
    // }
  },
  'cal-address': {},
  date: {
    decorate: function (value, prop) {
      if (STRICT) {
        return fromDateString(value);
      } else {
        return ICalTimeFromStr(value, prop);
      }
    },
    // undecorate: function (value) {
    //   return value.toString();
    // },
    fromICAL: function (value) {
      // from: 20120901
      // to: 2012-09-01
      if (!STRICT && value.length >= 15) {
        // This is probably a date-time, e.g. 20120901T130000Z
        return ICalValues['date-time'].fromICAL!(value);
      } else {
        return value.substr(0, 4) + '-' + value.substr(4, 2) + '-' + value.substr(6, 2);
      }
    }
    // toICAL: function (value) {
    //   // from: 2012-09-01
    //   // to: 20120901
    //   const len = value.length;

    //   if (len == 10) {
    //     return value.substr(0, 4) + value.substr(5, 2) + value.substr(8, 2);
    //   } else if (len >= 19) {
    //     return ICalValues['date-time'].toICAL!(value);
    //   } else {
    //     //TODO: serialize warning?
    //     return value;
    //   }
    // }
  },
  'date-time': {
    fromICAL: function (value) {
      // from: 20120901T130000
      // to: 2012-09-01T13:00:00
      if (!STRICT && value.length == 8) {
        // This is probably a date, e.g. 20120901
        return ICalValues.date.fromICAL!(value);
      } else {
        const result =
          value.substr(0, 4) +
          '-' +
          value.substr(4, 2) +
          '-' +
          value.substr(6, 2) +
          'T' +
          value.substr(9, 2) +
          ':' +
          value.substr(11, 2) +
          ':' +
          value.substr(13, 2);
        return value[15] && value[15] === 'Z' ? result + 'Z' : result;
      }
    },
    // toICAL: function (value) {
    //   // from: 2012-09-01T13:00:00
    //   // to: 20120901T130000
    //   const len = value.length;
    //   if (len == 10 && !STRICT) {
    //     return ICalValues.date.toICAL!(value);
    //   } else if (len >= 19) {
    //     const result =
    //       value.substr(0, 4) +
    //       value.substr(5, 2) +
    //       value.substr(8, 5) + // grab the (DDTHH) segment
    //       value.substr(14, 2) + // MM
    //       value.substr(17, 2); // SS
    //     return value[19] && value[19] === 'Z' ? result + 'Z' : result;
    //   } else {
    //     // TODO: error
    //     return value;
    //   }
    // },
    decorate: function (value, prop) {
      if (STRICT) {
        return fromDateTimeString(value, prop);
      } else {
        return ICalTimeFromStr(value, prop);
      }
    }
    // undecorate: function (value) {
    //   return value.toString();
    // }
  },
  duration: {
    decorate: function (value) {
      return ICalDurationFromStr(value);
    }
    // undecorate: function (value) {
    //   return value.toString();
    // }
  },
  period: {
    fromICAL: function (value) {
      const parts = value.split('/');
      parts[0] = ICalValues['date-time'].fromICAL!(parts[0]);
      if (!isValueString(parts[1])) {
        parts[1] = ICalValues['date-time'].fromICAL!(parts[1]);
      }
      return parts as ICalPeriodData;
    },
    // toICAL: function (parts) {
    //   if (!STRICT && parts[0].length == 10) {
    //     parts[0] = ICalValues.date.toICAL!(parts[0]);
    //   } else {
    //     parts[0] = ICalValues['date-time'].toICAL!(parts[0]);
    //   }
    //   if (!isValueString(parts[1])) {
    //     if (!STRICT && parts[1].length == 10) {
    //       parts[1] = ICalValues.date.toICAL!(parts[1]);
    //     } else {
    //       parts[1] = ICalValues['date-time'].toICAL!(parts[1]);
    //     }
    //   }
    //   return parts.join('/');
    // },
    decorate: function (value, prop) {
      return ICalPeriodFromJson(value, prop!, !STRICT);
    }
    // undecorate: function (value) {
    //   return value.toJSON();
    // }
  },
  recur: {
    fromICAL: function (string) {
      return ICalRecurStrToData(string, true);
    },
    // toICAL: function (data) {
    //   let str = '';
    //   for (const k in data) {
    //     /* istanbul ignore if */
    //     if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
    //     let val = data[k];
    //     if (k == 'until') {
    //       if (val.length > 10) {
    //         val = ICalValues['date-time'].toICAL!(val);
    //       } else {
    //         val = ICalValues.date.toICAL!(val);
    //       }
    //     } else if (k == 'wkst') {
    //       if (typeof val === 'number') {
    //         val = numericDayToIcalDay(val);
    //       }
    //     } else if (Array.isArray(val)) {
    //       val = val.join(',');
    //     }
    //     str += k.toUpperCase() + '=' + val + ';';
    //   }
    //   return str.substr(0, str.length - 1);
    // },
    decorate: function decorate(value) {
      return ICalRecurFromData(value);
    }
    // undecorate: function (recur) {
    //   return recur.toJSON();
    // }
  },
  time: {
    fromICAL: function (value) {
      // from: MMHHSS(Z)?
      // to: HH:MM:SS(Z)?

      // TODO: parser exception?
      if (value.length < 6) return value;

      // HH::MM::SSZ?
      const result = value.substr(0, 2) + ':' + value.substr(2, 2) + ':' + value.substr(4, 2);
      return value[6] === 'Z' ? result + 'Z' : result;
    }
    // toICAL: function (value) {
    //   // from: HH:MM:SS(Z)?
    //   // to: MMHHSS(Z)?

    //   // TODO: parser exception?
    //   if (value.length < 8) return value;

    //   const result = value.substr(0, 2) + value.substr(3, 2) + value.substr(6, 2);
    //   return value[8] === 'Z' ? result + 'Z' : result;
    // }
  }
};

// Although the syntax is DQUOTE uri DQUOTE, I don't think we should
// enfoce anything aside from it being a valid content line.
//
// At least some params require - if multi values are used - DQUOTEs
// for each of its values - e.g. delegated-from="uri1","uri2"
// To indicate this, I introduced the new k/v pair
// multiValueSeparateDQuote: true
//
// "ALTREP": { ... },

// CN just wants a param-value
// "CN": { ... }
const ICalParams: DesignParam = {
  cutype: {
    values: ['INDIVIDUAL', 'GROUP', 'RESOURCE', 'ROOM', 'UNKNOWN'],
    allowXName: true,
    allowIanaToken: true
  },
  'delegated-from': {
    valueType: 'cal-address',
    multiValue: ',',
    multiValueSeparateDQuote: true
  },
  'delegated-to': {
    valueType: 'cal-address',
    multiValue: ',',
    multiValueSeparateDQuote: true
  },
  // "DIR": { ... }, // See ALTREP
  encoding: {
    values: ['8BIT', 'BASE64']
  },
  // "FMTTYPE": { ... }, // See ALTREP
  fbtype: {
    values: ['FREE', 'BUSY', 'BUSY-UNAVAILABLE', 'BUSY-TENTATIVE'],
    allowXName: true,
    allowIanaToken: true
  },
  // "LANGUAGE": { ... }, // See ALTREP
  member: {
    valueType: 'cal-address',
    multiValue: ',',
    multiValueSeparateDQuote: true
  },
  partstat: {
    // TODO These values are actually different per-component
    values: ['NEEDS-ACTION', 'ACCEPTED', 'DECLINED', 'TENTATIVE', 'DELEGATED', 'COMPLETED', 'IN-PROCESS'],
    allowXName: true,
    allowIanaToken: true
  },
  range: {
    values: ['THISANDFUTURE']
  },
  related: {
    values: ['START', 'END']
  },
  reltype: {
    values: ['PARENT', 'CHILD', 'SIBLING'],
    allowXName: true,
    allowIanaToken: true
  },
  role: {
    values: ['REQ-PARTICIPANT', 'CHAIR', 'OPT-PARTICIPANT', 'NON-PARTICIPANT'],
    allowXName: true,
    allowIanaToken: true
  },
  rsvp: {
    values: ['TRUE', 'FALSE']
  },
  'sent-by': {
    valueType: 'cal-address'
  },
  tzid: {
    matches: /^\//
  },
  value: {
    // since the value here is a 'type' lowercase is used.
    values: [
      'binary',
      'boolean',
      'cal-address',
      'date',
      'date-time',
      'duration',
      'float',
      'integer',
      'period',
      'recur',
      'text',
      'time',
      'uri',
      'utc-offset'
    ],
    allowXName: true,
    allowIanaToken: true
  }
};

const DEFAULT_TYPE_TEXT = { defaultType: 'text' };
const DEFAULT_TYPE_TEXT_MULTI = { defaultType: 'text', multiValue: ',' };
const DEFAULT_TYPE_TEXT_STRUCTURED = { defaultType: 'text', structuredValue: ';' };
const DEFAULT_TYPE_INTEGER = { defaultType: 'integer' };
const DEFAULT_TYPE_DATETIME_DATE = { defaultType: 'date-time', allowedTypes: ['date-time', 'date'] };
const DEFAULT_TYPE_DATETIME = { defaultType: 'date-time' };
const DEFAULT_TYPE_URI = { defaultType: 'uri' };
const DEFAULT_TYPE_UTCOFFSET = { defaultType: 'utc-offset' };
const DEFAULT_TYPE_RECUR = { defaultType: 'recur' };
// const DEFAULT_TYPE_DATE_ANDOR_TIME = { defaultType: 'date-and-or-time', allowedTypes: ['date-time', 'date', 'text'] };

const ICalProperties: DesignProp = {
  categories: DEFAULT_TYPE_TEXT_MULTI,
  url: DEFAULT_TYPE_URI,
  version: DEFAULT_TYPE_TEXT,
  uid: DEFAULT_TYPE_TEXT,
  action: DEFAULT_TYPE_TEXT,
  attach: { defaultType: 'uri' },
  attendee: { defaultType: 'cal-address' },
  calscale: DEFAULT_TYPE_TEXT,
  class: DEFAULT_TYPE_TEXT,
  comment: DEFAULT_TYPE_TEXT,
  completed: DEFAULT_TYPE_DATETIME,
  contact: DEFAULT_TYPE_TEXT,
  created: DEFAULT_TYPE_DATETIME,
  description: DEFAULT_TYPE_TEXT,
  dtend: DEFAULT_TYPE_DATETIME_DATE,
  dtstamp: DEFAULT_TYPE_DATETIME,
  dtstart: DEFAULT_TYPE_DATETIME_DATE,
  due: DEFAULT_TYPE_DATETIME_DATE,
  duration: { defaultType: 'duration' },
  exdate: {
    defaultType: 'date-time',
    allowedTypes: ['date-time', 'date'],
    multiValue: ','
  },
  exrule: DEFAULT_TYPE_RECUR,
  freebusy: { defaultType: 'period', multiValue: ',' },
  geo: { defaultType: 'float', structuredValue: ';' },
  'last-modified': DEFAULT_TYPE_DATETIME,
  location: DEFAULT_TYPE_TEXT,
  method: DEFAULT_TYPE_TEXT,
  organizer: { defaultType: 'cal-address' },
  'percent-complete': DEFAULT_TYPE_INTEGER,
  priority: DEFAULT_TYPE_INTEGER,
  prodid: DEFAULT_TYPE_TEXT,
  'related-to': DEFAULT_TYPE_TEXT,
  repeat: DEFAULT_TYPE_INTEGER,
  rdate: {
    defaultType: 'date-time',
    allowedTypes: ['date-time', 'date', 'period'],
    multiValue: ',',
    detectType: function (string) {
      if (string.indexOf('/') !== -1) {
        return 'period';
      }
      return string.indexOf('T') === -1 ? 'date' : 'date-time';
    }
  },
  'recurrence-id': DEFAULT_TYPE_DATETIME_DATE,
  resources: DEFAULT_TYPE_TEXT_MULTI,
  'request-status': DEFAULT_TYPE_TEXT_STRUCTURED,
  rrule: DEFAULT_TYPE_RECUR,
  sequence: DEFAULT_TYPE_INTEGER,
  status: DEFAULT_TYPE_TEXT,
  summary: DEFAULT_TYPE_TEXT,
  transp: DEFAULT_TYPE_TEXT,
  trigger: { defaultType: 'duration', allowedTypes: ['duration', 'date-time'] },
  tzoffsetfrom: DEFAULT_TYPE_UTCOFFSET,
  tzoffsetto: DEFAULT_TYPE_UTCOFFSET,
  tzurl: DEFAULT_TYPE_URI,
  tzid: DEFAULT_TYPE_TEXT,
  tzname: DEFAULT_TYPE_TEXT
};

/**
 * iCalendar design set
 */
const ICalSet: DesignSet = {
  value: ICalValues,
  param: ICalParams,
  property: ICalProperties
};

export const ICalendar = ICalSet;

/**
 * Holds the design set for known top-level components
 * @example
 * var propertyName = 'fn';
 * var componentDesign = ICAL.design.components.vcard;
 * var propertyDetails = componentDesign.property[propertyName];
 * if (propertyDetails.defaultType == 'text') {
 *   // Yep, sure is...
 * }
 */
const Components: Record<string, DesignSet> = {
  vevent: ICalSet,
  vtodo: ICalSet,
  vjournal: ICalSet,
  valarm: ICalSet,
  vfreebusy: ICalSet,
  vtimezone: ICalSet,
  daylight: ICalSet,
  standard: ICalSet
};

export const JCAL_COMPONENT = {
  CALENDAR: 'vcalendar',
  EVENT: 'vevent',
  TODO: 'vtodo',
  JOURNAL: 'vjournal',
  ALRAM: 'valarm',
  FREEBUSY: 'vfreebusy',
  TIMEZONE: 'vtimezone',
  DAYLIGHT: 'daylight',
  STANDARD: 'standard'
} as const;

export const getDesignSet = (componentName: string): DesignSet => {
  const isInDesign = componentName && componentName in Components;
  return isInDesign ? Components[componentName] : ICalendar;
};
