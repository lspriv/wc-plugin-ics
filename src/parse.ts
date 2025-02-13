import { ICalError } from './error';
import { getDesignSet, DesignSet, DesignPropType } from './design';
import { unescapedIndexOf } from './helpers';

export type JCalProp = [name: string, params: Record<string, string>, type: string, value?: string];

export type JCal = [name: string, properties: Array<JCalProp>, components: Array<JCal>];

interface ParseState {
  designSet?: DesignSet;
  component: JCal | Array<JCal>;
  stack: Array<ParseState['component']>;
}

const CHAR = /[^ \t]/;
const VALUE_DELIMITER = ':';
const PARAM_DELIMITER = ';';
const PARAM_NAME_DELIMITER = '=';
const DEFAULT_VALUE_TYPE = 'unknown';
const DEFAULT_PARAM_TYPE = 'text';

/**
 * Process a complete buffer of iCalendar/vCard data line by line, correctly
 * unfolding content. Each line will be processed with the given callback
 */
const eachLine = (buffer: string, callback: (line: string) => void) => {
  const len = buffer.length;
  let lastPos = buffer.search(CHAR);
  let pos = lastPos;
  let line: string = '';
  let firstChar: string;
  let newlineOffset: number;

  do {
    pos = buffer.indexOf('\n', lastPos) + 1;

    if (pos > 1 && buffer[pos - 2] === '\r') {
      newlineOffset = 2;
    } else {
      newlineOffset = 1;
    }

    if (pos === 0) {
      pos = len;
      newlineOffset = 0;
    }

    firstChar = buffer[lastPos];

    if (firstChar === ' ' || firstChar === '\t') {
      // add to line
      line += buffer.substr(lastPos + 1, pos - lastPos - (newlineOffset + 1));
    } else {
      if (line) callback(line);
      // push line
      line = buffer.substr(lastPos, pos - lastPos - newlineOffset);
    }

    lastPos = pos;
  } while (pos !== len);

  // extra ending line
  line = line.trim();

  if (line.length) callback(line);
};

const RFC6868_REPLACE_MAP = { "^'": '"', '^n': '\n', '^^': '^' };

/**
 * Internal helper for rfc6868. Exposing this on ICAL.parse so that
 * hackers can disable the rfc6868 parsing if the really need to.
 */
const rfc6868Escape = (val: string) => {
  return val.replace(/\^['n^]/g, function (x) {
    return RFC6868_REPLACE_MAP[x];
  });
};

/**
 * Parse a value from the raw value into the jCard/jCal value.
 * @param value Original value
 * @param type Type of value
 * @param designSet The design data to use for this value
 */
const parseValue = (value: string, type: string, designSet: DesignSet, structuredValue?: boolean | string): string => {
  if (type in designSet.value && 'fromICAL' in designSet.value[type]) {
    return designSet.value[type].fromICAL(value, structuredValue);
  }
  return value;
};

/**
 * Parse a multi value string. This function is used either for parsing
 * actual multi-value property's values, or for handling parameter values. It
 * can be used for both multi-value properties and structured value properties.
 * @param buffer The buffer containing the full value
 * @param delim The multi-value delimiter
 * @param type The value type to be parsed
 * @param result The array to append results to, varies on value type
 * @param innerMulti The inner delimiter to split each value with
 * @param designSet The design data for this value
 */
const parseMultiValue = (
  buffer: string,
  delim: string,
  type: string,
  result: Array<string>,
  innerMulti: string | null,
  designSet: DesignSet,
  structuredValue?: boolean | string
) => {
  let pos = 0;
  let lastPos = 0;
  let value: string | string[];
  if (delim.length === 0) return buffer;
  // split each piece
  while ((pos = unescapedIndexOf(buffer, delim, lastPos)) !== -1) {
    value = buffer.substr(lastPos, pos - lastPos);
    if (innerMulti) {
      value = parseMultiValue(value, innerMulti, type, [], null, designSet, structuredValue);
    } else {
      value = parseValue(value, type, designSet, structuredValue);
    }
    result.push(value as string);
    lastPos = pos + delim.length;
  }
  // on the last piece take the rest of string
  value = buffer.substr(lastPos);
  if (innerMulti) {
    value = parseMultiValue(value, innerMulti, type, [], null, designSet, structuredValue);
  } else {
    value = parseValue(value, type, designSet, structuredValue);
  }
  result.push(value as string);

  return result.length == 1 ? result[0] : result;
};

type ParseParamResult = [result: Record<string, string | string[]>, value: string | string[], valuePos: number];

