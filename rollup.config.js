/*
 * Copyright 2024 lspriv. All Rights Reserved.
 * Distributed under MIT license.
 * See File LICENSE for detail or copy at https://opensource.org/licenses/MIT
 * @Description: Description
 * @Author: lspriv
 * @LastEditTime: 2024-02-07 19:55:14
 */
import path from 'path';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import alias from '@rollup/plugin-alias';
import typescript from '@rollup/plugin-typescript';
import sourcemaps from 'rollup-plugin-sourcemaps';
import clear from 'rollup-plugin-cleaner';
import size from 'rollup-plugin-filesize';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

import 'colors';

const padding = number => (number < 10 ? `0${number}` : number);
const time = () => {
  const date = new Date();
  return `${padding(date.getHours())}:${padding(date.getMinutes())}:${padding(date.getSeconds())}`;
};

const isDevelop = process.env.NODE_ENV === 'develop';
const DEV_OUTDIR = 'dev/plugins';
const PRO_OUTDIR = 'dist';

const OUTDIR = isDevelop ? DEV_OUTDIR : PRO_OUTDIR;

const TS_OPTS = {
  tsconfig: './tsconfig.json',
  declaration: false
};

!isDevelop && (TS_OPTS.declaration = true) && (TS_OPTS.declarationDir = 'types');

export default {
  input: 'src/index.ts',
  output: [
    {
      file: `${OUTDIR}/ics/index.js`,
      format: 'cjs',
      sourcemap: true
    }
  ],
  plugins: [
    clear({
      targets: [DEV_OUTDIR, PRO_OUTDIR],
      silent: true
    }),
    resolve(),
    commonjs({ include: /node_modules/ }),
    typescript(TS_OPTS),
    alias({
      resolve: ['.js', '.ts'],
      entries: {
        '@': path.resolve(__dirname, 'src')
      }
    }),
    terser({
      compress: {
        drop_console: !isDevelop,
        drop_debugger: true,
        global_defs: {
          $_VERSION: pkg.version
        },
        reduce_funcs: false,
        directives: false
      },
      mangle: {
        toplevel: true
      },
      output: {
        comments: /^!/
      }
    }),
    sourcemaps(),
    size({
      reporter: function (options, bundle, info) {
        return `[${time().grey}] ` + `pack complete`.cyan + ` ${info.fileName.blue} ${info.bundleSize.magenta}`;
      }
    })
  ],
  watch: {
    include: 'src/**',
    skipWrite: false
  }
};
