import LogColors from './LogColors';

/* globals __webpack_hash__ */

const hmrDocsUrl = 'https://webpack.js.org/concepts/hot-module-replacement/';

class HmrClient {
  static logPrefix = LogColors.cyan('[HMR]');

  static logApplyResult(updatedModules, renewedModules) {
    const unacceptedModules = updatedModules.filter(
      moduleId => renewedModules && renewedModules.indexOf(moduleId) < 0,
    );

    if (unacceptedModules.length > 0) {
      console.warn(
        HmrClient.logPrefix,
        "The following modules couldn't be hot updated: (They would need a full reload!)\n" +
          'This is usually because the modules which have changed (and their parents) do not know ' +
          `how to hot reload themselves. See ${hmrDocsUrl} for more details.`,
      );
      unacceptedModules.forEach((moduleId) => {
        console.warn(HmrClient.logPrefix, ` - ${moduleId}`);
      });
    }

    if (!renewedModules || renewedModules.length === 0) {
      console.log(HmrClient.logPrefix, 'Nothing hot updated.');
    } else {
      console.log(HmrClient.logPrefix, 'Updated modules:');
      renewedModules.forEach((moduleId) => {
        console.log(HmrClient.logPrefix, ` - ${moduleId}`);
      });
      const numberIds = renewedModules.every(moduleId => typeof moduleId === 'number');
      if (numberIds) {
        console.log(HmrClient.logPrefix, 'Consider using the NamedModulesPlugin for module names.');
      }
    }

    if (this.upToDate()) {
      console.log(HmrClient.logPrefix, 'App is up to date.');
    }
  }

  defaultListener = (message) => {
    // webpackHotUpdate
    if (message.action === 'built') {
      this.lastHash = message.stats.hash;
      if (!this.upToDate()) {
        const status = module.hot.status();
        if (status === 'idle') {
          console.log(HmrClient.logPrefix, 'Checking for updates on the server...');
          this.check();
        } else if (['abort', 'fail'].indexOf(status) >= 0) {
          console.warn(
            HmrClient.logPrefix,
            `Cannot apply update as a previous update ${status}ed. Need to do a full reload!`,
          );
        }
      }
    }
  };

  upToDate = () => this.lastHash.indexOf(__webpack_hash__) >= 0;

  handleError = (err) => {
    const status = module.hot.status();
    if (['abort', 'fail'].indexOf(status) >= 0) {
      console.warn(HmrClient.logPrefix, 'Cannot check for update. Need to do a full reload!');
      console.warn(HmrClient.logPrefix, err.stack || err.message);
    } else {
      console.warn(HmrClient.logPrefix, `Update check failed: ${err.stack}` || err.message);
    }
  };

  check = () => {
    const cb = (err, updatedModules) => {
      if (err) {
        this.handleError(err);
        return;
      }

      if (!updatedModules) {
        console.warn(HmrClient.logPrefix, 'Cannot find update. Need to do a full reload!');
        console.warn(
          HmrClient.logPrefix,
          '(Probably because of restarting the webpack-dev-server)',
        );
        return;
      }

      const applyCallback = (applyErr, renewedModules) => {
        if (applyErr) {
          this.handleError(applyErr);
          return;
        }

        if (!this.upToDate()) {
          this.check();
        }

        HmrClient.logApplyResult(updatedModules, renewedModules);
      };

      const applyResult = module.hot.apply(
        {
          ignoreUnaccepted: true,
          ignoreDeclined: true,
          ignoreErrored: true,
          onUnaccepted(data) {
            console.warn(`Ignored an update to unaccepted module ${data.chain.join(' -> ')}`);
          },
          onDeclined(data) {
            console.warn(`Ignored an update to declined module ${data.chain.join(' -> ')}`);
          },
          onErrored(data) {
            console.warn(`Ignored an error while updating module ${data.moduleId} (${data.type})`);
          },
        },
        applyCallback,
      );

      // webpack 2 promise
      if (applyResult && applyResult.then) {
        applyResult
          .then(renewedModules => applyCallback(null, renewedModules))
          .catch(applyCallback);
      }
    };

    const result = module.hot.check(false, cb);
    // webpack 2 promise
    if (result && result.then) {
      result.then(updatedModules => cb(null, updatedModules)).catch(cb);
    }
  };

  run(listener = this.defaultListener) {
    if (!module.hot) {
      throw new Error(HmrClient.logPrefix, 'Hot Module Replacement is disabled.');
    }

    console.log(HmrClient.logPrefix, 'Waiting for update signal from WDS...');
    process.on('message', listener);
    return this;
  }
}

export default new HmrClient().run();
