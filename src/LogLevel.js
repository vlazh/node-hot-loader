// https://webpack.js.org/configuration/stats/#stats

export const LogLevel = {
  NONE: 0, // none
  ERRORS: 1, // errors-only
  MINIMAL: 2, // minimal
  NORMAL: 3, // normal
};

export function parseLogLevel(stats) {
  let level = LogLevel.NORMAL;
  level = stats === false ? LogLevel.NONE : level;
  level = stats === 'none' ? LogLevel.NONE : level;
  level = stats === 'errors-only' ? LogLevel.ERRORS : level;
  level = stats === 'minimal' ? LogLevel.MINIMAL : level;
  return level;
}
