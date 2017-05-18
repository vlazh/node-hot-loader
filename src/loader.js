import webpack from 'webpack';
import path from 'path';


/**
 * Add hmrClient to all entries.
 * @param module
 * @returns {Promise.<config>}
 */
function tweakWebpackConfig(module) {
  const { default: webpackConfig = module } = module;
  const config = Array.isArray(webpackConfig) ? webpackConfig.find(c => c.target === 'node') : webpackConfig;
  if (config.target !== 'node')
    throw new Error('Webpack configuration file must provide config with target "node".');

  const hmrClientEntry = path.resolve(process.cwd(), 'node_modules/node-hot-loader/lib/HmrClient');

  const addHmrClientEntry = (entry, owner) => {
    if (Array.isArray(owner[entry])) owner[entry].splice(-1, 0, hmrClientEntry);
    else if (typeof owner[entry] === 'string') owner[entry] = [hmrClientEntry, owner[entry]];
    else if (typeof owner[entry] === 'function') {
      // Call function and try again with function result.
      owner[entry] = owner[entry]();
      addHmrClientEntry(entry, owner);
    }
    else if (typeof owner[entry] === 'object')
      Object.getOwnPropertyNames(owner[entry]).forEach(name => addHmrClientEntry(name, owner[entry]));
  };

  addHmrClientEntry('entry', config);

  // Add source-map support.
  if (config.devtool && config.devtool.indexOf('source-map') >= 0) {
    config.plugins.push(new webpack.BannerPlugin({
      banner: `;require('${require.resolve('source-map-support').replace(/\\/g, '/')}').install();`,
      raw: true,
      entryOnly: false
    }));
  }

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
    state: false, // valid or invalid state
    webpackStats: undefined, // last compiler stats
    options: compiler.options, // options from webpack config
    compiler: compiler,
    watching: undefined, // compiler watching by compiler.watch(...)
  };
  return import('./HmrServer').then(({ default: HmrServer }) => new HmrServer(context).run());
}

const defaultOptions = {
  webpackConfig: path.join(process.cwd(), 'webpack.config.js'),
};

function loader(options) {
  options = Object.assign(defaultOptions, options);
  Promise.resolve()
      .then(config => import('babel-register'))
      .then(() => import(options.webpackConfig))
      .then(module => tweakWebpackConfig(module))
      .then(webpackConfig => webpack(webpackConfig))
      .then(compiler => hooks(compiler))
      .catch(err => console.error(err));
}

export { loader };
