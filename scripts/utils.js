/*
 * Copyright 2024 lspriv. All Rights Reserved.
 * Distributed under MIT license.
 * See File LICENSE for detail or copy at https://opensource.org/licenses/MIT
 * @Description: Description
 * @Author: lspriv
 * @LastEditTime: 2024-02-07 20:01:51
 */
const path = require('path');
const { execSync } = require('child_process');

const CLI_PATH = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const PROJECT_PATH = path.resolve(process.cwd(), 'dev');

const cli = (command, withPrj = false, options = void 0) => {
  options = { ...options, encoding: 'utf-8' };
  const result = execSync(`${CLI_PATH} ${command}${withPrj ? ` --project ${PROJECT_PATH}` : ''}`, options);
  return result && JSON.parse(result);
};

const padding = number => (number < 10 ? `0${number}` : number);
const time = () => {
  const date = new Date();
  return `${padding(date.getHours())}:${padding(date.getMinutes())}:${padding(date.getSeconds())}`;
};

module.exports = {
  CLI_PATH,
  PROJECT_PATH,
  cli,
  time
};
