# Node Hot Loader [![npm package](https://img.shields.io/npm/v/node-hot-loader.svg?style=flat-square)](https://www.npmjs.org/package/node-hot-loader)

**Node Hot Loader** is a small tool written on ES2015+ for [Hot Module Replacement](https://webpack.github.io/docs/hot-module-replacement.html) support for Node.js application development with [webpack](https://github.com/webpack/webpack).

Its inspired by [kotatsu](https://github.com/Yomguithereal/kotatsu/) and [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware). 

Typical use cases for **Node Hot Loader** are hot-reloaded [express](http://expressjs.com/) application with APIs and frontend serving, i.e. [React](https://facebook.github.io/react/).

## Installation

`
npm install --save-dev node-hot-loader babel-cli
`

[babel-cli](https://babeljs.io/docs/usage/cli/) need for starting **Node Hot Loader** ES2015+ module.

## Usage

```
Usage: babel-node node-hot {options}

Options:
  -c, --config       Webpack config file. If not set then search webpack.config.js in root directory.
```

## License

MIT (https://opensource.org/licenses/mit-license.php)
