export default class LogColors {
  static defaultColors = {
    bold: '\u001b[1m',
    yellow: '\u001b[1m\u001b[33m',
    red: '\u001b[1m\u001b[31m',
    green: '\u001b[1m\u001b[32m',
    cyan: '\u001b[1m\u001b[36m',
    magenta: '\u001b[1m\u001b[35m',
  };
}

Object.keys(LogColors.defaultColors).reduce((obj, color) => {
  obj[color] = str => `${LogColors.defaultColors[color]}${str}\u001b[39m\u001b[22m`;
  return obj;
}, LogColors);
