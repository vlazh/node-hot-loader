# Node Hot Loader [![npm package](https://img.shields.io/npm/v/node-hot-loader.svg?style=flat-square)](https://www.npmjs.org/package/node-hot-loader)

**Node Hot Loader** is a small tool for [Hot Module Replacement](https://webpack.github.io/docs/hot-module-replacement.html) support for Node.js application development with [webpack](https://github.com/webpack/webpack).

It based on work of [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware) and [webpack/hot/only-dev-server](https://github.com/webpack/webpack).
Under the hood it uses webpack and babel, so you can use all you need configurations in config files for babel and webpack.

**Node Hot Loader** by default run the all webpack entries in the same **single process** or in forked process, if you set corresponding option.

The most suitable use case for **Node Hot Loader** is hot-reloaded [express](http://expressjs.com/) application.
Express application can contains API and frontend together, moreover frontend can use own HMR, e.g. [React](https://facebook.github.io/react/) with [React Hot Loader](https://github.com/gaearon/react-hot-loader).
See how to setup React HMR with Express in [React Hot Loader docs](http://gaearon.github.io/react-hot-loader/getstarted/).
Thus, both the frontend and the server will be hot-reloadable.

**Node Hot Loader** also supports webpack config files written on ES2015+ (through babel).
For using ES2015+ in webpack configuration you must provide .babelrc configuration file in project root directory.

If you have suggestions or you find a bug, please, open an issue or make a PR.

## System requirements

Tested with Node.js v7, v8, but must work on previous versions.

## Installation

```sh
npm install --save-dev node-hot-loader webpack
# or
yarn add --dev node-hot-loader webpack
```

## Command line usage

**Node Hot Loader** uses [yargs](http://yargs.js.org/) for parsing command line arguments.

```
Usage: node-hot {options}
```

### Options

| Name         | Description                                                                                                          | Note                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `--config`   | Path to the webpack config file.                                                                                     | If not set then search webpack.config.js in root directory. |
| `--fork`     | Launch compiled assets in forked process with optional node exec arguments.                                          |
| `--args`     | List of arguments for forked process.                                                                                |
| `--logLevel` | Log level related to [webpack stats configuration presets names](https://webpack.js.org/configuration/stats/#stats). | If not set then use webpack stats configuration.            |

### Usage example

```sh
node-hot --config webpack.config.server.js
# or
node-hot --logLevel minimal
# or
node-hot --fork
# or
node-hot --fork=--arg1,--arg2 --
# or
node-hot --fork --args=--arg1,--arg2
# or just
node-hot
# Use the --help option to get the list of available options
```

Of course, you can add script into you package.json:

```json
...
"scripts": {
  "start": "node-hot --config webpack.config.server.js"
}
...
```

and then run with your favorite package manager:

```sh
npm run start
# or
yarn run start
```

## Webpack plugin

```typescript
import NodeHotLoaderWebpackPlugin from 'node-hot-loader/NodeHotLoaderWebpackPlugin';

// Webpack configuration
export default {
  plugins: [
    // All options are optional
    new NodeHotLoaderWebpackPlugin({
      force, // boolean. true - always launch entries, false (by default) - launch entries only in watch mode.
      fork, // boolean | string[]. For example ['--key', 'key value'].
      args, // string[]. For example ['--arg1', 'arg2'].
      logLevel, // string
    }),
  ],
};
```

and run webpack in watch mode:

```sh
webpack --watch
```

## The minimum required configuration:

**Node Hot Loader** adds all necessaries to webpack config if not present already (e.g. HotModuleReplacementPlugin),
but it's require the minimum configuration in your webpack config file:

```javascript
export default {
  output: {
    // Webpack can't find hot-update if output file is not directly in output.path.
    // For example, filename: 'js/[name].js' will not work.
    // However, I have no many tests for that.
    filename: '[name].js',
  },
};
```

## Troubleshooting

### Running **Node Hot Loader** inside a Docker container

If you attempt to run the **Node Hot Loader** inside a Docker container, it will start and serve as expected, but will not Hot Module Reload without some additional configuration. Add the following to your webpack config:

```javascript
module.exports = {
  //...
  watchOptions: {
    poll: 1000, // Check for changes every second
  },
};
```

This instructs webpack to poll for changes (every second) instead of watching. This is necessary because watching does not work with NFS and machines in VirtualBox. See [Webpack Configuration](https://webpack.js.org/configuration/watch/#watchoptions-poll) docs for more information.

## Express Hot Reload Example

```javascript
import app from './app'; // configuring express app, e.g. routes and logic

function startServer() {
  return new Promise((resolve, reject) => {
    const httpServer = app.listen(app.get('port'));

    httpServer.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        reject(err);
      }
    });

    httpServer.once('listening', () => resolve(httpServer));
  }).then(httpServer => {
    const { port } = httpServer.address();
    console.info(`==> 🌎 Listening on ${port}. Open up http://localhost:${port}/ in your browser.`);

    // Hot Module Replacement API
    if (module.hot) {
      let currentApp = app;
      module.hot.accept('./app', () => {
        httpServer.removeListener('request', currentApp);
        import('./app')
          .then(({ default: nextApp }) => {
            currentApp = nextApp;
            httpServer.on('request', currentApp);
            console.log('HttpServer reloaded!');
          })
          .catch(err => console.error(err));
      });

      // For reload main module (self). It will be restart http-server.
      module.hot.accept(err => console.error(err));
      module.hot.dispose(() => {
        console.log('Disposing entry module...');
        httpServer.close();
      });
    }
  });
}

console.log('Starting http server...');
startServer().catch(err => {
  console.error('Error in server start script.', err);
});
```

## License

[MIT](https://opensource.org/licenses/mit-license.php)
