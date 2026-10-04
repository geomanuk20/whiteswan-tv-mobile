// Polyfills for Hermes / React Native environment
if (typeof global.DOMRectReadOnly === 'undefined') {
  global.DOMRectReadOnly = class DOMRectReadOnly {
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.top = y;
      this.right = x + width;
      this.bottom = y + height;
      this.left = x;
    }
  };
}
if (typeof global.DOMRect === 'undefined') {
  global.DOMRect = global.DOMRectReadOnly;
}

import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
registerRootComponent(App);
