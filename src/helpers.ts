import { ICalError } from './error';
/**
 * Checks if the given type is of the number type and also NaN.
 */
export const isStrictlyNaN = (num: number) => typeof num === 'number' && isNaN(num);

/**
 * Parses a string value that is expected to be an integer, when the valid is
 * not an integer throws a decoration error.
 *
 * @param {String} string     Raw string input
 * @return {Number}           Parsed integer
 */
export const strictParseInt = (str: string) => {
  const result = parseInt(str, 10);
  if (isStrictlyNaN(result)) {
    throw new ICalError('Could not extract integer from "' + str + '"');
  }
  return result;
};

/**
 * Truncates the given number, correctly handling negative numbers.
 */
export const trunc = (num: number) => (num < 0 ? Math.ceil(num) : Math.floor(num));

/**
 * Pads the given string or number with zeros so it will have at least two
 * characters.
 */
export const pad2 = (data: string | number) => {
  if (typeof data !== 'string') {
    // handle fractions.
    if (typeof data === 'number') data = parseInt(data as unknown as string);
    data = String(data);
  }

  switch (data.length) {
    case 0:
      return '00';
    case 1:
      return '0' + data;
    default:
      return data;
  }
};

type SelfClonality<T> = {
  clone(): T;
};

/**
 * Clone the passed object or primitive. By default a shallow clone will be
 * executed.               The copy of the thing
 */
export const clone = <T>(source: T, deep: boolean = false): T => {
  if (!source || typeof source != 'object') {
    return source;
  } else if (source instanceof Date) {
    return new Date(source.getTime()) as T;
  } else if ('clone' in source) {
    return (source as SelfClonality<T>).clone();
  } else if (Array.isArray(source)) {
    return source.map(item => {
      return deep ? clone(item, true) : item;
    }) as T;
  } else {
    const obj = {} as T;
    for (const name in source) {
      // uses prototype method to allow use of Object.create(null);
      /* istanbul ignore else */
      if (Object.prototype.hasOwnProperty.call(source, name)) {
        obj[name] = deep ? clone(source[name], true) : source[name];
      }
    }
    return obj;
  }
};

/**
 * Identical to indexOf but will only match values when they are not preceded
 * by a backslash character.
 * @param buffer String to search
 * @param search Value to look for
 * @param pos Start position
 */
export const unescapedIndexOf = (buffer: string, search: string, pos: number) => {
  while ((pos = buffer.indexOf(search, pos)) !== -1) {
    if (pos > 0 && buffer[pos - 1] === '\\') {
      pos += 1;
    } else {
      return pos;
    }
  }
  return -1;
};

export type Union<T> = T extends readonly [infer R, ...infer P] ? R | Union<P> : never;
