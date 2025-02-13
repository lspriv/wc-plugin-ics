/*
 * Copyright 2024 lspriv. All Rights Reserved.
 * Distributed under MIT license.
 * See File LICENSE for detail or copy at https://opensource.org/licenses/MIT
 * @Description: Description
 * @Author: lspriv
 * @LastEditTime: 2024-05-08 00:02:48
 */
import {
  type Plugin,
  type TrackDateResult,
  type TrackYearResult,
  type CalendarDay,
  type CalendarMark,
  type WcYear,
  type WcMark,
  type WcScheduleMark,
  type WcAnnualMark,
  type WcAnnualMarks,
  type PluginService,
  type WcScheduleInfo,
  type DateStyle,
  type Nullable,
  normalDate,
  isFunction,
  isString,
  nextTick,
  promises,
  offsetDate,
  getMarkKey,
  formDateByStrKey
} from '@lspriv/wx-calendar/lib';
import { wxPromisify } from '@lspriv/wc-shared';
import { dateFmtStr } from './helpers';
import { JCal, JCalProp, parse } from './parse';
import { JCAL_COMPONENT } from './design';

type PropsReturn<R, P extends any[] = []> = (properties: JCalPropDict, ...args: P) => R | undefined;

type ICSComponentType = 'event' | 'alarm' | 'todo' | 'journal';
type ICSComponentVType = `v${ICSComponentType}`;

type ICSCompTypeOpt<K extends string | void, T> = {
  [P in ICSComponentType as K extends string ? `${P}${K}` : P]?: T;
};

type ICSCompTypeOpts = ICSCompTypeOpt<void, PropsReturn<ICSMark, [key: string]>> &
  ICSCompTypeOpt<'MarkAs', CalendarMark['type'] | Array<CalendarMark['type']>> &
  ICSCompTypeOpt<'FestivalName', PropsReturn<string>> &
  ICSCompTypeOpt<'FestivalColor', string | PropsReturn<string>> &
  ICSCompTypeOpt<'CornerText', PropsReturn<string>> &
  ICSCompTypeOpt<'CornerColor', string | PropsReturn<string>> &
  ICSCompTypeOpt<'ScheduleText', PropsReturn<string>> &
  ICSCompTypeOpt<'ScheduleColor', string | PropsReturn<string>> &
  ICSCompTypeOpt<'ScheduleBgColor', string | PropsReturn<string>>;

export type ICSOpts = ICSCompTypeOpts & {
  subcribes?: Array<ICSSubcribe>;
  parseDate?: PropsReturn<CalendarDay>;
  collectAnuualMark?: PropsReturn<WcAnnualMark, [sets: ICSAnnualMarkMap]>;
  afterMarked?: (options: ICSSubcribeOpts, instance: ICSPlugin) => void;
};

type ICSCommonOpts = Omit<ICSOpts, 'subcribes'>;

export interface ICSOptsGeneration {
  (instance: ICSPlugin): ICSOpts;
}

type ICSSubcribeOpts = ICSCommonOpts & {
  calname?: string;
  icskey?: string;
};

export interface ICSSubcribeGeneration {
  (instance: ICSPlugin): ICSSubcribe;
}

export interface ICSSubcribeOptsGeneration {
  (instance: ICSPlugin): ICSSubcribeOpts;
}

export type ICSSubcribe = ICSSubcribeOpts & {
  kind?: 'link' | 'file' | 'content';
  source: string;
};

interface JCalPropDict {
  [x: string | symbol]: any;
  compname: string;
  icskey?: string;
  date?: CalendarDay;
}

type JCalPropParsed = [props: JCalPropDict, components: Array<JCal>];

export interface CurrentSeries {
  date?: number;
  name?: string;
}

type ICSScheduleMark = WcScheduleMark & {
  dtstart: string;
  dtend: string;
  summary?: string;
  description?: string;
};

export type ICSMark = {
  [P in keyof TrackDateResult]?: P extends 'schedule' ? ICSScheduleMark : WcMark;
};

type ICSMarkSets = {
  [P in keyof ICSMark]-?: Array<Required<ICSMark>[P]>;
};

type ICSAnnualMark = WcAnnualMark & {
  key: string;
};

type ICSAnnualMarkMap = Map<string, Array<ICSAnnualMark>>;

