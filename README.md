## Wx Calendar Plugin For ICS Subscription
![NPM Version](https://img.shields.io/npm/v/@lspriv/wc-plugin-ics)
![Static Badge](https://img.shields.io/badge/coverage-later-a9a9a9)
![GitHub License](https://img.shields.io/github/license/lspriv/wc-plugin-ics)

小程序日历 [`wx-calendar`](https://github.com/lspriv/wx-calendar) ICS订阅插件

### 使用
- 小程序基础库 `SDKVersion` >= 3.0.0
- 日历组件 [`wx-calendar`](https://github.com/lspriv/wx-calendar) >= 1.6.0

#### 安装
```bash
npm i @lspriv/wc-plugin-ics -S
```

#### 构建
微信小程序开发工具菜单栏：`工具` --> `构建 npm`
[*官方文档*](https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html#_2-%E6%9E%84%E5%BB%BA-npm)

#### 页面使用
方式一
```javascript
const { WxCalendar } = require('@lspriv/wx-calendar/lib');
const { ICSPlugin } = require('@lspriv/wc-plugin-ics');

// ics插件其他选项请看后面
WxCalendar.use(ICSPlugin, {
  subcribes: [{ source: 'https://***.***.ics' }]
});

Page({
  ...
})
```
方式二
```javascript
const { WxCalendar } = require('@lspriv/wx-calendar/lib');
const { ICSPlugin, ICS_PLUGIN_KEY } = require('@lspriv/wc-plugin-ics');

WxCalendar.use(ICSPlugin);

Page({
  handleCalendarLoad() {
    const calendar = this.selectComponent('#calendar');
    const ics = calendar.getPlugin(ICS_PLUGIN_KEY);
    ics.load('https://***.***.ics');
  }
})
```

### 说明

ics插件解析了ics源中 `vevent` `valarm` `vjournal` `vtodo` 这四种组件的信息并处理加入到日历中去，在默认选项下（即使用插件时没有配置选项），会将这四种组件的信息作为日程schedule加入到日历。

> [!IMPORTANT]
> 一定要将订阅源链接域名配置到小程序后台downloadFile合法域名
> 操作：小程序后台->开发->开发设置->服务器域名->downloadFile合法域名

### 插件预设
ics插件包里内置了一个有关中国节假日订阅的选项预设 `ICSCnPreset`

```javascript
const { WxCalendar } = require('@lspriv/wx-calendar/lib');
const { ICSPlugin, ICS_PLUGIN_KEY, ICSCnPreset } = require('@lspriv/wc-plugin-ics');

// 使用ICSCnPreset预设
WxCalendar.use(ICSPlugin, ICSCnPreset);

Page({
  handleCalendarLoad() {
    const calendar = this.selectComponent('#calendar');
    const ics = calendar.getPlugin(ICS_PLUGIN_KEY);
    ics.load('https://***.***.ics');
  }
})
```
使用这个预设，推荐几个订阅源（后续再寻）

- [`中国节假日补班日历`](https://github.com/lanceliao/china-holiday-calender)
- [`中国节假日放假调休安排日历`](https://github.com/congqiu/ChineseHoliday)

> [!NOTE]
> - ics文件中vevent组件属性summary的值只要是 '节假日 \*\*' （节假日和后面有空格）这种格式，ICSCnPreset预设就可以使用
> - ICSCnPreset预设也有自己的选项配置

### 插件选项

#### 基本选项

[***`subcribes`***](#subcribes) *订阅源*
```typescript
Array<{
  source: string;
  kind?: 'link' | 'file' | 'content'; // 默认 link
  icskey?: string; // 订阅唯一标识符,不传会根据ics源中prodid和 version生成
  calname?: string; // 订阅源名称
  ...COMMON_OPTIONS
}>
```
> [!NOTE]
> `COMMON_OPTIONS` 也包含了 [`Event选项`](#Event选项) [`Alarm选项`](#Alarm选项) [`Todo选项`](#Todo选项) [`Journal选项`](#Journal选项) [`其他选项`](#其他选项) 中的所有选项，即既可以给全局做这些选项配置，也可以单独给某个订阅做这些配置
> 
在处理某个订阅时，这个订阅的 `subcribe选项` 会覆盖掉最外层的选项配置

```javascript
const icsOpts = {
  subcribes: [{
    icskey: 'subs1',
    source: '*****.ics',
    eventFestivalName: props => return 'name1',
    eventFestivalColor: '#000',
    ...
  }],
  eventFestivalName: props => return 'name2',
  eventFestivalColor: '#111',
  ...
};

// 在处理 subs1 这个订阅时，这个订阅的eventFestivalName属性会覆盖掉外层的eventFestivalName
// 处理 subs1 订阅，选项最终如下
{
  icskey: 'subs1',
  source: '*****.ics',
  kind: 'link',
  eventFestivalName: props => return 'name1',
  eventFestivalColor: '#000',
  ...
}
```

#### Event选项
[***`event`***](#event) *处理 vevent 组件*
```typescript
(props: EventComponentProps) => ICSMark | undefined;
```
```typescript
type ICSMark = {
  schedule?: { key: string; text: string; color: string; bgColor: string; };
  corner?: { key: string; text: string; color: string; };
  festival?: { key: string; text: string; color: string; };
};
```
> [!IMPORTANT]
> 当指定了`event`选项，会以`event`选项返回的mark为主，`Event选项` 的其他选项不再执行处理。

[***`eventMarkAs`***](#eventMarkAs) *加入到日历的方式（默认加入到日程schedule）*
```typescript
'schedule' | 'corner' | 'festival' | Array<'schedule' | 'corner' | 'festival'>
// 日程 ｜ 角标 ｜ 节假日
```

[***`eventFestivalName`***](#eventFestivalName) 作为节假日标记时的节假日名
```typescript
(props: EventComponentProps) => string | undefined;
```

[***`eventFestivalColor`***](#eventFestivalColor) 作为节假日标记时的字体颜色
```typescript
string | ((props: EventComponentProps) => string | undefined);
```

[***`eventCornerText`***](#eventCornerText) 作为角标标记时的角标名
```typescript
(props: EventComponentProps) => string | undefined;
```

[***`eventCornerColor`***](#eventCornerColor) 作为角标标记时的字体颜色
```typescript
string | ((props: EventComponentProps) => string | undefined);
```

[***`eventScheduleText`***](#eventScheduleText) 作为日程标记时的日程信息
```typescript
(props: EventComponentProps) => string | undefined;
```

[***`eventScheduleColor`***](#eventScheduleColor) 作为日程标记时的字体颜色
```typescript
string | ((props: EventComponentProps) => string | undefined);
```

[***`eventScheduleBgColor`***](#eventScheduleBgColor) 作为日程标记时的背景颜色
```typescript
string | ((props: EventComponentProps) => string | undefined);
```

#### Alarm选项
[***`alarm`***](#alarm) *处理 valarm 组件*
```typescript
(props: AlarmComponentProps) => ICSMark | undefined;
```
> [!IMPORTANT]
> 当指定了`alarm`选项，会以`alarm`选项返回的mark为主，`Alarm选项` 的其他选项不再执行处理。

[***`alarmMarkAs`***](#alarmMarkAs) *加入到日历的方式（默认加入到日程schedule）*
```typescript
'schedule' | 'corner' | 'festival' | Array<'schedule' | 'corner' | 'festival'>
// 日程 ｜ 角标 ｜ 节假日
```

[***`alarmFestivalName`***](#alarmFestivalName) 作为节假日标记时的节假日名
```typescript
(props: AlarmComponentProps) => string | undefined;
```

[***`alarmFestivalColor`***](#alarmFestivalColor) 作为节假日标记时的字体颜色
```typescript
string | ((props: AlarmComponentProps) => string | undefined);
```

[***`alarmCornerText`***](#alarmCornerText) 作为角标标记时的角标名
```typescript
(props: AlarmComponentProps) => string | undefined;
```

[***`alarmCornerColor`***](#alarmCornerColor) 作为角标标记时的字体颜色
```typescript
string | ((props: AlarmComponentProps) => string | undefined);
```

[***`alarmScheduleText`***](#alarmScheduleText) 作为日程标记时的日程信息
```typescript
(props: AlarmComponentProps) => string | undefined;
```

[***`alarmScheduleColor`***](#alarmScheduleColor) 作为日程标记时的字体颜色
```typescript
string | ((props: AlarmComponentProps) => string | undefined);
```

[***`alarmScheduleBgColor`***](#alarmScheduleBgColor) 作为日程标记时的背景颜色
```typescript
string | ((props: AlarmComponentProps) => string | undefined);
```

#### Todo选项
[***`todo`***](#todo) *处理 valarm 组件*
```typescript
(props: TodoComponentProps) => ICSMark | undefined;
```
> [!IMPORTANT]
> 当指定了`todo`选项，会以`todo`选项返回的mark为主，`Todo选项` 的其他选项不再执行处理。

[***`todoMarkAs`***](#todoMarkAs) *加入到日历的方式（默认加入到日程schedule）*
```typescript
'schedule' | 'corner' | 'festival' | Array<'schedule' | 'corner' | 'festival'>
// 日程 ｜ 角标 ｜ 节假日
```

[***`todoFestivalName`***](#todoFestivalName) 作为节假日标记时的节假日名
```typescript
(props: TodoComponentProps) => string | undefined;
```

[***`todoFestivalColor`***](#todoFestivalColor) 作为节假日标记时的字体颜色
```typescript
string | ((props: TodoComponentProps) => string | undefined);
```

[***`todoCornerText`***](#todoCornerText) 作为角标标记时的角标名
```typescript
(props: TodoComponentProps) => string | undefined;
```

[***`todoCornerColor`***](#todoCornerColor) 作为角标标记时的字体颜色
```typescript
string | ((props: TodoComponentProps) => string | undefined);
```

[***`todoScheduleText`***](#todoScheduleText) 作为日程标记时的日程信息
```typescript
(props: TodoComponentProps) => string | undefined;
```

[***`todoScheduleColor`***](#todoScheduleColor) 作为日程标记时的字体颜色
```typescript
string | ((props: TodoComponentProps) => string | undefined);
```

[***`todoScheduleBgColor`***](#todoScheduleBgColor) 作为日程标记时的背景颜色
```typescript
string | ((props: TodoComponentProps) => string | undefined);
```
#### Journal选项
[***`journal`***](#journal) *处理 vjournal 组件*
```typescript
(props: JournalComponentProps) => ICSMark | undefined;
```
> [!IMPORTANT]
> 当指定了`journal`选项，会以`journal`选项返回的mark为主，`Journal选项` 的其他选项不再执行处理。

[***`journalMarkAs`***](#journalMarkAs) *加入到日历的方式（默认加入到日程schedule）*
```typescript
'schedule' | 'corner' | 'festival' | Array<'schedule' | 'corner' | 'festival'>
// 日程 ｜ 角标 ｜ 节假日
```

[***`journalFestivalName`***](#journalFestivalName) 作为节假日标记时的节假日名
```typescript
(props: JournalComponentProps) => string | undefined;
```

[***`journalFestivalColor`***](#journalFestivalColor) 作为节假日标记时的字体颜色
```typescript
string | ((props: JournalComponentProps) => string | undefined);
```

[***`journalCornerText`***](#journalCornerText) 作为角标标记时的角标名
```typescript
(props: JournalComponentProps) => string | undefined;
```

[***`journalCornerColor`***](#journalCornerColor) 作为角标标记时的字体颜色
```typescript
string | ((props: JournalComponentProps) => string | undefined);
```

[***`journalScheduleText`***](#journalScheduleText) 作为日程标记时的日程信息
```typescript
(props: JournalComponentProps) => string | undefined;
```

[***`journalScheduleColor`***](#journalScheduleColor) 作为日程标记时的字体颜色
```typescript
string | ((props: JournalComponentProps) => string | undefined);
```

[***`journalScheduleBgColor`***](#journalScheduleBgColor) 作为日程标记时的背景颜色
```typescript
string | ((props: JournalComponentProps) => string | undefined);
```
#### 其他选项
[***`parseDate`***](#parseDate) 解析日期
```typescript
(props: ComponentProps) => CalendarDay;
```
```typescript
type CalendarDay = {
  year: number;
  month: number;
  day: number;
};
```

[***`collectAnuualMark`***](#collectAnuualMark) 收集年度面板的标记
```typescript
(props: ComponentProps) => WcAnnualMark;
```
```typescript
type WcAnnualMark = {
  rwtype?: 'rest' | 'work'; // 工作日还是休息日
  sub?: string; // 下标颜色
};
```

[***`afterMarked`***](#afterMarked) 订阅处理完成后执行
```typescript
(options: ICSSubcribeOpts, plugin: ICSPlugin) => void;
// ICSSubcribeOpts就是 这个订阅的subscribe选项
```
### 关于

>     有任何问题或是需求请到 `Issues` 面板提交
>     忙的时候还请见谅
>     有兴趣开发维护的道友加微信

![wx_qr](https://chat.qilianyun.net/static/git/calendar/wx.png)

