/**
 * This symbol is further described later on
 */
export class ICalBinary {
  value: string;
  icaltype = 'binary' as const;

  constructor(value: string) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

export const fromString = (str: string) => new ICalBinary(str);
