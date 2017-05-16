import webpack from 'webpack';
import path from 'path';


/**
 * Add hmrClient to all entries.
 * @param webpackConfig
 * @returns {*}
 */
function tweakWebpackConfig(webpackConfig) {
  const hmrClientEntry = path.join(process.cwd(), 'hmr/HmrClient');

  const config = Array.isArray(webpackConfig) ? webpackConfig.find(c => c.target === 'node') : webpackConfig;
  if (config.target !== 'node')
    throw new Error('Webpack configuration file must provide config with target "node".');

  const addHmrClientEntry = (entry, owner) => {
    if (Array.isArray(owner[entry])) owner[entry].splice(-1, 0, hmrClientEntry);
    else if (typeof owner[entry] === 'string') owner[entry] = [hmrClientEntry, owner[entry]];
    else if (typeof owner[entry] === 'object')
      Object.getOwnPropertyNames(owner[entry]).forEach(name => addHmrClientEntry(name, owner[entry]));
  };

  addHmrClientEntry('entry', config);

  return config;
}

/**
 * Add compiler hooks and start watching (through compiler) for changes.
 * @param compiler
 * @param options
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
  return import('../hmr/HmrServer').then(({ default: HmrServer }) => new HmrServer(context).run());
}

const defaultOptions = {
  webpackConfig: './webpack.config.js',
};

function loader(options) {
  options = Object.assign(defaultOptions, options);
  Promise.resolve()
      .then(config => import('babel-register'))
      .then(() => import(options.webpackConfig))
      .then(({ default: webpackConfig }) => tweakWebpackConfig(webpackConfig))
      .then(webpackConfig => webpack(webpackConfig))
      .then(compiler => hooks(compiler))
      .catch(err => console.error(err));
}

export { loader };
