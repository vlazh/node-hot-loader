#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import yargs from 'yargs';
import { loadWebpack } from './loader';

const options = {
  config: 'webpack.config.js',
  fork: undefined,
  args: undefined,
  autoRestart: undefined,
  inMemory: undefined,
  babel: true,
  logLevel: undefined,
};

const params = yargs
  .config(options)
  .usage('Usage: $0 [args]')
  .help('help')
  .alias('help', 'h')
  .alias('help', '?')
  .version(process.env.npm_package_version)
  .alias('version', 'v')
  .options({
    config: {
      type: 'string',
      describe: 'Path to the webpack config file',
      defaultDescription: 'webpack.config.js',
      requiresArg: false,
      coerce: (value) => {
        if (!path.isAbsolute(value)) {
          return path.join(process.cwd(), value);
        }
        return value;
      },
    },
    fork: {
      type: 'string',
      describe: 'Launch compiled assets in forked process with optional node exec arguments.',
      defaultDescription: 'false',
      requiresArg: false,
      coerce: (value) => {
        if (value === undefined) return false;
        if (value.length === 0) return true;
        return value.split(',');
      },
    },
    args: {
      type: 'string',
      describe: 'List of arguments for forked process.',
      requiresArg: false,
      coerce: (value) => {
        if (value === undefined) return undefined;
        if (value.length === 0) return [];
        return value.split(',');
      },
    },
    autoRestart: {
      type: 'boolean',
      describe: 'Auto restart forked process if unaccepted modules discovered.',
      defaultDescription: 'false',
      requiresArg: false,
    },
    inMemory: {
      type: 'boolean',
      describe: 'Launch compiled assets in memory fs. Not worked with forked process.',
      defaultDescription: 'true',
      requiresArg: false,
    },
    babel: {
      type: 'boolean',
      describe: 'Use "@babel/register".',
      defaultDescription: 'true',
      requiresArg: false,
      coerce: (value) => {
        if (value === '') return true;
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
      },
    },
    logLevel: {
      type: 'string',
      describe:
        'Log level related to webpack stats configuration presets names. See presets from https://webpack.js.org/configuration/stats/#stats.',
      requiresArg: false,
      coerce: (value) => {
        if (value === '') return true;
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
      },
    },
  })
  .example('node-hot --config webpack.config.js', 'Using a specific webpack config file.')
  .example('node-hot', 'Using default webpack config file.')
  .example('node-hot --logLevel minimal', 'Set a specific logLevel for node-hot-loader.')
  .example('node-hot --fork', 'Launch compiled assets in forked process.')
  .example(
    'node-hot --fork=--arg1,--arg2',
    'Launch compiled assets in forked process with passing node exec arguments.'
  )
  .example(
    'node-hot --args=--arg1,--arg2',
    'Pass arguments to forked process. Available in process.argv.'
  )
  .showHelpOnFail(false, 'Use the --help option to get the list of available options.')
  .check((args) => {
    if (!fs.existsSync(args.config)) {
      throw new Error(`Webpack config file '${args.config}' not found!`);
    }
    return true;
  })
  .strict().argv;

options.config = params.config;
options.fork = params.fork;
options.args = params.args;
options.autoRestart = params.autoRestart && options.fork;
options.inMemory = params.inMemory && !options.fork;
options.babel = params.babel;
options.logLevel = params.logLevel;

loadWebpack(options);
