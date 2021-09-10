console.log('Application started');

let renderApp = require('./renderApp');

// fake server, one request per 5s, logged to console
setInterval(() => {
  console.log(renderApp(new Date()));
}, 5000);

if (module.hot) {
  module.hot.accept('./renderApp', () => {
    renderApp = require('./renderApp');
  });
}
