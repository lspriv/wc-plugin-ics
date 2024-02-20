/*
 * Copyright 2024 lspriv. All Rights Reserved.
 * Distributed under MIT license.
 * See File LICENSE for detail or copy at https://opensource.org/licenses/MIT
 * @Description: Description
 * @Author: lspriv
 * @LastEditTime: 2024-02-20 08:09:18
 */
import { CalendarDateMark, WxCalendarYearMark } from '@lspriv/wx-calendar/lib';
import type { ICSPlugin, ICS_OPTS, ICSMark, CurrentSeries } from './plugin';

const FtvPattern = /^[^\s]+/;

/** 补班｜加班｜上班 */
const workPattern = /(\u8865|\u52a0|\u4e0a)\u73ed/;

/** 假期｜假日｜放假｜调休｜休息 */
const restPattern = /(\u5047\u671f|\u5047\u65e5|\u653e\u5047|\u8c03\u4f11|\u4f11\u606f)/;

export const ICSCnPreset = (plugin: ICSPlugin): ICS_OPTS => {
  let series: CurrentSeries | null = {}; 

  return {
    eventMarkAs: ['festival', 'corner', 'schedule'],
    event: function(props) {
      const summary = props.summary as string;
      const isWork = workPattern.test(summary);

      const mark = {} as ICSMark;
      let flag = false;

      // 生成节假日
      if (!isWork) {
        const date = +(new Date(props.date!.year, props.date!.month - 1, props.date!.day));
        const name = summary.match(FtvPattern)?.[0] || summary;

        const seriename = series!.name;
        const seriedate = series!.date;

        series!.name = name;
        series!.date = date;

        if (!seriedate || seriename !== name || Math.abs(date - seriedate) > 86400000) {
          mark.festival = { text: name, color: 'var(--wc-solar-color)', key: props.icskey };
          flag = true;
        }
      }

      // 生成角标
      const isRest = restPattern.test(summary);
      if (isWork || isRest) {
        mark.corner = { key: props.icskey } as CalendarDateMark;
        mark.corner.text = isWork ? '班' : '休';
        mark.corner.color = isWork ? '#f37b1d' : '#61b057';

        // 生成年度标记
        const annualMark: WxCalendarYearMark = isWork ? 'work' : 'rest';
        const ak = `${props.date!.year}_${props.date!.month}_${props.date!.day}`;
        let am = plugin.annualMarks.get(ak);
        am = am || new Set();
        am.add(annualMark);
        plugin.annualMarks.set(ak, am);

        flag = true;
      }

      // 生成日程
      if (props.description) {
        mark.schedule = { text: props.description, key: props.icskey };
      }

      return flag ? mark : void 0;
    },
    todoScheduleText: props => props.description as string,
    todoScheduleColor: '#e7a23d',
    todoScheduleBgColor: '#faecd8',
    journalScheduleText: props => props.description as string,
    journalScheduleColor: '#67c23a',
    journalScheduleBgColor: '#e1f3d8',
    alarmScheduleText: props => props.description as string,
    alarmScheduleColor: '#f56c6d',
    alarmScheduleBgColor: '#fde2e2',
    afterMarked: function() {
      series = null;
    }
  };
}