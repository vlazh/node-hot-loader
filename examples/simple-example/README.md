# simple-example

Example for very simple Hot Module Replacement with webpack.

Totally based on [hot-node-example](https://github.com/webpack/hot-node-example), but just with **node-hot-loader**.

## Running the app with HMR

```
npm install
npm start
```
or
```
yarn install
yarn start
```

## Real app

In a real application you should do this things too:

* Put any normal node.js module in `externals` config
  * For performance
  * Not all node.js modules can be bundled
  * Specify `output.libraryTarget: "commonjs2"` to default to import by require.
* Enable SourceMaps and source-map-support for node.js
* Handle the case when a hot update fails, i. e. because of errors or not accepted modules
