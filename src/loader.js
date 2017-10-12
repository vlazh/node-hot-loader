import webpack from 'webpack';
import path from 'path';

/**
 * Add hmrClient to all entries.
 * @param module
 * @returns {Promise.<config>}
 */
function tweakWebpackConfig(module) {
  const { default: webpackConfig = module } = module;

  const config = Array.isArray(webpackConfig)
    ? webpackConfig.find(c => c.target === 'node')
    : webpackConfig;

  if (!config) {
    throw new Error(
      'Not found webpack configuration. For multiple configurations in single file you must provide config with target "node".',
    );
  }

  const hmrClientEntry = path.resolve(process.cwd(), 'node_modules/node-hot-loader/lib/HmrClient');

  const addHmrClientEntry = (entry, owner) => {
    if (Array.isArray(owner[entry])) owner[entry].splice(-1, 0, hmrClientEntry);
    else if (typeof owner[entry] === 'string') owner[entry] = [hmrClientEntry, owner[entry]];
    else if (typeof owner[entry] === 'function') {
      // Call function and try again with function result.
      owner[entry] = owner[entry]();
      addHmrClientEntry(entry, owner);
    } else if (typeof owner[entry] === 'object') {
      Object.getOwnPropertyNames(owner[entry]).forEach(name =>
        addHmrClientEntry(name, owner[entry]),
      );
    }
  };

  // Add HmrClient to every entries.
  addHmrClientEntry('entry', config);

  if (!config.plugins) {
    config.plugins = [];
  }

  // Add source-map support if configured.
  if (config.devtool && config.devtool.indexOf('source-map') >= 0) {
    config.plugins.push(
      new webpack.BannerPlugin({
        banner: `;require('${require
          .resolve('source-map-support')
          .replace(/\\/g, '/')}').install();`,
        raw: true,
        entryOnly: false,
      }),
    );
  }

  // Enable HMR globally if not.
  if (!config.plugins.find(p => p instanceof webpack.HotModuleReplacementPlugin)) {
    config.plugins.push(new webpack.HotModuleReplacementPlugin());
  }
  // Prints more readable module names in the console on HMR updates.
  // if (!config.plugins.find(p => p instanceof webpack.NamedModulesPlugin)) {
  // config.plugins.push(new webpack.NamedModulesPlugin());
  // }
  // In order for don't emit files if errors occurred.
  // if (!config.plugins.find(p => p instanceof webpack.NoEmitOnErrorsPlugin)) {
  // config.plugins.push(new webpack.NoEmitOnErrorsPlugin());
  // }

  return config;
}

/**
 * Add compiler hooks and start watching (through compiler) for changes.
 * @param compiler
 * @returns {Promise.<HmrServer>|*}
 */
function hooks(compiler) {
  const context = {
    serverProcess: null,
    stateValid: false, // valid or invalid state
    webpackStats: undefined, // last compiler stats
    options: compiler.options, // options from webpack config
    compiler,
    watching: undefined, // compiler watching by compiler.watch(...)
  };
  return import('./HmrServer').then(({ default: HmrServer }) => new HmrServer(context).run());
}

const defaultOptions = {
  webpackConfig: path.join(process.cwd(), 'webpack.config.js'),
};

export default function loader(options) {
  options = { ...defaultOptions, ...options };
  Promise.resolve()
    .then(config => import('babel-register'))
    .then(() => import(options.webpackConfig))
    .then(module => tweakWebpackConfig(module))
    .then(webpackConfig => webpack(webpackConfig))
    .then(compiler => hooks(compiler))
    .catch(err => console.error(err));
}
