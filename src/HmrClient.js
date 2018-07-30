import LogColors from './LogColors';
import Logger from './Logger';
import { LogLevel } from './LogLevel';

/* globals __webpack_hash__ */

export class HmrClient {
  logger = new Logger(LogColors.cyan('[HMR]'));

  logApplyResult = (logLevel, outdatedModules, renewedModules) => {
    const unacceptedModules =
      !renewedModules || !renewedModules.length
        ? outdatedModules
        : outdatedModules.filter(moduleId => renewedModules.indexOf(moduleId) < 0);

    if (unacceptedModules.length > 0 && logLevel >= LogLevel.ERRORS) {
      this.logger.warn(
        "The following modules couldn't be hot updated: (They would need restart the server!)"
      );
      unacceptedModules.forEach(moduleId => {
        this.logger.warn(` - ${moduleId}`);
      });
    }

    if (!renewedModules || !renewedModules.length) {
      if (logLevel >= LogLevel.MINIMAL) {
        this.logger.info('Nothing hot updated.');
      }
      return;
    }

    if (logLevel >= LogLevel.NORMAL) {
      this.logger.info('Updated modules:');
      renewedModules.forEach(moduleId => {
        this.logger.info(` - ${moduleId}`);
      });
      const numberIds = renewedModules.every(moduleId => typeof moduleId === 'number');
      if (numberIds) {
        this.logger.info('Consider using the NamedModulesPlugin for module names.');
      }
    }

    if (this.upToDate()) {
      this.logUpToDate(logLevel);
    }
  };

  logUpToDate = logLevel => {
    if (logLevel >= LogLevel.MINIMAL) {
      this.logger.info('App is up to date.');
    }
  };

  defaultListener = message => {
    // webpackHotUpdate
    if (message.action !== 'built') {
      return;
    }

    this.lastHash = message.stats.hash;
    const { logLevel } = message;

    if (!this.upToDate()) {
      const status = module.hot.status();

      if (status === 'idle') {
        if (logLevel >= LogLevel.MINIMAL) {
          this.logger.info('Checking for updates...');
        }
        this.check(logLevel);
      } else if (['abort', 'fail'].indexOf(status) >= 0 && logLevel >= LogLevel.ERRORS) {
        this.logger.warn(
          `Cannot apply update as a previous update ${status}ed. Need to do restart the server!`
        );
      }
    } else {
      this.logUpToDate(logLevel);
    }
  };

  upToDate = () => this.lastHash.indexOf(__webpack_hash__) >= 0;

  check = logLevel => {
    module.hot
      .check()
      .then(outdatedModules => {
        if (!outdatedModules) {
          if (logLevel >= LogLevel.ERRORS) {
            this.logger.warn('Cannot find update. Need to do restart the server!');
          }
          return Promise.resolve();
        }

        return module.hot
          .apply({
            ignoreUnaccepted: true,
            ignoreDeclined: true,
            ignoreErrored: true, // true allows to restore state after errors.
            onUnaccepted: info => {
              if (logLevel >= LogLevel.ERRORS) {
                this.logger.warn(
                  `Ignored an update to unaccepted module ${info.chain.join(' -> ')}`
                );
              }
            },
            onDeclined: info => {
              if (logLevel >= LogLevel.ERRORS) {
                this.logger.warn(`Ignored an update to declined module ${info.chain.join(' -> ')}`);
              }
            },
            onErrored: info => {
              if (logLevel >= LogLevel.ERRORS) {
                this.logger.warn(
                  `Ignored an error while updating module ${info.moduleId} (${info.type})`
                );
                // If ignoreErrored is true and throw info.error then module.hot.status() always
                // equals 'apply' and module.hot.check() will not work.
                this.logger.error(info.error);
              }
            },
          })
          .then(renewedModules => {
            if (!this.upToDate()) {
              this.check(logLevel);
            }

            this.logApplyResult(logLevel, outdatedModules, renewedModules);
          });
      })
      .catch(err => {
        if (logLevel >= LogLevel.ERRORS) {
          const status = module.hot.status();
          if (['abort', 'fail'].indexOf(status) >= 0) {
            this.logger.error('Cannot check for update. Need to do restart the server!');
            this.logger.error(err.stack || err.message);
          } else {
            this.logger.error(`Update check failed: ${err.stack}` || err.message);
          }
        }
      });
  };

  run(listener = this.defaultListener) {
    if (!module.hot) {
      throw new Error('Hot Module Replacement is disabled.');
    }

    this.logger.info('Waiting for update signal from webpack...');
    process.on('message', listener);
    return this;
  }
}

export default new HmrClient().run();
