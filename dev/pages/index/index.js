/*
 * @Description: Description
 * @Author: lishen
 * @Date: 2023-08-31 16:46:44
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2024-02-10 11:50:55
 */
const { WxCalendar } = require('@lspriv/wx-calendar/lib');
const { WcPluginIcs } = require('../../plugins/wc-plugin-ics/index');

WxCalendar.use(WcPluginIcs);

wx.downloadFile({
  url: 'https://gitee.com/leePix/resource/raw/master/ical/holiday.ics',
  success: res => {
    console.log('download', res);
    const manager = wx.getFileSystemManager();
    const content = manager.readFileSync(res.tempFilePath, 'utf8');
    console.log('content', content);
  }
});

// const manager = wx.getFileSystemManager();
// const content = manager.readFileSync(`../../assets/holiday.ics`, 'utf8');
// console.log('content', content);
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
    console.log('calendar-load', calendar);
  },
  handleChange({ detail }) {
    console.log('calendar-date-change', detail);
  },
  handleViewChange({ detail }) {
    console.log('calendar-view-change', detail);
  }
});
