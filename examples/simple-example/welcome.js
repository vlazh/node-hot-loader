// Feel free to edit this file

module.exports = "Hello";

// just logging, not needed in real app
if(module.hot) {
	module.hot.dispose(function() {
		console.log("Disposed welcome.js");
	});
}