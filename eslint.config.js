/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  ...require('@js-toolkit/configs/eslint/common'),

  {
    rules: {
      'class-methods-use-this': 'off',
      'global-require': 'off',
      'import/no-dynamic-require': 'off',
    },
  },
];