const subsKindValid = (kind: unknown) => ['link', 'file', 'content'].includes(kind as string);

const collectProps = (compname: string, data: Array<JCalProp>): JCalPropDict => {
  return data.reduce(
    (acc, prop) => {
      acc[prop[0]] = prop[3];
      return acc;
    },
    { compname }
  );
};

type PossibleFuncParams<T> = T extends (...args: any[]) => any ? Parameters<T> : never;
type PossibleFuncReturn<T> = T extends (...args: any[]) => any ? ReturnType<T> : T;
export const execPossibleFunc = <T>(possibleFunc: T, ...args: PossibleFuncParams<T>): PossibleFuncReturn<T> => {
  return isFunction(possibleFunc) ? possibleFunc(...args) : possibleFunc;
};

const USEFUL_COMPONENTS = [
  JCAL_COMPONENT.EVENT,
  JCAL_COMPONENT.ALRAM,
  JCAL_COMPONENT.TODO,
  JCAL_COMPONENT.JOURNAL
] as const;

interface ICSUpdates {
  dates: Array<CalendarDay>;
  annuals: Array<number>;
}

// const getICSKeyPrefix = (icskey: string) => `[${icskey}]`;

const generateKey = (props: JCalPropDict, icskey: string) => {
  return `[${icskey}]${props.uid || `${props.date!.year}_${props.date!.month}_${props.date!.day}`}`;
};

const icsKeyPattern = (icskey: string) => new RegExp(`^\\[${icskey}\\]`);

interface ICSKeyParse {
  icskey: string;
  uid: string;
}

const ICSKeyPattern = /^\[(.*?)\]/;
const parseKey = (key: string): ICSKeyParse => {
  const icskey = key.match(ICSKeyPattern)?.[1] || '';
  const uid = key.replace(ICSKeyPattern, '');
  return { icskey, uid };
};

export class ICSPlugin implements Plugin {
  static KEY = 'wc-plugin-ics' as const;

  private options: ICSOpts;

  private subcribes?: Array<ICSSubcribe> = [];

  marks: Map<string, ICSMarkSets> = new Map();

  annualMarks: ICSAnnualMarkMap = new Map();

  // series: CurrentSeries = {};

  service?: PluginService;

  constructor(options?: ICSOpts | ICSOptsGeneration) {
    this.options = this.formOptions(execPossibleFunc(options, this));
  }

  async PLUGIN_INITIALIZE(service: PluginService) {
    this.service = service;
    if (this.options.subcribes?.length) {
      await this.loadSubcribes(this.options.subcribes);
      if (service.component._loaded_) {
        const dates = [...this.marks.keys()].map(k => formDateByStrKey(k));
        dates.length && service.updateDates(dates);
        if (this.annualMarks.size) {
          const annuals = [...this.annualMarks.keys()].flatMap(key => {
            const year = key.match(/^\d+/)?.[0];
            return year ? parseInt(year) : [];
          });
          annuals.length && service.updateAnnuals(annuals);
        }
      }
    }
    delete this.options.subcribes;
  }

  private formOptions(options?: ICSOpts): ICSOpts {
    const eventMarkAs = Array.isArray(options?.eventMarkAs)
      ? options.eventMarkAs
      : [options?.eventMarkAs || 'schedule'];
    const alarmMarkAs = Array.isArray(options?.alarmMarkAs)
      ? options.alarmMarkAs
      : [options?.alarmMarkAs || 'schedule'];
    const todoMarkAs = Array.isArray(options?.todoMarkAs) ? options.todoMarkAs : [options?.todoMarkAs || 'schedule'];
    const journalMarkAs = Array.isArray(options?.journalMarkAs)
      ? options.journalMarkAs
      : [options?.journalMarkAs || 'schedule'];
    return {
      ...options,
      eventMarkAs,
      alarmMarkAs,
      todoMarkAs,
      journalMarkAs
    };
  }

