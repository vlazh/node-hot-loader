module.exports = {
  extends: '@vzh/configs/babel/common.babelrc.js',
  plugins: [
    '@babel/plugin-proposal-class-properties',
    'babel-plugin-transform-inline-environment-variables',
  ],
};
