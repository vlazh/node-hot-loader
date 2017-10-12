# Node Hot Loader [![npm package](https://img.shields.io/npm/v/node-hot-loader.svg?style=flat-square)](https://www.npmjs.org/package/node-hot-loader)

**Node Hot Loader** is a small tool for [Hot Module Replacement](https://webpack.github.io/docs/hot-module-replacement.html) support for Node.js application development with [webpack](https://github.com/webpack/webpack).

It based on sources of [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware) and [webpack/hot/only-dev-server](https://github.com/webpack/webpack).
Under the hood it uses webpack and babel, so you can use all you need configurations in config files for babel and webpack.

The most suitable use case for **Node Hot Loader** is hot-reloaded [express](http://expressjs.com/) application.
Express application can contains API and frontend together, moreover frontend can use own HMR, e.g. [React](https://facebook.github.io/react/) with [React Hot Loader](https://github.com/gaearon/react-hot-loader).
See how to setup React HMR with Express in [React Hot Loader docs](https://github.com/gaearon/react-hot-loader/tree/master/docs#starter-kit).
Thus, both the frontend and the server will be hot-reloadable.

**Node Hot Loader** also supports webpack config files written on ES2015+ (through babel).
For using ES2015+ in webpack configuration you must provide .babelrc configuration file in project root directory.

## Requirements

Tested with Node.js v7, but must work on previous versions.

## Installation

```
npm install --save-dev node-hot-loader webpack
```

## Usage

```
Usage: node-hot {options}

Options:
  -c, --config       Webpack config file. If not set then search webpack.config.js in root directory.
```

## Usage example
```
node-hot --config webpack.config.server.js
```

You can use all configurations for webpack compiler which webpack supports.

## The minimum required configuration:

**Node Hot Loader** adds all necessaries to webpack config if not present already (e.g. HotModuleReplacementPlugin),
but it's require the minimum configuration in your webpack config file:

```javascript
import fs from 'fs';

export default {
  // node-hot run the all entries in one child process.
  // And the all entries will be with HMR support.
  // Usually only one entry required for node application. 
  entry: {
    server: [
      './server/index',
    ],
  },

  output: {
    // Webpack can't find hot-update if output file is not directly in output.path.
    // For example, filename: 'js/[name].js' will not work.
    // However, I have no many tests for that.
    filename: '[name].js',
  },

  // Exclude node_modules from bundle manual
  // or use for instance webpack-node-externals package (https://github.com/liady/webpack-node-externals)
  externals: fs.readdirSync(paths.nodeModules.dirname)
      .filter(x => ['.bin'].indexOf(x) === -1)
      .reduce((modules, mod) => {
        modules[mod] = `commonjs ${mod}`;
        return modules;
      }, {}),
  
  // It may be necessary when your compiled app uses Webpack too, e.g. for frontend serving,
  //   because Webpack sets __dirname to '/'.
  // It may be some issues in your app, so sets __dirname to false can help you.
  // See https://github.com/webpack/webpack/issues/1599.
  node: {
    __dirname: false,
    __filename: false,
  },
};
```

## Express Hot Reload Example

```javascript
import app from './app'; // configuring express app, e.g. routes and logic
import DB from './services/DB'; // DB service


function startServer() {
  const httpServer = app.listen(app.get('port'), (error) => {
    if (error) {
      console.error(error);
    } else {
      const address = httpServer.address();
      console.info(`==> 🌎 Listening on ${address.port}. Open up http://localhost:${address.port}/ in your browser.`);
    }
  });

  // Hot Module Replacement API
  if (module.hot) {
    // Hot reload of `app` and related modules.
    let currentApp = app;
    module.hot.accept('./app', () => {
      httpServer.removeListener('request', currentApp);
      import('./app').then(m => {
        httpServer.on('request', m.default);
        currentApp = m.default;
        console.log('Server reloaded!');
      })
      .catch(err => console.error(err));
    });

    // Hot reload of entry module (self). It will be restart http-server.
    module.hot.accept();
    module.hot.dispose(() => {
      console.log('Disposing entry module...');
      httpServer.close();
    });
  }
}

// After DB initialized start server
DB.connect()
    .then(() => {
      console.log('Successfully connected to MongoDB. Starting http server...');
      startServer();
    })
    .catch((err) => {
      console.error('Error in server start script.', err);
    });
```

## License

[MIT](https://opensource.org/licenses/mit-license.php)
