/* globals __webpack_hash__ */

import LogColors from './LogColors';
import Logger from './Logger';
import { LogLevel } from './LogLevel';
import messageActionType from './messageActionType';

export class HmrClient {
  logger = new Logger(LogColors.cyan('[HMR]'));

  lastHash = '';

  sendRestartMessage = () => {
    // If forked process
    if (process.send) {
      const message = { action: messageActionType.RestartRequired };
      process.send(message);
    }
  };

  logApplyResult = (logLevel, outdatedModules, renewedModules) => {
    const unacceptedModules =
      !renewedModules || !renewedModules.length
        ? outdatedModules
        : outdatedModules.filter((moduleId) => renewedModules.indexOf(moduleId) < 0);

    if (unacceptedModules.length > 0 && logLevel >= LogLevel.ERRORS) {
      this.logger.warn(
        "The following modules couldn't be hot updated: (They would need to restart the application!)"
      );
      unacceptedModules.forEach((moduleId) => {
        this.logger.warn(` - ${moduleId}`);
      });
      this.sendRestartMessage();
    }

    if (!renewedModules || !renewedModules.length) {
      if (logLevel >= LogLevel.MINIMAL) {
        this.logger.info('Nothing hot updated.');
      }
      return;
    }

    if (logLevel >= LogLevel.NORMAL) {
      this.logger.info('Updated modules:');
      renewedModules.forEach((moduleId) => {
        this.logger.info(` - ${moduleId}`);
      });
      const numberIds = renewedModules.every((moduleId) => typeof moduleId === 'number');
      if (numberIds) {
        this.logger.info('Consider using the NamedModulesPlugin for module names.');
      }
    }

    if (this.isUpToDate()) {
      this.logUpToDate(logLevel);
    }
  };

  logUpToDate = (logLevel) => {
    if (logLevel >= LogLevel.MINIMAL) {
      this.logger.info('App is up to date.');
    }
  };

  defaultMessageListener = ({ action, stats, logLevel }) => {
    // webpackHotUpdate
    if (action !== messageActionType.CompilerDone) {
      return;
    }

    this.lastHash = stats.hash;

    if (!this.isUpToDate()) {
      const status = module.hot.status();

      if (status === 'idle') {
        if (logLevel >= LogLevel.MINIMAL) {
          this.logger.info('Checking for updates...');
        }
        this.checkAndApplyUpdates(logLevel);
      } else if (['abort', 'fail'].indexOf(status) >= 0) {
        if (logLevel >= LogLevel.ERRORS) {
          this.logger.warn(
            `Cannot apply update as a previous update ${status}ed. You need to restart the application!`
          );
        }
        this.sendRestartMessage();
      }
    } else {
      this.logUpToDate(logLevel);
    }
  };

  isUpToDate = () => this.lastHash.indexOf(__webpack_hash__) >= 0;

  checkAndApplyUpdates = (logLevel) => {
    module.hot
      .check()
      .then((outdatedModules) => {
        if (!outdatedModules) {
          if (logLevel >= LogLevel.ERRORS) {
            this.logger.warn('Cannot find update. You need to restart the application!');
          }
          return Promise.resolve();
        }

        return module.hot
          .apply({
            ignoreUnaccepted: true,
            ignoreDeclined: true,
            ignoreErrored: true, // true - allows to restore state after errors.
            onUnaccepted: (info) => {
              if (logLevel >= LogLevel.ERRORS) {
                this.logger.warn(
                  `Ignored an update to unaccepted module ${info.chain.join(' -> ')}`
                );
              }
            },
            onDeclined: (info) => {
              if (logLevel >= LogLevel.ERRORS) {
                this.logger.warn(`Ignored an update to declined module ${info.chain.join(' -> ')}`);
              }
            },
            onErrored: (info) => {
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
          .then((renewedModules) => {
            if (!this.isUpToDate()) {
              this.checkAndApplyUpdates(logLevel);
            }

            this.logApplyResult(logLevel, outdatedModules, renewedModules);
          });
      })
      .catch((err) => {
        if (['abort', 'fail'].indexOf(module.hot.status()) >= 0) {
          if (logLevel >= LogLevel.ERRORS) {
            this.logger.error('Cannot check for updates. You need to restart the application!');
            this.logger.error(err.stack || err.message);
          }
          this.sendRestartMessage();
        } else if (logLevel >= LogLevel.ERRORS) {
          this.logger.error(`Check updates failed: ${err.stack}` || err.message);
        }
      });
  };

  run(messageListener = this.defaultMessageListener) {
    if (!module.hot) {
      throw new Error('Hot Module Replacement is disabled.');
    }

    this.logger.info('Waiting for update signal from webpack...');
    process.on('message', messageListener);
    return this;
  }
}

export default new HmrClient().run();
