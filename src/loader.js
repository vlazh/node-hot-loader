import webpack from 'webpack';

function handleFunction(options) {
  if (typeof options === 'function') {
    return options();
  }
  return options;
}

function handleWebpackConfig(webpackConfig) {
  return Array.isArray(webpackConfig)
    ? webpackConfig.map(handleFunction).find((c) => c.target === 'node')
    : handleFunction(webpackConfig);
}

/**
 * Add hmrClient to all entries.
 * @param {import('webpack').Configuration} webpackConfig
 * @returns {import('webpack').Configuration}
 */
export function tweakWebpackConfig(webpackConfig) {
  const config = handleWebpackConfig(webpackConfig);

  if (!config) {
    throw new Error(
      'Not found webpack configuration. For multiple configurations in single file you must provide config with target "node".'
    );
  }

  const hmrClientEntry = require.resolve('./HmrClient');

  const addHmrClientEntry = (entry, entryOwner) => {
    const owner = entryOwner;
    if (Array.isArray(owner[entry])) {
      owner[entry].splice(-1, 0, hmrClientEntry);
    } else if (typeof owner[entry] === 'string') {
      owner[entry] = [hmrClientEntry, owner[entry]];
    } else if (typeof owner[entry] === 'function') {
      // Call function and try again with function result.
      owner[entry] = owner[entry]();
      addHmrClientEntry(entry, owner);
    } else if (typeof owner[entry] === 'object') {
      Object.getOwnPropertyNames(owner[entry]).forEach((name) =>
        addHmrClientEntry(name, owner[entry])
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
      })
    );
  }

  // Enable HMR globally if not.
  if (!config.plugins.find((p) => p instanceof webpack.HotModuleReplacementPlugin)) {
    config.plugins.push(new webpack.HotModuleReplacementPlugin());
  }

  return config;
}

/**
 * Add compiler hooks and start watching (through compiler) for changes.
 * @returns {Promise.<HmrServer>}
 */
function hooks(compiler, options) {
  return Promise.resolve()
    .then(() => require('./HmrServer'))
    .then(({ default: HmrServer }) =>
      new HmrServer({
        ...options,
        compiler, // webpack compiler
      }).run()
    );
}

/**
 * @param {{ fork: boolean | string; inMemory: boolean; logLevel: string; }} options
 */
export default function loader(options) {
  Promise.resolve()
    .then(() =>
      require('@babel/register')({
        extensions: ['.es6', '.es', '.jsx', '.js', '.mjs', '.ts', '.tsx'],
      })
    )
    .then(() => require(`${options.config}`))
    .then((configModule) => tweakWebpackConfig(configModule.default || configModule))
    .then((webpackConfig) => webpack(webpackConfig))
    .then((compiler) => hooks(compiler, options))
    .catch((err) => console.error(err));
}
