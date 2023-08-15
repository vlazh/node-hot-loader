module.exports = {
  extends: require.resolve('@js-toolkit/configs/eslint/common'),
  rules: {
    'class-methods-use-this': 'off',
    'global-require': 'off',
    'import/no-dynamic-require': 'off',
  },
};
