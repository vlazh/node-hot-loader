#!/usr/bin/env node

import yargs from 'yargs';
import path from 'path';
import fs from 'fs';
import loader from './loader';
import packageJson from '../package.json';

const options = {
  config: 'webpack.config.js',
  fork: undefined,
  logLevel: undefined,
};

const params = yargs
  .config(options)
  .usage('Usage: $0 [args]')
  .help('help')
  .alias('help', 'h')
  .alias('help', '?')
  .version(packageJson.version)
  .alias('version', 'v')
  .options({
    config: {
      type: 'string',
      describe: 'Path to the webpack config file',
      defaultDescription: 'webpack.config.js',
      requiresArg: false,
      coerce: value => {
        if (!path.isAbsolute(value)) {
          return path.join(process.cwd(), value);
        }
        return value;
      },
    },
    fork: {
      type: 'string',
      describe: 'Launch compiled assets in forked process with optional node exec arguments. With ',
      defaultDescription: 'false',
      requiresArg: false,
      coerce: value => {
        if (value === undefined) return false;
        if (value.length === 0) return true;
        return value.split(',');
      },
    },
    inMemory: {
      type: 'boolean',
      describe: 'Launch compiled assets in memory fs. Not worked with forked process.',
      defaultDescription: 'true',
      requiresArg: false,
    },
    logLevel: {
      type: 'string',
      describe:
        'Log level related to webpack stats configuration presets names. See presets from https://webpack.js.org/configuration/stats/#stats.',
      requiresArg: false,
      coerce: value => {
        if (value === '') return true;
        if (value === 'true') return false;
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
  .showHelpOnFail(false, 'Use the --help option to get the list of available options.')
  .check(args => {
    if (!fs.existsSync(args.config)) {
      throw new Error(`Webpack config file '${args.config}' not found!`);
    }
    return true;
  })
  .strict().argv;

options.config = params.config;
options.fork = params.fork;
options.inMemory = params.inMemory && !options.fork;
options.logLevel = params.logLevel;

loader(options);
