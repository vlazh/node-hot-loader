import LogColors from './LogColors';
import Logger from './Logger';

/* globals __webpack_hash__ */

export class HmrClient {
  logger = new Logger(LogColors.cyan('[HMR]'));

  logApplyResult = (updatedModules, renewedModules) => {
    const unacceptedModules = updatedModules.filter(
      moduleId => renewedModules && renewedModules.indexOf(moduleId) < 0,
    );

    if (unacceptedModules.length > 0) {
      this.logger.warn(
        "The following modules couldn't be hot updated: (They would need a full reload!)",
      );
      unacceptedModules.forEach(moduleId => {
        this.logger.warn(` - ${moduleId}`);
      });
    }

    if (!renewedModules || renewedModules.length === 0) {
      this.logger.log('Nothing hot updated.');
    } else {
      this.logger.log('Updated modules:');
      renewedModules.forEach(moduleId => {
        this.logger.log(` - ${moduleId}`);
      });
      const numberIds = renewedModules.every(moduleId => typeof moduleId === 'number');
      if (numberIds) {
        this.logger.log('Consider using the NamedModulesPlugin for module names.');
      }
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
        this.logger.log('Checking for updates...');
        this.check();
      } else if (['abort', 'fail'].indexOf(status) >= 0) {
        this.logger.warn(
          `Cannot apply update as a previous update ${status}ed. Need to do a full reload!`,
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
          this.logger.warn('Cannot find update. Need to do a full reload!');
          // this.logger.warn( '(Probably because of restarting the server)');
          return null;
        }

        return module.hot
          .apply({
            ignoreUnaccepted: true,
            ignoreDeclined: true,
            ignoreErrored: true,
            onUnaccepted(data) {
              this.logger.warn(`Ignored an update to unaccepted module ${data.chain.join(' -> ')}`);
            },
            onDeclined(data) {
              this.logger.warn(`Ignored an update to declined module ${data.chain.join(' -> ')}`);
            },
            onErrored(data) {
              this.logger.warn(
                `Ignored an error while updating module ${data.moduleId} (${data.type})`,
              );
            },
          })
          .then(renewedModules => {
            if (!this.upToDate()) {
              this.check();
            }

            this.logApplyResult(updatedModules, renewedModules);

            if (this.upToDate()) {
              this.logger.log('App is up to date.');
            }
          });
      })
      .catch(err => {
        const status = module.hot.status();
        if (['abort', 'fail'].indexOf(status) >= 0) {
          this.logger.warn('Cannot check for update. Need to do a full reload!');
          this.logger.warn(err.stack || err.message);
        } else {
          this.logger.warn(`Update check failed: ${err.stack}` || err.message);
        }
      });
  };

  run(listener = this.defaultListener) {
    if (!module.hot) {
      throw new Error('Hot Module Replacement is disabled.');
    }

    this.logger.log('Waiting for update signal from webpack...');
    process.on('message', listener);
    return this;
  }
}

export default new HmrClient().run();
