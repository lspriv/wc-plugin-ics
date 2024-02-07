/*
 * Copyright 2024 lspriv. All Rights Reserved.
 * Distributed under MIT license.
 * See File LICENSE for detail or copy at https://opensource.org/licenses/MIT
 * @Description: Description
 * @Author: lspriv
 * @LastEditTime: 2024-02-07 20:21:39
 */
import { Plugin } from '@lspriv/wx-calendar';

export interface WC_ICS_OPTS {
  a: number;
  b: number;
}

export class ICSPlugin implements Plugin {
  static KEY = 'wc-plugin-ics' as const;

  constructor(options: WC_ICS_OPTS) {
    console.log('ICS_OPTS', options);
  }
}

export const ICS_PLUGIN_KEY = ICSPlugin.KEY;
