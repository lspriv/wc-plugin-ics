import { type JCalProp } from './parse';
import { ICalComponent } from './component';
import { DEFAULT_TYPE, ICalendar } from './design';

const NAME_INDEX = 0;
const PROP_INDEX = 1;
const TYPE_INDEX = 2;
const VALUE_INDEX = 3;

export class ICalProperty {
  jCal: JCalProp;
  isDecorated: boolean;
  isMultiValue: boolean;
  isStructuredValue: boolean;

  private parent?: ICalComponent;
  private values?: Array<string>;

  constructor(jCal: JCalProp | string, parent?: ICalComponent) {
    this.parent = parent || void 0;
    if (typeof jCal === 'string') {
      // We are creating the property by name and need to detect the type
      this.jCal = [jCal, {}, DEFAULT_TYPE];
      this.jCal[TYPE_INDEX] = this.getDefaultType();
    } else {
      this.jCal = jCal;
    }
    this.updateType();
  }

  /**
   * The design set for this property, e.g. icalendar vs vcard
   */
  private get designSet() {
    return this.parent ? this.parent.designSet : ICalendar;
  }

  /**
   * Get the default type based on this property's name.
   */
  getDefaultType(): string {
    const name = this.jCal[NAME_INDEX];
    const designSet = this.designSet;

    if (name in designSet.property) {
      const details = designSet.property[name];
      if ('defaultType' in details) {
        return details.defaultType;
      }
    }
    return DEFAULT_TYPE;
  }

  /**
   * Updates the type metadata from the current jCal type and design set.
   */
  private updateType() {
    const designSet = this.designSet;
    const type = this.jCal[TYPE_INDEX];
    const name = this.jCal[NAME_INDEX];

    if (type in designSet.value) {
      if ('decorate' in designSet.value[type]) {
        this.isDecorated = true;
      } else {
        this.isDecorated = false;
      }

      if (name in designSet.property) {
        this.isMultiValue = 'multiValue' in designSet.property[name];
        this.isStructuredValue = 'structuredValue' in designSet.property[name];
      }
    }
  }

  getFirstValue(): string | null {
    return this.hydrateValue(0);
  }

  /**
   * Gets a parameter on the property.
   * @param name Parameter name (lowercase)
   */
  getParameter(name: string) {
    if (name in this.jCal[PROP_INDEX]) {
      return this.jCal[PROP_INDEX][name];
    } else {
      return undefined;
    }
  }

  /**
   * Hydrate a single value. The act of hydrating means turning the raw jCal
   * value into a potentially wrapped object
   * @param index The index of the value to hydrate
   */
  private hydrateValue(idx: number) {
    if (this.values && this.values[idx]) {
      return this.values[idx];
    }

    // for the case where there is no value.
    if (this.jCal.length <= VALUE_INDEX + idx) {
      return null;
    }

    if (this.isDecorated) {
      if (!this.values) this.values = [];
      return (this.values[idx] = this.decorate(this.jCal[VALUE_INDEX + idx] as string));
    } else {
      return this.jCal[VALUE_INDEX + idx] as string;
    }
  }

  private decorate(value: string) {
    const type = this.jCal[TYPE_INDEX];
    return this.designSet.value[type].decorate(value, this) as string;
  }
}
