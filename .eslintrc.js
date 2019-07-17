module.exports = {
  extends: require.resolve('@vzh/configs/eslint/common.eslintrc.js'),
  rules: {
    'class-methods-use-this': 'off',
    'global-require': 'off',
    'import/no-dynamic-require': 'off',
  }
};