/**
 * Parse parameters from a string to object.
 * @param line A single unfolded line
 * @param start Position to start looking for properties
 * @param designSet The design data to use for this property
 */
const parseParameters = (line: string, start: number, designSet: DesignSet): ParseParamResult => {
  let lastParam = start;
  let pos: number | boolean = 0;
  const delim = PARAM_NAME_DELIMITER;
  const result = {};
  let name: string;
  let lcname: string;
  let value: string | string[] = '';
  let valuePos = -1;
  let type: string;
  let multiValue: string | undefined;
  let mvdelim: string | undefined;

  // find the next '=' sign
  // use lastParam and pos to find name
  // check if " is used if so get value from "->"
  // then increment pos to find next ;

  while (pos !== false && (pos = unescapedIndexOf(line, delim, pos + 1)) !== -1) {
    name = line.substr(lastParam + 1, pos - lastParam - 1);
    if (name.length == 0) {
      throw new ICalError("Empty parameter name in '" + line + "'");
    }

    lcname = name.toLowerCase();
    mvdelim = void 0;
    multiValue = void 0;

    if (lcname in designSet.param && designSet.param[lcname].valueType) {
      type = designSet.param[lcname].valueType!;
    } else {
      type = DEFAULT_PARAM_TYPE;
    }

    if (lcname in designSet.param) {
      multiValue = designSet.param[lcname].multiValue;
      if (designSet.param[lcname].multiValueSeparateDQuote) {
        mvdelim = rfc6868Escape('"' + multiValue + '"');
      }
    }

    const nextChar = line[pos + 1];
    if (nextChar === '"') {
      valuePos = pos + 2;
      pos = unescapedIndexOf(line, '"', valuePos);
      if (multiValue && pos != -1) {
        let extendedValue = true;
        while (extendedValue) {
          if (line[pos + 1] == multiValue && line[pos + 2] == '"') {
            pos = unescapedIndexOf(line, '"', pos + 3);
          } else {
            extendedValue = false;
          }
        }
      }
      if (pos === -1) {
        throw new ICalError('invalid line (no matching double quote) "' + line + '"');
      }
      value = line.substr(valuePos, pos - valuePos);
      lastParam = unescapedIndexOf(line, PARAM_DELIMITER, pos);
      if (lastParam === -1) pos = false;
    } else {
      valuePos = pos + 1;
      // move to next ";"
      let nextPos = unescapedIndexOf(line, PARAM_DELIMITER, valuePos);
      const propValuePos = unescapedIndexOf(line, VALUE_DELIMITER, valuePos);
      if (propValuePos !== -1 && nextPos > propValuePos) {
        // this is a delimiter in the property value, let's stop here
        nextPos = propValuePos;
        pos = false;
      } else if (nextPos === -1) {
        // no ";"
        if (propValuePos === -1) {
          nextPos = line.length;
        } else {
          nextPos = propValuePos;
        }
        pos = false;
      } else {
        lastParam = nextPos;
        pos = nextPos;
      }
      value = line.substr(valuePos, nextPos - valuePos);
    }

    value = rfc6868Escape(value);
    if (multiValue) {
      const delimiter = mvdelim || multiValue;
      value = parseMultiValue(value, delimiter, type, [], null, designSet);
    } else {
      value = parseValue(value, type, designSet);
    }

    if (multiValue && lcname in result) {
      if (Array.isArray(result[lcname])) {
        result[lcname].push(value);
      } else {
        result[lcname] = [result[lcname], value];
      }
    } else {
      result[lcname] = value;
    }
  }

  return [result, value, valuePos];
};

