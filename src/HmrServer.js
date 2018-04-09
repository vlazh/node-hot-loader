import pathIsAbsolute from 'path-is-absolute';
import fs from 'fs';
import path from 'path';
import { fork } from 'child_process';
import LogColors from './LogColors';
import Logger from './Logger';

export default class HmrServer {
  static defaultReporter({ context, stateValid, stats, compilerOptions }) {
    if (!stateValid) {
      context.webpackLogger.info('Compiling...');
      return;
    }

    const displayStats =
      !compilerOptions.quiet &&
      compilerOptions.stats !== false &&
      (stats.hasErrors() || stats.hasWarnings() || !compilerOptions.noInfo);

    if (displayStats) {
      const statsInfo = stats.toString(compilerOptions.stats);
      if (statsInfo) {
        // To avoid log empty statsInfo, e.g. when options.stats is 'errors-only'.
        context.webpackLogger.info(statsInfo);
      }
    }

    if (!compilerOptions.noInfo && !compilerOptions.quiet) {
      if (stats.hasErrors()) {
        context.webpackLogger.error('Failed to compile.');
      } else if (stats.hasWarnings()) {
        context.webpackLogger.warn('Compiled with warnings.');
      }
      context.webpackLogger.info('Compiled successfully.');
    }
  }

  context = {
    /** When started compiled script contain process object in which script running. */
    serverProcess: null,
    /** Valid or invalid state. */
    stateValid: false,
    /** Last compiler stats. */
    webpackStats: undefined,
    /** Compiler watching by compiler.watch(...). */
    watching: undefined,
    /**
     * Don use memory-fs because we can't fork bundle from in-memory file.
     */
    fs,
    reporter: HmrServer.defaultReporter,
    // info: console.log.bind(console),
    // warn: console.warn.bind(console),
    // error: console.error.bind(console),
    logger: new Logger(LogColors.cyan('[HMR]')),
    webpackLogger: new Logger(LogColors.magenta('Webpack')),
    fork: false,
    compiler: undefined,
  };

  constructor(options) {
    this.context = Object.assign(this.context, options);

    const { compiler } = this.context;
    if (
      typeof compiler.outputPath === 'string' &&
      !pathIsAbsolute.posix(compiler.outputPath) &&
      !pathIsAbsolute.win32(compiler.outputPath)
    ) {
      throw new Error('`output.path` needs to be an absolute path or `/`.');
    }
  }

  sendMessage = action => {
    if (!this.context.serverProcess) {
      return;
    }

    if (this.context.fork) {
      this.context.serverProcess.send({
        action,
        stats: this.context.webpackStats.toJson(),
      });
    } else {
      this.context.serverProcess.emit('message', {
        action,
        stats: this.context.webpackStats.toJson(),
      });
    }
  };

  launchAssets = stats => {
    const getLauncherFileName = () => {
      const { assets } = stats.compilation;
      const names = Object.getOwnPropertyNames(assets).filter(
        k => assets[k].emitted && path.extname(assets[k].existsAt) === '.js'
      );

      if (names.length === 1) {
        // Only one valid assets, so just return it path
        return assets[names[0]].existsAt;
      }
      // Create temp launcher file which aggregates all assets.
      const launcherString = names
        .map(k => `require('${assets[k].existsAt.replace(/\\/g, '/')}');`)
        .join('\n');

      const launcherFileName = path.resolve(
        stats.compilation.compiler.outputPath,
        `launcher.${stats.hash}.js`
      );
      this.context.fs.writeFileSync(launcherFileName, launcherString);

      // Delete created files on exit main process.
      process.on('exit', () => {
        this.context.fs.unlinkSync(launcherFileName);
      });
      process.on('SIGINT', () => {
        this.context.fs.unlinkSync(launcherFileName);
      });

      return launcherFileName;
    };

    // Execute built scripts
    if (this.context.fork) {
      const options = {
        cwd: process.cwd(),
        env: process.env,
      };
      if (process.getuid) {
        options.uid = process.getuid();
        options.gid = process.getgid();
      }
      this.context.serverProcess = fork(getLauncherFileName(), process.argv, options);
      // Listen for serverProcess events.
      this.context.serverProcess.on('exit', code => {
        // Exit node process when exit serverProcess.
        process.exit(code);
      });
      this.context.logger.info('Launch assets in forked process.');
    } else {
      // Require in current process to lauch script.
      import(getLauncherFileName())
        .then(() => {
          this.context.serverProcess = process;
        })
        .catch(err => {
          this.context.logger.error(err);
          process.exit();
        });
    }
  };

  compilerDone = stats => {
    // We are now on valid state
    this.context.stateValid = true;
    this.context.webpackStats = stats;

    // Do the stuff in nextTick, because bundle may be invalidated
    // if a change happened while compiling
    process.nextTick(() => {
      // check if still in valid state
      if (!this.context.stateValid) return;

      // print webpack output
      this.context.reporter({
        stateValid: true,
        stats,
        context: this.context,
        compilerOptions: this.context.compiler.options,
      });

      if (this.context.serverProcess) {
        this.sendMessage('built');
      } else {
        // Start compiled files in child process (fork) or in current process.
        this.launchAssets(stats);
      }
    });
  };

  compilerInvalid = () => {
    this.sendMessage('compile');

    if (
      this.context.stateValid &&
      (!this.context.compiler.options.noInfo && !this.context.compiler.options.quiet)
    ) {
      this.context.reporter({
        stateValid: false,
        context: this.context,
        compilerOptions: this.context.compiler.options,
      });
    }

    // We are now in invalid state
    this.context.stateValid = false;
    // resolve async
    if (arguments.length === 2 && typeof arguments[1] === 'function') {
      const callback = arguments[1];
      callback();
    }
  };

  compilerWatch = err => {
    if (err) {
      this.context.logger.error(err.stack || err);
      if (err.details) this.context.logger.error(err.details);
    }
  };

  startWatch = () => {
    const { compiler } = this.context;
    // start watching
    this.context.watching = compiler.watch(compiler.options.watchOptions, this.compilerWatch);
    this.context.logger.info('Waiting webpack...');
  };

  run = () => {
    const { compiler } = this.context;
    if (compiler.hooks) {
      // webpack >= 4
      compiler.hooks.done.tap('CompilerDone', this.compilerDone);
      compiler.hooks.compile.tap('ComplierInvalid', this.compilerInvalid);
    } else {
      // webpack < 4
      compiler.plugin('done', this.compilerInvalid);
      compiler.plugin('compile', this.compilerInvalid);
    }
    this.startWatch();
    return this;
  };
}