  /**
   * 加载订阅
   * @param subcribes 订阅集合
   */
  private async loadSubcribes(subcribes: Array<ICSSubcribe>) {
    await nextTick();
    for (const subscribe of subcribes) {
      if (!subsKindValid(subscribe.kind)) subscribe.kind = 'link';
      if (!subscribe.source) throw new Error('invalid subcribe source');

      const [props, components] = await this.loadICS(subscribe);
      const _subscribe: ICSSubcribe = {
        ...subscribe,
        calname: subscribe.calname || props['x-wr-calname'],
        icskey: subscribe.icskey || `${props.prodid}@${props.version}`
      };

      this.generateMarks(components, _subscribe);
      this.subcribes!.push(_subscribe);
    }
  }

  /**
   * 加载 ICS
   * @param source 来源
   * @param type 类型 link来自连接 file本地文件 content订阅内容
   */
  private async loadICS(subcribe: ICSSubcribe) {
    if (subcribe.kind === 'link') {
      const result = await wxPromisify(wx.downloadFile, { url: subcribe.source });
      return this.parseFile(result.tempFilePath);
    } else if (subcribe.kind === 'file') {
      return this.parseFile(subcribe.source);
    } else {
      return this.parseJCal(parse(subcribe.source));
    }
  }

  public async load(subscribe: ICSSubcribe | ICSSubcribeGeneration): Promise<string>;
  public async load(
    source: string,
    type?: ICSSubcribe['kind'],
    options?: ICSSubcribeOpts | ICSSubcribeOptsGeneration
  ): Promise<string>;

  /**
   * 加载 ICS 订阅
   * @param source 来源
   * @param type 类型 link来自连接 file本地文件 content订阅内容
   */
  public async load(
    source: string | ICSSubcribe | ICSSubcribeGeneration,
    type: ICSSubcribe['kind'] = 'link',
    options?: ICSSubcribeOpts | ICSSubcribeOptsGeneration
  ) {
    const sourceIsStr = isString(source);
    const opts = execPossibleFunc(sourceIsStr ? options : source, this);
    const _source = sourceIsStr ? source : (opts as ICSSubcribe).source;
    if (!_source) throw new Error('missing param [source]');
    const kind = (sourceIsStr ? type : (opts as ICSSubcribe).kind) || 'link';

    const subscribe = {
      ...opts,
      source: _source,
      kind
    };

    if (subscribe.icskey && this.subcribes!.find(item => item.icskey === subscribe.icskey)) return subscribe.icskey!;

    const [props, components] = await this.loadICS(subscribe);
    const _subcribe: ICSSubcribe = {
      ...subscribe,
      calname: subscribe.calname || props['x-wr-calname'],
      icskey: subscribe.icskey || `${props.prodid}@${props.version}`
    };
    this.subcribes!.push(_subcribe);
    const { dates, annuals } = this.generateMarks(components, _subcribe);

    if (this.service!.component._loaded_) {
      await promises([
        dates.length && this.service!.updateDates(dates),
        annuals.length && this.service!.updateAnnuals(annuals)
      ]);
    }
    return _subcribe.icskey!;
  }

  /**
   * 读取本地文件内容
   * @param path 要读取的文件的路径 (本地路径)
   */
  private parseFile(path: string) {
    const manager = wx.getFileSystemManager();
    const content = manager.readFileSync(path, 'utf8');
    const jcal = parse(content as string);
    return this.parseJCal(jcal);
  }

  private parseJCal(data: JCal): JCalPropParsed {
    if (data[0] !== JCAL_COMPONENT.CALENDAR) throw new Error('ics file format error');
    const props = collectProps(JCAL_COMPONENT.CALENDAR, data[1]);
    return [props, data[2]];
  }

  private generateMarks(data: Array<JCal>, subOptions?: ICSSubcribeOpts): ICSUpdates {
    const options: ICSSubcribeOpts = { ...this.options, ...subOptions };
    const updates: CalendarDay[] = [];
    const annualUpdates: Set<number> = new Set();
    for (const component of data) {
      const name = component[0];
      if (!USEFUL_COMPONENTS.includes(name as ICSComponentVType)) continue;

      const props = collectProps(name, component[1]);
      const date = options.parseDate?.(props) || normalDate(props.dtstart);
      const key = `${date.year}_${date.month}_${date.day}`;
      const id = generateKey(props, options.icskey!);
      props.date = date;

      const mark = this.assignComponentHandle(id, props, options);
      if (mark) {
        this.collectMark(key, mark);
        updates.push(date);
      }

      const annualMark = options.collectAnuualMark?.(props, this.annualMarks);
      if (annualMark) {
        this.collectAnnualMark(key, id, annualMark);
        annualUpdates.add(date.year);
      }
    }
    options.afterMarked?.(options, this);
    return { dates: updates, annuals: [...annualUpdates] };
  }

