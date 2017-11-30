#!/usr/bin/env node

import yargs from 'yargs';
import path from 'path';
import fs from 'fs';
import loader from './loader';
import packageJson from '../package.json';

const options = {
  config: 'webpack.config.js',
  fork: false,
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
  })
  .example('node-hot --config webpack.config.js', 'Using a specific webpack config file.')
  .example('node-hot', 'Using default webpack config file.')
  .showHelpOnFail(false, 'Use the --help option to get the list of available options.')
  .check(args => {
    if (!fs.existsSync(args.config)) {
      throw new Error(`Webpack config file '${args.config}' not found!`);
    }
    return true;
  })
  .strict().argv;

if (!path.isAbsolute(params.config)) {
  options.config = path.join(process.cwd(), params.config);
}
options.fork = params.fork;

loader(options);
