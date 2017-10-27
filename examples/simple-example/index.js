console.log("Application started");

var renderApp = require("./renderApp");

// fake server, one request per 5s, logged to console
setInterval(function() {
	console.log(renderApp(new Date()));
}, 5000);

if(module.hot) {
	module.hot.accept("./renderApp", function() {
		renderApp = require("./renderApp");
	});
}
