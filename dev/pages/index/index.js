/*
 * @Description: Description
 * @Author: lishen
 * @Date: 2023-08-31 16:46:44
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2024-02-19 21:34:48
 */
const { WxCalendar } = require('@lspriv/wx-calendar/lib');
const { ICSPlugin, ICS_PLUGIN_KEY, ICSCnPreset } = require('../../plugins/wc-plugin-ics/index');

WxCalendar.use(ICSPlugin, ICSCnPreset);

Page({
  data: {
    padding: 0
  },
  onLoad() {
    const { bottom } = wx.getMenuButtonBoundingClientRect();
    this.setData({
      padding: bottom
    });
  },
  handleLoad() {
    const calendar = this.selectComponent('#calendar');
    /** @type {ICSPlugin} */
    const ics = calendar.getPlugin(ICS_PLUGIN_KEY);
    ics.load({ source: 'https://gitee.com/leePix/resource/raw/master/ical/holiday.ics' });
    console.log('calendar-load', calendar);
  },
  handleChange({ detail }) {
    console.log('calendar-date-change', detail);
  },
  handleViewChange({ detail }) {
    console.log('calendar-view-change', detail);
  }
});
