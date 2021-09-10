// Feel free to edit this file

const moduleLoadTime = new Date();
const welcome = require('./welcome');

module.exports = function renderApp(input) {
  return [
    welcome,
    'World',
    'Module loaded at',
    moduleLoadTime.toLocaleTimeString(),
    'Rendered at',
    input.toLocaleTimeString(),
  ].join(' ');
};

// just logging, not needed in real app
if (module.hot) {
  module.hot.dispose(() => {
    console.log('Disposed renderApp.js');
  });
}
