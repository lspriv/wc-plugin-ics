/*
 * Copyright 2024 lspriv. All Rights Reserved.
 * Distributed under MIT license.
 * See File LICENSE for detail or copy at https://opensource.org/licenses/MIT
 * @Description: Description
 * @Author: lspriv
 * @LastEditTime: 2024-02-20 19:42:01
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
  type Nullable,
  normalDate,
  isFunction,
  isString,
  nextTick,
  promises,
  formDateByStrKey
} from '@lspriv/wx-calendar/lib';
import { wxPromisify } from '@lspriv/wc-shared';
import { JCal, JCalProp, parse } from './parse';
import { JCAL_COMPONENT } from './design';

type PropsReturn<R, P extends any[] = []> = (properties: JCalPropDict, ...args: P) => R | undefined;

type ICSComponentType = 'event' | 'alarm' | 'todo' | 'journal';
type ICSComponentVType = `v${ICSComponentType}`;

type ICSCompTypeOpt<K extends string | void, T> = {
  [P in ICSComponentType as K extends string ? `${P}${K}` : P]?: T;
};

type ICSCompTypeOpts = ICSCompTypeOpt<void, PropsReturn<ICSMark>> &
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
  collectAnuualMark?: PropsReturn<WcAnnualMark, [sets: WcAnnualMarks]>;
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

export interface ICSSubcribeOptsGeneration {
  (instance: ICSPlugin): ICSSubcribeOpts;
}

export type ICSSubcribe = ICSSubcribeOpts & {
  kind?: 'link' | 'file' | 'content';
  source: string;
};

interface JCalPropDict {
  [x: string]: any;
  compname: string;
  icskey?: string;
  date?: CalendarDay;
}

interface JCalPropParsed extends JCalPropDict {
  components: Array<JCal>;
}

export interface CurrentSeries {
  date?: number;
  name?: string;
}

export type ICSMark = {
  [P in keyof TrackDateResult]?: P extends 'schedule' ? WcScheduleMark : WcMark;
};

type ICSMarkSets = {
  [P in keyof TrackDateResult]-?: Array<WcMark>;
};

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

export class ICSPlugin implements Plugin {
  static KEY = 'wc-plugin-ics' as const;

  private options: ICSOpts;

  private subcribes: Array<ICSSubcribe> = [];

  marks: Map<string, ICSMarkSets> = new Map();

  annualMarks: WcAnnualMarks = new Map();

  // series: CurrentSeries = {};

  service: PluginService;

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

      const vcalendar = await this.loadICS(subscribe);
      const _subscribe: ICSSubcribe = {
        ...subscribe,
        calname: subscribe.calname || vcalendar['x-wr-calname'],
        icskey: subscribe.icskey || `${vcalendar.prodid}@${vcalendar.version}`
      };

      this.generateMarks(vcalendar.components, _subscribe);
      this.subcribes.push(_subscribe);
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

  public async load(
    subscribe: Pick<ICSSubcribe, 'source' | 'kind'>,
    options?: ICSSubcribeOpts | ICSSubcribeOptsGeneration
  ): Promise<void>;
  public async load(
    source: string,
    type?: ICSSubcribe['kind'],
    options?: ICSSubcribeOpts | ICSSubcribeOptsGeneration
  ): Promise<void>;

  /**
   * 加载 ICS 订阅
   * @param source 来源
   * @param type 类型 link来自连接 file本地文件 content订阅内容
   */
  public async load(
    source: string | Pick<ICSSubcribe, 'source' | 'kind'>,
    type: ICSSubcribe['kind'] | ICSSubcribeOpts | ICSSubcribeOptsGeneration = 'link',
    options?: ICSSubcribeOpts | ICSSubcribeOptsGeneration
  ) {
    const sourceIsStr = isString(source);
    const _source = sourceIsStr ? source : source.source;
    const _kind = sourceIsStr ? (type as ICSSubcribe['kind']) : source.kind;
    const kind = subsKindValid(_kind) ? _kind : 'link';
    const typeOpts = sourceIsStr ? null : execPossibleFunc(type as ICSSubcribeOpts | ICSSubcribeOptsGeneration, this);

    const subscribe = {
      source: _source,
      kind,
      ...typeOpts,
      ...execPossibleFunc(options, this)
    };
    if (subscribe.icskey && this.subcribes.find(item => item.icskey === subscribe.icskey)) {
      throw new Error('ics file loaded');
    }
    const vcalendar = await this.loadICS(subscribe);
    const _subcribe: ICSSubcribe = {
      ...subscribe,
      calname: subscribe.calname || vcalendar['x-wr-calname'],
      icskey: subscribe.icskey || `${vcalendar.prodid}@${vcalendar.version}`
    };
    this.subcribes.push(_subcribe);
    const { dates, annuals } = this.generateMarks(vcalendar.components, _subcribe);

    if (this.service.component._loaded_) {
      await promises([
        dates.length && this.service.updateDates(dates),
        annuals.length && this.service.updateAnnuals(annuals)
      ]);
    }
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
    return { ...props, components: data[2] };
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
      props.date = date;
      const mark = this.assignComponentHandle(props, options);
      if (mark) {
        this.collectMark(key, mark);
        updates.push(date);
      }

      const annualMark = options.collectAnuualMark?.(props, this.annualMarks);
      if (annualMark) {
        this.collectAnnualMark(key, annualMark);
        annualUpdates.add(date.year);
      }
    }
    options.afterMarked?.(options, this);
    return { dates: updates, annuals: [...annualUpdates] };
  }

  private assignComponentHandle(props: JCalPropDict, options: ICSSubcribeOpts) {
    switch (props.compname) {
      case JCAL_COMPONENT.EVENT:
        return this.createIcsMark('event', props, options);
      case JCAL_COMPONENT.ALRAM:
        return this.createIcsMark('alarm', props, options);
      case JCAL_COMPONENT.TODO:
        return this.createIcsMark('todo', props, options);
      case JCAL_COMPONENT.JOURNAL:
        return this.createIcsMark('journal', props, options);
      default:
        return void 0;
    }
  }

  private createIcsMark(type: ICSComponentType, props: JCalPropDict, options: ICSSubcribeOpts) {
    if (options[type]) return options[type]!(props);

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
        mark.festival = { text, color, key: options.icskey };
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
        mark.corner = { text, color, key: options.icskey };
        valid = true;
      }
    }

    if (asSchedule) {
      let text: string | undefined;
      const scheduleText = `${type}ScheduleText` as `${ICSComponentType}ScheduleText`;
      if (options[scheduleText]) {
        text = options[scheduleText]?.(props);
      } else {
        text = `${props.summary}\n\n${props.description}`;
      }
      if (text) {
        const color = execPossibleFunc(options[`${type}ScheduleColor`], props) || void 0;
        const bgColor = execPossibleFunc(options[`${type}ScheduleBgColor`], props) || void 0;
        mark.schedule = { text, color, bgColor, key: options.icskey };
        valid = true;
      }
    }

    return valid ? mark : void 0;
  }

  private collectMark(key: string, mark: ICSMark) {
    let m = this.marks.get(key);
    m = m || { festival: [], corner: [], schedule: [] };
    if (mark.corner) m.corner.push(mark.corner);
    if (mark.festival) m.festival.push(mark.festival);
    if (mark.schedule) m.schedule.push(mark.schedule);
    this.marks.set(key, m);
  }

  private collectAnnualMark(key: string, mark: WcAnnualMark) {
    let m = this.annualMarks.get(key);
    m = m || {};
    mark.rwtype && (m.rwtype = mark.rwtype);
    mark.sub && (m.sub = mark.sub);
    this.annualMarks.set(key, m);
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
      result.corner = { text: corner.text, color: corner.color };
    }
    if (flen) {
      const festival = mark.festival[flen - 1];
      result.festival = { text: festival.text, color: festival.color };
    }
    if (mark.schedule.length) {
      result.schedule = [...mark.schedule];
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
        marks.set(k, sets);
        flag = true;
      }
    }
    return flag ? { marks } : null;
  }
}

export const ICS_PLUGIN_KEY = ICSPlugin.KEY;
