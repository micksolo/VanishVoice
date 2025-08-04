// Fixed entry point that bypasses the Babel runtime resolution issue
// This uses CommonJS require() instead of ES6 imports
const { registerRootComponent } = require('expo');

// Import the App component 
let App;
try {
  App = require('./App').default;
} catch (e) {
  App = require('./App');
}

// Register the root component
registerRootComponent(App);