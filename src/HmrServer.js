import fs from 'fs';
import path from 'path';
import requireFromString from 'require-from-string';
import { fork } from 'child_process';
import LogColors from './LogColors';
import Logger from './Logger';
import { parseLogLevel, LogLevel } from './LogLevel';
import messageActionType from './messageActionType';

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
    /** When started compiled script contains process object in which script running. */
    serverProcess: null,
    /** Valid or invalid state. */
    stateValid: false,
    /** Last compiler stats. */
    /** @type import('webpack').Stats */
    webpackStats: undefined,
    /** Compiler watching by compiler.watch(...). */
    watching: undefined,
    /**
     * Do not use memory-fs because we can't fork bundle from in-memory file.
     */
    fs,
    reporter: HmrServer.defaultReporter,
    logger: new Logger(LogColors.cyan('[HMR]')),
    webpackLogger: new Logger(LogColors.magenta('Webpack')),
    /** @type {import('webpack').Compiler} */
    compiler: undefined,
    fork: false,
    args: undefined,
    inMemory: false,
    logLevel: undefined,
  };

  /**
   * @param {{
   *  compiler: import('webpack').Compiler;
   *  fork?: boolean | string[];
   *  args?: string[];
   *  inMemory?: boolean;
   *  logLevel?: string;
   * }} options
   */
  constructor(options) {
    this.context = { ...this.context, ...options };
    const { compiler, inMemory } = this.context;

    if (inMemory) {
      const getName = () => 'memory-fs';
      const MemoryFileSystem = require(getName());
      this.context.fs = new MemoryFileSystem();
      compiler.outputFileSystem = this.context.fs;
    }

    // if (typeof compiler.outputPath === 'string' && !path.isAbsolute(compiler.outputPath)) {
    //   throw new Error('`output.path` needs to be an absolute path or `/`.');
    // }
  }

  sendMessage = (action) => {
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

  getLauncherFileName = (stats) => {
    const assets = Object.values(stats.toJson().entrypoints).reduce((acc, group) => {
      return acc.concat(
        ...group.assets
          .filter((asset) => /\.[cm]?js$/i.test(asset))
          .map((asset) => path.resolve(stats.compilation.compiler.outputPath, asset))
      );
    }, []);

    if (assets.length === 1) {
      // Only one valid assets, so just return it path
      return assets[0];
    }
    // Create temp launcher file which aggregates all assets.
    const launcherString = assets
      .map((asset) => `require('${asset.replace(/\\/g, '/')}');`)
      .join('\n');

    const launcherFileName = path.resolve(
      stats.compilation.compiler.outputPath,
      `launcher.${stats.hash}.js`
    );
    this.context.fs.writeFileSync(launcherFileName, launcherString);

    // If not launched yet (eg. if not a restart)
    if (!this.context.serverProcess) {
      // Delete created files on exit main process.
      const deleteLauncher = () => this.context.fs.unlinkSync(launcherFileName);
      process.on('exit', deleteLauncher);
      process.on('SIGINT', deleteLauncher);
    }

    return launcherFileName;
  };

  launchAssets = (stats) => {
    const launcherFileName = this.getLauncherFileName(stats);

    // Execute built scripts
    if (this.context.fork) {
      /** @type import('child_process').ForkOptions */
      const options = {
        cwd: process.cwd(),
        env: process.env,
        execArgv: this.context.fork === true ? undefined : this.context.fork,
      };
      if (process.getuid) {
        options.uid = process.getuid();
        options.gid = process.getgid();
      }

      this.context.serverProcess = fork(
        launcherFileName,
        this.context.args || process.argv,
        options
      );
      // Listen for serverProcess events.
      this.context.serverProcess.on('exit', (code) => {
        // Exit node process when exit serverProcess.
        process.exit(code);
      });
      this.context.logger.info('Launch assets in forked process.');
    } else {
      // Require in current process to lauch script.
      Promise.resolve()
        .then(() => {
          if (this.context.inMemory) {
            requireFromString(this.context.fs.readFileSync(launcherFileName).toString());
          } else {
            require(`${launcherFileName}`);
          }
        })
        .then(() => {
          this.context.serverProcess = process;
        })
        .catch((err) => {
          this.context.logger.error(err);
          process.exit();
        });
    }
  };

  compilerStart = () => {
    try {
      this.sendMessage(messageActionType.CompilerStart);

      if (this.context.watching && this.context.stateValid) {
        this.context.reporter({
          stateValid: false,
          context: this.context,
          compilerOptions: this.context.compiler.options,
        });
      }

      // We are now in invalid state
      this.context.stateValid = false;
    } catch (ex) {
      this.context.logger.error(ex);
    }
  };

  /**
   * @param {import('webpack').Stats} stats
   */
  compilerDone = (stats) =>
    new Promise((resolve) => {
      // We are now on valid state
      this.context.stateValid = true;
      this.context.webpackStats = stats;

      // Do the stuff in nextTick, because bundle may be invalidated
      // if a change happened while compiling
      process.nextTick(() => {
        // check if still in valid state
        if (!this.context.stateValid) return;

        // print webpack output
        if (this.context.watching) {
          this.context.reporter({
            stateValid: true,
            stats,
            context: this.context,
            compilerOptions: this.context.compiler.options,
          });
        }

        // Already has launched process
        if (this.context.serverProcess) {
          this.sendMessage(messageActionType.CompilerDone);
        }
        // Start compiled files in child process (fork) or in current process.
        else {
          this.launchAssets(stats);
        }

        resolve();
      });
    }).catch((ex) => {
      this.context.logger.error(ex);
    });

  startWatch = () => {
    const { compiler } = this.context;
    // start watching
    this.context.watching = compiler.watch(compiler.options.watchOptions, (err) => {
      if (err) {
        this.context.logger.error(err.stack || err);
        if (err.details) this.context.logger.error(err.details);
      }
    });
    this.context.logger.info('Waiting webpack...');
  };

  run = (watch = true) => {
    const { compiler } = this.context;
    if (compiler.hooks) {
      // webpack >= 4
      compiler.hooks.invalid.tap('node-hot-loader', this.compilerStart);
      compiler.hooks.done.tapPromise('node-hot-loader', this.compilerDone);
    } else {
      // webpack < 4
      compiler.plugin('invalid', this.compilerStart);
      compiler.plugin('done', this.compilerDone);
    }
    if (watch) {
      this.startWatch();
    }
    return this;
  };
}
