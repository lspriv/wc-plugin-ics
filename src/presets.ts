/*
 * Copyright 2024 lspriv. All Rights Reserved.
 * Distributed under MIT license.
 * See File LICENSE for detail or copy at https://opensource.org/licenses/MIT
 * @Description: Description
 * @Author: lspriv
 * @LastEditTime: 2024-02-24 16:04:13
 */
import { WcMark, offsetDate } from '@lspriv/wx-calendar/lib';
import { dateFmtStr } from './helpers';
import { ICSOpts, ICSMark, CurrentSeries, ICSPlugin } from './plugin';

export interface ICSCnPresetOptions {
  /** 节假日字体颜色 */
  festivalColor?: string;
  /** 节假日匹配 */
  festivalPattern?: RegExp;
  /** 角标工作日文本 */
  cornerWorkText?: string;
  /** 角标休息日文本 */
  cornerRestText?: string;
  /** 角标工作日文本颜色 */
  cornerWorkColor?: string;
  /** 角标休息日文本颜色 */
  cornerRestColor?: string;
  /** 匹配工作日 */
  workPattern?: RegExp;
  /** 匹配休息日 */
  restPattern?: RegExp;
  /** [vevent] 是否显示vevent日程 */
  eventSchedule?: boolean;
  /** [vevent] 日程字体颜色 */
  eventScheduleColor?: string;
  /** [vevent] 日程背景颜色 */
  eventScheduleBgColor?: string;
  /** [vtodo] 是否显示vtodo日程 */
  todoSchedule?: boolean;
  /** [vtodo] 日程字体颜色 */
  todoScheduleColor?: string;
  /** [vtodo] 日程背景颜色 */
  todoScheduleBgColor?: string;
  /** [valarm] 是否显示valarm日程 */
  alarmSchedule?: boolean;
  /** [valarm] 日程字体颜色 */
  alarmScheduleColor?: string;
  /** [valarm] 日程背景颜色 */
  alarmScheduleBgColor?: string;
  /** [vjournal] 是否显示vjournal日程 */
  journalSchedule?: boolean;
  /** [vjournal] 日程字体颜色 */
  journalScheduleColor?: string;
  /** [vjournal] 日程背景颜色 */
  journalScheduleBgColor?: string;
}

const FtvPattern = /^[^\s]+/;

/** 补班｜加班｜上班 */
const workPattern = /(\u8865|\u52a0|\u4e0a)\u73ed/;

/** 假期｜假日｜放假｜调休｜休息 */
const restPattern = /(\u5047\u671f|\u5047\u65e5|\u653e\u5047|\u8c03\u4f11|\u4f11\u606f)/;

const WORK_KEY = '__CN_PRE_WORK__';
const REST_KEY = '__CN_PRE_REST__';

export function ICSCnPreset(plugin: ICSPlugin): ICSOpts;
export function ICSCnPreset(options: ICSCnPresetOptions): (plugin?: ICSPlugin) => ICSOpts;

export function ICSCnPreset(plugin: ICSPlugin | ICSCnPresetOptions): ICSOpts | ((plugin: ICSPlugin) => ICSOpts) {
  const isICSInstance = plugin instanceof ICSPlugin;
  const opts: ICSCnPresetOptions = isICSInstance ? {} : plugin;

  const config: ICSCnPresetOptions = {
    festivalColor: opts?.festivalColor || 'var(--wc-solar-color)',
    festivalPattern: opts?.festivalPattern || FtvPattern,
    cornerWorkText: opts?.cornerWorkText || '班',
    cornerRestText: opts?.cornerRestText || '休',
    cornerWorkColor: opts?.cornerWorkColor || '#f37b1d',
    cornerRestColor: opts?.cornerRestColor || '#61b057',
    workPattern: opts?.workPattern || workPattern,
    restPattern: opts?.restPattern || restPattern,
    eventSchedule: opts?.eventSchedule ?? true,
    eventScheduleColor: opts?.eventScheduleColor,
    eventScheduleBgColor: opts?.eventScheduleBgColor,
    todoSchedule: opts?.todoSchedule ?? true,
    todoScheduleColor: opts?.todoScheduleColor || '#e7a23d',
    todoScheduleBgColor: opts?.todoScheduleBgColor || '#faecd8',
    alarmSchedule: opts?.alarmSchedule ?? true,
    alarmScheduleColor: opts?.alarmScheduleColor || '#f56c6d',
    alarmScheduleBgColor: opts?.alarmScheduleBgColor || '#fde2e2',
    journalSchedule: opts?.journalSchedule ?? true,
    journalScheduleColor: opts?.journalScheduleColor || '#67c23a',
    journalScheduleBgColor: opts?.journalScheduleBgColor || '#e1f3d8'
  };

  function createICSOptions(): ICSOpts {
    let series: CurrentSeries = {};

    return {
      event: function (props, key) {
        const summary = props.summary as string;
        const isWork = config.workPattern!.test(summary);
        const isRest = config.restPattern!.test(summary);
        props[REST_KEY] = isRest;
        props[WORK_KEY] = isWork;

        const mark = {} as ICSMark;
        let flag = false;

        // 生成节假日
        const date = +new Date(props.date!.year, props.date!.month - 1, props.date!.day);
        const name = summary.match(config.festivalPattern!)?.[0] || summary;

        const seriename = series!.name;
        const seriedate = series!.date;

        series!.name = name;
        series!.date = date;

        if (!seriedate || seriename !== name || Math.abs(date - seriedate) > 86400000) {
          mark.festival = { text: name, color: config.festivalColor, key };
          flag = true;
        }

        // 生成角标
        if (isWork || isRest) {
          mark.corner = { key } as WcMark;
          mark.corner.text = isWork ? config.cornerWorkText! : config.cornerRestText!;
          mark.corner.color = isWork ? config.cornerWorkColor : config.cornerRestColor;
          flag = true;
        }

        // 生成日程
        if (config.eventSchedule && props.description) {
          mark.schedule = {
            text: props.description,
            color: config.eventScheduleColor,
            bgColor: config.eventScheduleBgColor,
            key,
            dtstart: dateFmtStr(props.dtstart, props.date!),
            dtend: dateFmtStr(props.dtend, offsetDate(props.date!, 1)),
            summary: props.summary,
            description: props.description
          };
        }

        return flag ? mark : void 0;
      },
      todoScheduleText: props => (config.todoSchedule ? void 0 : (props.description as string)),
      todoScheduleColor: config.todoScheduleColor,
      todoScheduleBgColor: config.todoScheduleBgColor,
      journalScheduleText: props => (config.journalSchedule ? void 0 : (props.description as string)),
      journalScheduleColor: config.journalScheduleColor,
      journalScheduleBgColor: config.journalScheduleBgColor,
      alarmScheduleText: props => (config.alarmSchedule ? void 0 : (props.description as string)),
      alarmScheduleColor: config.alarmScheduleColor,
      alarmScheduleBgColor: config.alarmScheduleBgColor,
      collectAnuualMark: function (props) {
        if (props[REST_KEY] || props[WORK_KEY]) {
          // 生成年度标记
          return { rwtype: props[WORK_KEY] ? 'work' : 'rest' };
        }
      },
      afterMarked: function () {
        series = {};
      }
    };
  }
  return isICSInstance ? createICSOptions() : createICSOptions;
}
