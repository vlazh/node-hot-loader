module.exports = {
  extends: '@vzh/configs/babel/common.babelrc.json',
  plugins: [
    '@babel/plugin-proposal-class-properties',
    'babel-plugin-transform-inline-environment-variables',
  ],
};
