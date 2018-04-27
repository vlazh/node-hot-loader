import LogColors from './LogColors';
import Logger from './Logger';

/* globals __webpack_hash__ */

export class HmrClient {
  logger = new Logger(LogColors.cyan('[HMR]'));

  logApplyResult = (updatedModules, renewedModules) => {
    const unacceptedModules =
      !renewedModules || !renewedModules.length
        ? updatedModules
        : updatedModules.filter(moduleId => renewedModules.indexOf(moduleId) < 0);

    if (unacceptedModules.length > 0) {
      this.logger.warn(
        "The following modules couldn't be hot updated: (They would need restart server!)"
      );
      unacceptedModules.forEach(moduleId => {
        this.logger.warn(` - ${moduleId}`);
      });
    }

    if (!renewedModules || !renewedModules.length) {
      this.logger.info('Nothing hot updated.');
      return;
    }

    this.logger.info('Updated modules:');
    renewedModules.forEach(moduleId => {
      this.logger.info(` - ${moduleId}`);
    });
    const numberIds = renewedModules.every(moduleId => typeof moduleId === 'number');
    if (numberIds) {
      this.logger.info('Consider using the NamedModulesPlugin for module names.');
    }

    if (this.upToDate()) {
      this.logger.info('App is up to date.');
    }
  };

  defaultListener = message => {
    // webpackHotUpdate
    if (message.action !== 'built') {
      return;
    }

    this.lastHash = message.stats.hash;

    if (!this.upToDate()) {
      const status = module.hot.status();
      if (status === 'idle') {
        this.logger.info('Checking for updates...');
        this.check();
      } else if (['abort', 'fail'].indexOf(status) >= 0) {
        this.logger.warn(
          `Cannot apply update as a previous update ${status}ed. Need to do restart server!`
        );
      }
    }
  };

  upToDate = () => this.lastHash.indexOf(__webpack_hash__) >= 0;

  check = () => {
    module.hot
      .check()
      .then(updatedModules => {
        if (!updatedModules) {
          this.logger.warn('Cannot find update. Need to do restart server!');
          return null;
        }

        return module.hot
          .apply({
            ignoreUnaccepted: true,
            ignoreDeclined: true,
            ignoreErrored: true,
            onUnaccepted: info => {
              this.logger.warn(`Ignored an update to unaccepted module ${info.chain.join(' -> ')}`);
            },
            onDeclined: info => {
              this.logger.warn(`Ignored an update to declined module ${info.chain.join(' -> ')}`);
            },
            onErrored: info => {
              this.logger.error(
                `Ignored an error while updating module ${info.moduleId} (${info.type})`
              );
              throw info.error; // for log error in catch and not invoke then.
            },
          })
          .then(renewedModules => {
            if (!this.upToDate()) {
              this.check();
            }

            this.logApplyResult(updatedModules, renewedModules);
          });
      })
      .catch(err => {
        const status = module.hot.status();
        if (['abort', 'fail'].indexOf(status) >= 0) {
          this.logger.warn('Cannot check for update. Need to do restart server!');
          this.logger.warn(err.stack || err.message);
        } else {
          this.logger.error(`Update check failed: ${err.stack}` || err.message);
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
