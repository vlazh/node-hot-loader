#!/usr/bin/env node

import yargs from 'yargs';
import path from 'path';
import fs from 'fs';
import loader from './loader';
import packageJson from '../package.json';

const options = {
  webpackConfig: path.join(process.cwd(), 'webpack.config.js'),
};

const _ = yargs
  .usage('Usage: $0 [args]')
  .help('help')
  .alias('help', 'h')
  .alias('help', '?')
  .version(packageJson.version)
  .alias('version', 'v')
  .options({
    config: {
      type: 'string',
      describe: 'Path to the config file',
      group: 'Config options:',
      defaultDescription: 'webpack.config.js',
      requiresArg: false,
    },
  })
  .alias('config', 'c')
  .example('node-hot --config webpack.config.js', 'Using a specific webpack config file.')
  .example('node-hot', 'Using default webpack config file.')
  .showHelpOnFail(false, 'Use the --help option to get the list of available options.')
  .check((args) => {
    if (args.config) {
      options.webpackConfig = path.join(process.cwd(), args.config);
    }
    if (!fs.existsSync(options.webpackConfig)) {
      throw new Error(`Webpack config file '${options.webpackConfig}' not found!`);
    }
    return true;
  })
  .strict().argv;

loader(options);
