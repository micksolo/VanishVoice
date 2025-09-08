// WebSocket polyfill for React Native
// This prevents the 'ws' package from being imported in React Native environment

class WebSocketPolyfill {
  constructor() {
    // Return the global WebSocket if available (React Native provides this)
    if (typeof WebSocket !== 'undefined') {
      return WebSocket;
    }
  }
}

module.exports = WebSocketPolyfill;
module.exports.WebSocket = WebSocketPolyfill;
module.exports.Server = class Server {};
module.exports.Receiver = class Receiver {};
module.exports.Sender = class Sender {};