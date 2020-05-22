module.exports = {
  extends: '@vzh/configs/babel/env.babelrc.js',
  plugins: [
    '@babel/plugin-proposal-class-properties',
    'babel-plugin-transform-inline-environment-variables',
  ],
};