  private assignComponentHandle(id: string, props: JCalPropDict, options: ICSSubcribeOpts) {
    switch (props.compname) {
      case JCAL_COMPONENT.EVENT:
        return this.createIcsMark('event', id, props, options);
      case JCAL_COMPONENT.ALRAM:
        return this.createIcsMark('alarm', id, props, options);
      case JCAL_COMPONENT.TODO:
        return this.createIcsMark('todo', id, props, options);
      case JCAL_COMPONENT.JOURNAL:
        return this.createIcsMark('journal', id, props, options);
      default:
        return void 0;
    }
  }

  private createIcsMark(type: ICSComponentType, id: string, props: JCalPropDict, options: ICSSubcribeOpts) {
    if (options[type]) return options[type]!(props, id);

    const markAs = options[`${type}MarkAs`] as Array<CalendarMark['type']>;
    const asFestival = markAs.includes('festival');
    const asCorner = markAs.includes('corner');
    const asSchedule = markAs.includes('schedule');

    const mark = {} as ICSMark;
    let valid = false;

    if (asFestival) {
      let text: string | undefined;
      const festivalName = `${type}FestivalName` as `${ICSComponentType}FestivalName`;
      if (options[festivalName]) {
        text = options[festivalName]?.(props);
      } else {
        text = props.summary as string;
      }
      if (text) {
        const color = execPossibleFunc(options[`${type}FestivalColor`], props) || void 0;
        mark.festival = { text, key: id };
        if (color) mark.festival.style = { color };
        valid = true;
      }
    }

    if (asCorner) {
      let text: string | undefined;
      const cornerText = `${type}CornerText` as `${ICSComponentType}CornerText`;
      if (options[cornerText]) {
        text = options[cornerText]?.(props);
      } else {
        text = (props.summary as string).substr(0, 1);
      }
      if (text) {
        const color = execPossibleFunc(options[`${type}CornerColor`], props) || void 0;
        mark.corner = { text, key: id };
        if (color) mark.corner.style = { color };
        valid = true;
      }
    }

    if (asSchedule) {
      let text: string | undefined;
      const scheduleText = `${type}ScheduleText` as `${ICSComponentType}ScheduleText`;
      if (options[scheduleText]) {
        text = options[scheduleText]?.(props);
      } else {
        text = props.summary;
      }
      if (text) {
        const color = execPossibleFunc(options[`${type}ScheduleColor`], props) || void 0;
        const bgColor = execPossibleFunc(options[`${type}ScheduleBgColor`], props) || void 0;
        mark.schedule = {
          key: id,
          text,
          dtstart: dateFmtStr(props.dtstart, props.date!),
          dtend: dateFmtStr(props.dtend, offsetDate(props.date!, 1)),
          summary: props.summary,
          description: props.description
        };
        if (color) mark.schedule!.style = { color };
        if (bgColor) {
          mark.schedule.style = (mark.schedule.style || {}) as DateStyle;
          mark.schedule.style.backgroundColor = bgColor;
        }
        valid = true;
      }
    }

    return valid ? mark : void 0;
  }

  private collectMark(key: string, mark: ICSMark) {
    let m = this.marks.get(key);
    m = m || { festival: [], corner: [], schedule: [], solar: [], style: [] };
    if (mark.corner) m.corner.push(mark.corner);
    if (mark.festival) m.festival.push(mark.festival);
    if (mark.schedule) m.schedule.push(mark.schedule);
    this.marks.set(key, m);
  }

  private collectAnnualMark(key: string, id: string, mark: WcAnnualMark) {
    let m = this.annualMarks.get(key);
    m = m || [];
    const _mark: ICSAnnualMark = { key: id };
    mark.rwtype && (_mark.rwtype = mark.rwtype);
    mark.sub && (_mark.sub = mark.sub);
    m.push(_mark);
    this.annualMarks.set(key, m);
  }

