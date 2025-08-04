// Workaround for Babel runtime resolution issue on new Mac setup
// Use require() instead of import to avoid triggering interopRequireDefault
const { registerRootComponent } = require('expo');
const App = require('./App').default || require('./App');

registerRootComponent(App);