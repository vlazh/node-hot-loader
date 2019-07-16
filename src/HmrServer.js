/* eslint-disable global-require, import/no-dynamic-require */
import fs from 'fs';
import path from 'path';
import requireFromString from 'require-from-string';
import { fork } from 'child_process';
import LogColors from './LogColors';
import Logger from './Logger';
import { parseLogLevel, LogLevel } from './LogLevel';

export default class HmrServer {
  static defaultReporter({ context, stateValid, stats, compilerOptions }) {
    // for check log level for webpack compiler only
    const compilerLogLevel = parseLogLevel(compilerOptions.stats);

    if (!stateValid) {
      if (compilerLogLevel >= LogLevel.MINIMAL) {
        context.webpackLogger.info('Compiling...');
      }
      return;
    }

    if (compilerLogLevel > LogLevel.NONE) {
      const statsInfo = stats.toString(compilerOptions.stats);
      if (statsInfo) {
        // To avoid log empty statsInfo, e.g. when options.stats is 'errors-only'.
        context.webpackLogger.info(statsInfo);
      }
    }

    if (compilerLogLevel >= LogLevel.ERRORS) {
      if (stats.hasErrors()) {
        context.webpackLogger.error('Failed to compile.');
      } else if (stats.hasWarnings()) {
        context.webpackLogger.warn('Compiled with warnings.');
      }
    }

    if (compilerLogLevel >= LogLevel.MINIMAL) {
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
    logger: new Logger(LogColors.cyan('[HMR]')),
    webpackLogger: new Logger(LogColors.magenta('Webpack')),
    fork: false,
    inMemory: true,
    compiler: undefined,
    logLevel: undefined,
  };

  constructor(options) {
    this.context = { ...this.context, ...options };
    const { compiler, inMemory } = this.context;

    if (inMemory) {
      const getName = () => 'memory-fs';
      const MemoryFileSystem = require(getName());
      this.context.fs = new MemoryFileSystem();
      compiler.outputFileSystem = this.context.fs;
    }

    if (typeof compiler.outputPath === 'string' && !path.isAbsolute(compiler.outputPath)) {
      throw new Error('`output.path` needs to be an absolute path or `/`.');
    }
  }

  sendMessage = action => {
    if (!this.context.serverProcess) {
      return;
    }

    const logLevel =
      this.context.logLevel != null
        ? parseLogLevel(this.context.logLevel)
        : parseLogLevel(this.context.compiler.options.stats);

    if (this.context.fork) {
      this.context.serverProcess.send({
        action,
        stats: this.context.webpackStats.toJson(),
        logLevel,
      });
    } else {
      this.context.serverProcess.emit('message', {
        action,
        stats: this.context.webpackStats.toJson(),
        logLevel,
      });
    }
  };

  launchAssets = stats => {
    const getLauncherFileName = () => {
      const assets = Object.values(stats.toJson().entrypoints).reduce((acc, group) => {
        return acc.concat(
          ...group.assets.map(asset => path.resolve(stats.compilation.compiler.outputPath, asset))
        );
      }, []);

      if (assets.length === 1) {
        // Only one valid assets, so just return it path
        return assets[0];
      }
      // Create temp launcher file which aggregates all assets.
      const launcherString = assets
        .map(asset => `require('${asset.replace(/\\/g, '/')}');`)
        .join('\n');

      const launcherFileName = path.resolve(
        stats.compilation.compiler.outputPath,
        `launcher.${stats.hash}.js`
      );
      this.context.fs.writeFileSync(launcherFileName, launcherString);

      // Delete created files on exit main process.
      const deleteLauncher = () => this.context.fs.unlinkSync(launcherFileName);
      process.on('exit', deleteLauncher);
      process.on('SIGINT', deleteLauncher);

      return launcherFileName;
    };

    // Execute built scripts
    if (this.context.fork) {
      const options = {
        cwd: process.cwd(),
        env: process.env,
        execArgv: this.context.fork === true ? undefined : this.context.fork,
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
      Promise.resolve()
        .then(() => {
          if (this.context.inMemory) {
            requireFromString(this.context.fs.readFileSync(getLauncherFileName()).toString());
          } else {
            require(`${getLauncherFileName()}`);
          }
        })
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

  compilerInvalid = (_, callback) => {
    this.sendMessage('compile');

    if (this.context.stateValid) {
      this.context.reporter({
        stateValid: false,
        context: this.context,
        compilerOptions: this.context.compiler.options,
      });
    }

    // We are now in invalid state
    this.context.stateValid = false;
    // resolve async
    if (typeof callback === 'function') {
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
