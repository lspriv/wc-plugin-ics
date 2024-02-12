/*
 * Copyright 2024 lspriv. All Rights Reserved.
 * Distributed under MIT license.
 * See File LICENSE for detail or copy at https://opensource.org/licenses/MIT
 * @Description: Description
 * @Author: lspriv
 * @LastEditTime: 2024-02-10 11:19:19
 */
import type { Plugin } from '@lspriv/wx-calendar/lib';
import { parse } from 'ical.js';

console.log('parse', parse);
export interface WC_ICS_OPTS {}

export class ICSPlugin implements Plugin {
  static KEY = 'wc-plugin-ics' as const;

  constructor(options: WC_ICS_OPTS) {
    console.log('ICS_OPTS', options);
  }

  PLUGIN_ON_LOAD() {}
}

export const ICS_PLUGIN_KEY = ICSPlugin.KEY;
