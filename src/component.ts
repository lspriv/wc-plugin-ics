import { type JCal } from './parse';
import { ICalProperty } from './property';
import { type DesignSet, getDesignSet } from './design';

const PROPERTY_INDEX = 1;
const NAME_INDEX = 0;

export class ICalComponent {
  jCal: JCal;
  parent: ICalComponent | null;

  private properties?: Array<ICalProperty>;
  private hydratedPropertyCount: number = 0;

  constructor(jCal: JCal | string, parent?: ICalComponent) {
    if (typeof jCal === 'string') jCal = [jCal, [], []];
    // mostly for legacy reasons.
    this.jCal = jCal;
    this.parent = parent || null;
  }

  /**
   * The design set for this component, e.g. icalendar vs vcard
   */
  get designSet(): DesignSet {
    const parentDesign = this.parent && this.parent.designSet;
    return parentDesign || getDesignSet(this.jCal[NAME_INDEX]);
  }

  /**
   * Returns first property's value, if available.
   * @param name    Lowercase property name
   */
  getFirstPropertyValue(name: string): string | null {
    const prop = this.getFirstProperty(name);
    if (prop) return prop.getFirstValue();
    return null;
  }

  /**
   * Finds the first property, optionally with the given name.
   * @param name Lowercase property name
   */
  getFirstProperty(name: string) {
    if (name) {
      let i = 0;
      const props = this.jCal[PROPERTY_INDEX];
      const len = props.length;
      for (; i < len; i++) {
        if (props[i][NAME_INDEX] === name) {
          const result = this.hydrateProperty(i);
          return result;
        }
      }
    } else {
      if (this.jCal[PROPERTY_INDEX].length) {
        return this.hydrateProperty(0);
      }
    }
    return null;
  }

  private hydrateProperty(idx: number) {
    if (!this.properties) {
      this.properties = [];
      this.hydratedPropertyCount = 0;
    }

    if (this.properties[idx]) {
      return this.properties[idx];
    }

    const prop = new ICalProperty(this.jCal[PROPERTY_INDEX][idx], this);

    this.hydratedPropertyCount++;
    return (this.properties[idx] = prop);
  }
}
