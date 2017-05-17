# Node Hot Loader [![npm package](https://img.shields.io/npm/v/node-hot-loader.svg?style=flat-square)](https://www.npmjs.org/package/node-hot-loader)

**Node Hot Loader** is a small tool written on ES2015+ for [Hot Module Replacement](https://webpack.github.io/docs/hot-module-replacement.html) support for Node.js application development with [webpack](https://github.com/webpack/webpack).

Its inspired by [kotatsu](https://github.com/Yomguithereal/kotatsu/) and [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware). 

Typical use cases for **Node Hot Loader** are hot-reloaded [express](http://expressjs.com/) application with APIs and frontend serving, i.e. [React](https://facebook.github.io/react/).

**Node Hot Loader** support webpack config files with ES2015+ (through babel).

## Installation

`
npm install --save-dev node-hot-loader
`

or from Git repository:

`npm install --save-dev https://github.com/emsoft/node-hot-loader`

## Usage

```
Usage: node node-hot {options}

Options:
  -c, --config       Webpack config file. If not set then search webpack.config.js in root directory.
```

## Known limitations

In your webpack config you must provide main entry with 'server' name. It will be fixed in the feature.

## Example
```npm
node ./node_modules/node-hot-loader --config webpack.config.server.babel.js
```

## License

MIT (https://opensource.org/licenses/mit-license.php)
