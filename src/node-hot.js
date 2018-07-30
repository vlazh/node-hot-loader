#!/usr/bin/env node

import yargs from 'yargs';
import path from 'path';
import fs from 'fs';
import loader from './loader';
import packageJson from '../package.json';

const options = {
  config: 'webpack.config.js',
  fork: false,
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
    },
    fork: {
      type: 'boolean',
      describe: 'Launch compiled assets in forked process',
      defaultDescription: 'false',
      requiresArg: false,
    },
    logLevel: {
      type: 'string',
      describe:
        'Log level related to webpack stats configuration presets names. See presets from https://webpack.js.org/configuration/stats/#stats.',
      requiresArg: false,
    },
  })
  .example('node-hot --config webpack.config.js', 'Using a specific webpack config file.')
  .example('node-hot', 'Using default webpack config file.')
  .example('node-hot --logLevel minimal', 'Set a specific logLevel for node-hot-loader.')
  .showHelpOnFail(false, 'Use the --help option to get the list of available options.')
  .check(args => {
    if (!fs.existsSync(args.config)) {
      throw new Error(`Webpack config file '${args.config}' not found!`);
    }
    return true;
  })
  .coerce('config', value => {
    if (!path.isAbsolute(value)) {
      return path.join(process.cwd(), value);
    }
    return value;
  })
  .coerce('logLevel', value => {
    if (value === '') return true;
    if (value === 'true') return false;
    if (value === 'false') return false;
    return value;
  })
  .strict().argv;

options.config = params.config;
options.fork = params.fork;
options.logLevel = params.logLevel;

loader(options);