const handleContentLine = (line: string, state: ParseState) => {
  // break up the parts of the line
  const valuePos = line.indexOf(VALUE_DELIMITER);
  let paramPos = line.indexOf(PARAM_DELIMITER);

  let lastParamIndex: number;
  let lastValuePos: number;

  // name of property or begin/end
  let name: string;
  let value: string | string[];

  // params is only overridden if paramPos !== -1.
  // we can't do params = params || {} later on
  // because it sacrifices ops.
  let params: ParseParamResult[0] = {};

  /**
   * Different property cases
   *
   *
   * 1. RRULE:FREQ=foo
   *    // FREQ= is not a param but the value
   *
   * 2. ATTENDEE;ROLE=REQ-PARTICIPANT;
   *    // ROLE= is a param because : has not happened yet
   */

  // when the parameter delimiter is after the
  // value delimiter then it is not a parameter.

  if (paramPos !== -1 && valuePos !== -1) {
    // when the parameter delimiter is after the
    // value delimiter then it is not a parameter.
    if (paramPos > valuePos) {
      paramPos = -1;
    }
  }

  let parsedParams;
  if (paramPos !== -1) {
    name = line.substring(0, paramPos).toLowerCase();
    parsedParams = parseParameters(line.substring(paramPos), 0, state.designSet!);
    if (parsedParams[2] == -1) {
      throw new ICalError("Invalid parameters in '" + line + "'");
    }
    params = parsedParams[0];
    lastParamIndex = parsedParams[1].length + parsedParams[2] + paramPos;
    if ((lastValuePos = line.substring(lastParamIndex).indexOf(VALUE_DELIMITER)) !== -1) {
      value = line.substring(lastParamIndex + lastValuePos + 1);
    } else {
      throw new ICalError("Missing parameter value in '" + line + "'");
    }
  } else if (valuePos !== -1) {
    // without parmeters (BEGIN:VCAENDAR, CLASS:PUBLIC)
    name = line.substring(0, valuePos).toLowerCase();
    value = line.substring(valuePos + 1);

    if (name === 'begin') {
      const newComponent: JCal = [value.toLowerCase(), [], []];
      if (state.stack.length === 1) {
        (state.component as Array<JCal>).push(newComponent);
      } else {
        (state.component as JCal)[2].push(newComponent);
      }
      state.stack.push(state.component);
      state.component = newComponent;
      if (!state.designSet) {
        state.designSet = getDesignSet(state.component[0]);
      }
      return;
    } else if (name === 'end') {
      state.component = state.stack.pop()!;
      return;
    }
    // If it is not begin/end, then this is a property with an empty value,
    // which should be considered valid.
  } else {
    /**
     * Invalid line.
     * The rational to throw an error is we will
     * never be certain that the rest of the file
     * is sane and it is unlikely that we can serialize
     * the result correctly either.
     */
    throw new ICalError('invalid line (no token ";" or ":") "' + line + '"');
  }

  let valueType: string | null = null;
  let multiValue: string | boolean = false;
  let structuredValue: string | boolean = false;
  let propertyDetails: DesignPropType | null = null;

  if (name in state.designSet!.property) {
    propertyDetails = state.designSet!.property[name];

    if ('multiValue' in propertyDetails) {
      multiValue = propertyDetails.multiValue!;
    }

    if ('structuredValue' in propertyDetails) {
      structuredValue = propertyDetails.structuredValue!;
    }

    if (value && 'detectType' in propertyDetails) {
      valueType = propertyDetails.detectType!(value);
    }
  }

  // attempt to determine value
  if (!valueType) {
    if (!('value' in params)) {
      if (propertyDetails) {
        valueType = propertyDetails.defaultType;
      } else {
        valueType = DEFAULT_VALUE_TYPE;
      }
    } else {
      // possible to avoid this?
      valueType = (<string>params.value).toLowerCase();
    }
  }

  delete params.value;

  /**
   * Note on `var result` juggling:
   *
   * I observed that building the array in pieces has adverse
   * effects on performance, so where possible we inline the creation.
   * It is a little ugly but resulted in ~2000 additional ops/sec.
   */

  let result;
  if (multiValue && structuredValue) {
    value = parseMultiValue(value, structuredValue, valueType, [], multiValue, state.designSet!, structuredValue);
    result = [name, params, valueType, value];
  } else if (multiValue) {
    result = [name, params, valueType];
    parseMultiValue(value, multiValue, valueType, result, null, state.designSet!, false);
  } else if (structuredValue) {
    value = parseMultiValue(value, structuredValue, valueType, [], null, state.designSet!, structuredValue);
    result = [name, params, valueType, value];
  } else {
    value = parseValue(value, valueType, state.designSet!, false);
    result = [name, params, valueType, value];
  }

  // rfc6350 requires that in vCard 4.0 the first component is the VERSION
  // component with as value 4.0, note that 3.0 does not have this requirement.
  if (state.component[0] === 'vcard' && state.component[1].length === 0 && !(name === 'version' && value === '4.0')) {
    state.designSet = getDesignSet('vcard3');
  }
  state.component[1].push(result);
};

/**
 * Parses iCalendar or vCard data into a raw jCal object.
 */
export const parse = (input: string) => {
  const component: Array<JCal> = [];
  const state: ParseState = { component, stack: [component] };

  eachLine(input, function (line) {
    handleContentLine(line, state);
  });
  /**
   * when there are still items on the stack
   * throw a fatal error, a component was not closed
   * correctly in that case.
   */
  if (state.stack.length > 1) {
    throw new ICalError('invalid ical body. component began but did not end');
  }

  return component.length == 1 ? (component as Array<JCal>)[0] : (component as unknown as JCal);
};
