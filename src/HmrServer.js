import pathIsAbsolute from 'path-is-absolute';
import fs from 'fs';
import { fork } from 'child_process';
import LogColors from './LogColors';


class HmrServer {

  static defaultReporter(reporterOptions) {
    const { state, stats, options } = reporterOptions;

    if (state) {
      let displayStats = (!options.quiet && options.stats !== false);
      if (displayStats && !(stats.hasErrors() || stats.hasWarnings()) && options.noInfo) {
        displayStats = false;
      }
      if (displayStats) {
        options.log(stats.toString(options.stats));
      }
      if (!options.noInfo && !options.quiet) {
        let msg = 'Compiled successfully.';
        if (stats.hasErrors()) {
          msg = 'Failed to compile.';
        } else if (stats.hasWarnings()) {
          msg = 'Compiled with warnings.';
        }
        options.log(`${LogColors.magenta('Webpack')}: ${msg}`);
      }
    } else {
      options.log(`${LogColors.magenta('Webpack')}: Compiling...`);
    }
  }

  constructor(context) {
    this.context = Object.assign({}, context);
    const options = context.options || {};
    if (typeof options.watchOptions === 'undefined') options.watchOptions = {};
    if (typeof options.reporter !== 'function') options.reporter = HmrServer.defaultReporter;
    if (typeof options.log !== 'function') options.log = console.log.bind(console);
    if (typeof options.warn !== 'function') options.warn = console.warn.bind(console);
    if (typeof options.error !== 'function') options.error = console.error.bind(console);
    if (typeof options.watchOptions.aggregateTimeout === 'undefined') options.watchOptions.aggregateTimeout = 200;
    if (typeof options.stats === 'undefined') options.stats = {};
    if (!options.stats.context) options.stats.context = process.cwd();
    const compiler = this.context.compiler;
    if (typeof compiler.outputPath === 'string' && !pathIsAbsolute.posix(compiler.outputPath) && !pathIsAbsolute.win32(compiler.outputPath)) {
      throw new Error('`output.path` needs to be an absolute path or `/`.');
    }
    this.context.options = options;
    // Don use memory-fs because we can't fork bundle fom in-memory file.
    this.context.fs = fs;
  }

  sendMessage(action) {
    this.context.serverProcess && this.context.serverProcess.send({
      action,
      stats: this.context.webpackStats.toJson(),
    });
  }

  compilerDone = (stats) => {
    // We are now on valid state
    this.context.state = true;
    this.context.webpackStats = stats;

    // Do the stuff in nextTick, because bundle may be invalidated
    // if a change happened while compiling
    process.nextTick(() => {
      // check if still in valid state
      if (!this.context.state) return;

      // print webpack output
      this.context.options.reporter({
        state: true,
        stats,
        options: this.context.options,
      });

      if (this.context.serverProcess) {
        this.sendMessage('built');
      } else {
        // execute built scripts
        const options = {
          cwd: process.cwd(),
          env: process.env,
        };
        if (process.getuid) {
          options.uid = process.getuid();
          options.gid = process.getgid();
        }
        this.context.serverProcess = fork(stats.compilation.assets['server.js'].existsAt, process.argv, options);
      }
    });
  };

  compilerInvalid = () => {
    this.sendMessage('compile');

    if (this.context.state && (!this.context.options.noInfo && !this.context.options.quiet)) {
      this.context.options.reporter({
        state: false,
        options: this.context.options,
      });
    }

    // We are now in invalid state
    this.context.state = false;
    // resolve async
    if (arguments.length === 2 && typeof arguments[1] === 'function') {
      const callback = arguments[1];
      callback();
    }
  };

  compilerWatch = (err) => {
    if (err) {
      this.context.options.error(err.stack || err);
      if (err.details) this.context.options.error(err.details);
    }
  };

  startWatch() {
    const options = this.context.options;
    const compiler = this.context.compiler;
    // start watching
    this.context.watching = compiler.watch(options.watchOptions, this.compilerWatch);
    console.info(LogColors.cyan('[HMR]'), 'Waiting webpack...');
  }

  run() {
    this.context.compiler.plugin('done', this.compilerDone);
    this.context.compiler.plugin('compile', this.compilerInvalid);
    this.startWatch();
    return this;
  }
}

export default HmrServer;
