export default class Logger {
  prefix;

  constructor(prefix) {
    this.prefix = prefix;
  }

  log(message, ...optionalParams) {
    console.log(this.prefix, message, ...optionalParams);
  }

  warn(message, ...optionalParams) {
    console.warn(this.prefix, message, ...optionalParams);
  }

  error(message, ...optionalParams) {
    console.error(this.prefix, message, ...optionalParams);
  }
}