  /**
   * 移除订阅
   * @param icskey key
   */
  public async remove(icskey: string) {
    this.subcribes = this.subcribes!.filter(s => s.icskey !== icskey);

    const pattern = icsKeyPattern(icskey);
    const entries = this.marks.entries();
    const updates: Set<string> = new Set();

    function removeSet(key: string, sets: ICSMarkSets, prop: keyof ICSMarkSets) {
      if (sets[prop].length) {
        const arr = [...sets[prop]].reverse();
        const idx = arr.findIndex(item => pattern.test(item.key!));
        if (idx >= 0) {
          sets[prop] = sets[prop].filter(item => !pattern.test(item.key!)) as ICSScheduleMark[];
          if (prop === 'schedule' || !idx) updates.add(key);
        }
      }
    }

    for (const [key, sets] of entries) {
      removeSet(key, sets, 'corner');
      removeSet(key, sets, 'festival');
      removeSet(key, sets, 'schedule');
      if (!(sets.corner.length || sets.festival.length || sets.schedule.length)) this.marks.delete(key);
    }

    const annualEntries = this.annualMarks.entries();
    const years: Set<number> = new Set();
    for (const [key, marks] of annualEntries) {
      const arr = [...marks].reverse();
      const idx = arr.findIndex(item => pattern.test(item.key));
      if (idx >= 0) {
        const _marks = marks.filter(item => !pattern.test(item.key));
        if (_marks.length) this.annualMarks.set(key, _marks);
        else this.annualMarks.delete(key);
        !idx && years.add(+key.replace(/(?<=^\d{4})(_.*)/, ''));
      }
    }

    if (this.service!.component._loaded_) {
      await promises([
        updates.size && this.service!.updateDates([...updates].map(key => formDateByStrKey(key))),
        years.size && this.service!.updateAnnuals([...years])
      ]);
    }
  }

  PLUGIN_TRACK_DATE(date: CalendarDay): Nullable<TrackDateResult> {
    const key = `${date.year}_${date.month}_${date.day}`;
    const mark = this.marks.get(key);
    if (!mark) return null;
    const result: TrackDateResult = {};
    const clen = mark.corner.length;
    const flen = mark.festival.length;
    if (clen) {
      const corner = mark.corner[clen - 1];
      result.corner = { text: corner.text };
      if (corner.style) result.corner.style = corner.style;
    }
    if (flen) {
      const festival = mark.festival[flen - 1];
      result.festival = { text: festival.text };
      if (festival.style) result.festival.style = festival.style;
    }
    if (mark.schedule.length) {
      result.schedule = [
        ...mark.schedule.map(s => ({
          key: getMarkKey(s.key!, ICSPlugin.KEY),
          text: s.text,
          ...(s.style ? { style: s.style } : {})
        }))
      ];
    }
    return result;
  }

  PLUGIN_TRACK_YEAR(year: WcYear): Nullable<TrackYearResult> {
    const regexp = new RegExp(`^${year.year}_`);
    const marks: WcAnnualMarks = new Map();
    const entries = this.annualMarks.entries();
    let flag = false;

    for (const [key, sets] of entries) {
      if (regexp.test(key)) {
        const k = key.replace(regexp, '');
        const mark = sets[sets.length - 1];
        marks.set(k, { rwtype: mark.rwtype, sub: mark.sub });
        flag = true;
      }
    }
    return flag ? { marks } : null;
  }

  PLUGIN_TRACK_SCHEDULE(date: CalendarDay, id?: string): Nullable<WcScheduleInfo> {
    if (!id) return null;
    const parse = parseKey(id);
    if (!parse.icskey || !parse.uid) return null;
    const subscribe = this.subcribes!.find(s => s.icskey === parse.icskey);
    if (!subscribe) return null;
    const key = `${date.year}_${date.month}_${date.day}`;
    const mark = this.marks.get(key);
    if (!mark) return null;
    const schedule = mark.schedule.find(s => s.key === id);
    if (!schedule) return null;
    return {
      dtStart: new Date(schedule.dtstart),
      dtEnd: new Date(schedule.dtend),
      origin: subscribe.calname,
      originKey: id,
      summary: schedule.summary,
      description: schedule.description
    };
  }

  PLUGIN_ON_DETACHED() {
    this.service = void 0;
    this.subcribes = void 0;
    this.marks.clear();
    this.annualMarks.clear();
  }
}

export const ICS_PLUGIN_KEY = ICSPlugin.KEY;
