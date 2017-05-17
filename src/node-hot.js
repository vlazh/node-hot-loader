#!/usr/bin/env node

import yargs from 'yargs';
import path from 'path';
import fs from 'fs';
import { loader } from './loader';
import packageJson from '../package.json';


const CONFIG_GROUP = 'Config options:';
const options = {};

const argv = yargs
    .usage('Usage: babel-node $0 [args]')
    .help('help')
    .alias('help', 'h')
    .alias('help', '?')
    .version(packageJson.version)
    .alias('version', 'v')
    .options({
      config: {
        type: 'string',
        describe: 'Path to the config file',
        group: CONFIG_GROUP,
        defaultDescription: 'webpack.config.js or webpackfile.js',
        requiresArg: false,
      },
    })
    .alias('config', 'c')
    .example('babel-node node-hot --config webpack.config.js', 'Using a specific webpack config file.')
    .example('babel-node node-hot', 'Using default webpack config file.')
    .showHelpOnFail(false, 'Use the --help option to get the list of available options.')
    .check((args) => {
      if (args.config) {
        const configPath = path.join(process.cwd(), args.config);
        if (!fs.existsSync(configPath)) { throw new Error(`Webpack config file ${configPath} not found!`); }
        options.webpackConfig = configPath;
      }
      return true;
    })
    .strict()
    .argv;

loader(options);
