/*
 * Copyright 2024 lspriv. All Rights Reserved.
 * Distributed under MIT license.
 * See File LICENSE for detail or copy at https://opensource.org/licenses/MIT
 * @Description: Description
 * @Author: lspriv
 * @LastEditTime: 2024-02-10 11:15:52
 */
declare module 'ical.js' {
  interface Parser {}

  interface Component {}

  interface ICAL {
    parse: Parser;
    Component: Component;
  }

  export const parse: ICAL.parse;
  export const Component: ICAL.Component;

  export default ICAL;
}
