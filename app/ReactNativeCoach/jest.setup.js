/* eslint-env jest */
/* Global mocks for the native modules the app cannot run in Node. */

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  const mock = {
    getItem: jest.fn(async key => (store.has(key) ? store.get(key) : null)),
    setItem: jest.fn(async (key, value) => {
      store.set(key, String(value));
    }),
    removeItem: jest.fn(async key => {
      store.delete(key);
    }),
    clear: jest.fn(async () => {
      store.clear();
    }),
    getAllKeys: jest.fn(async () => Array.from(store.keys())),
    multiGet: jest.fn(async keys => keys.map(key => [key, store.has(key) ? store.get(key) : null])),
    multiSet: jest.fn(async pairs => {
      pairs.forEach(pair => store.set(pair[0], String(pair[1])));
    }),
    multiRemove: jest.fn(async keys => {
      keys.forEach(key => store.delete(key));
    }),
  };
  return { __esModule: true, default: mock, ...mock };
});

jest.mock('react-native-keychain', () => {
  const store = new Map();
  return {
    ACCESSIBLE: {
      WHEN_UNLOCKED: 'AccessibleWhenUnlocked',
      AFTER_FIRST_UNLOCK: 'AccessibleAfterFirstUnlock',
      ALWAYS: 'AccessibleAlways',
    },
    setGenericPassword: jest.fn(async (username, password, options) => {
      store.set((options && options.service) || 'default', { username, password });
      return { service: (options && options.service) || 'default' };
    }),
    getGenericPassword: jest.fn(async options => {
      const entry = store.get((options && options.service) || 'default');
      return entry ? { ...entry, service: (options && options.service) || 'default' } : false;
    }),
    resetGenericPassword: jest.fn(async options => {
      store.delete((options && options.service) || 'default');
      return true;
    }),
    __reset: () => {
      store.clear();
    },
  };
});

jest.mock('react-native-screens', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = ({ children, ...rest }) => React.createElement(View, rest, children);
  const known = {
    enableScreens: jest.fn(),
    Screen: passthrough,
    ScreenContainer: passthrough,
    NativeScreen: passthrough,
    NativeScreenContainer: passthrough,
    ScreenStack: passthrough,
    ScreenStackHeaderConfig: passthrough,
    ScreenStackHeaderSubview: passthrough,
    ScreenStackHeaderBackButtonImage: passthrough,
    ScreenStackHeaderLeftView: passthrough,
    ScreenStackHeaderRightView: passthrough,
    ScreenStackHeaderCenterView: passthrough,
    ScreenStackHeaderSearchBarView: passthrough,
    SearchBar: passthrough,
    useTransitionProgress: () => ({ progress: 0, closing: false, goingForward: true }),
  };
  return new Proxy(known, {
    get(target, prop) {
      if (prop in target) {
        return target[prop];
      }
      if (typeof prop === 'string' && prop !== '__esModule') {
        return passthrough;
      }
      return undefined;
    },
  });
});
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
  return {
    SafeAreaProvider: ({ children }) => React.createElement(View, null, children),
    SafeAreaView: ({ children }) => React.createElement(View, null, children),
    SafeAreaInsetsContext: React.createContext(metrics.insets),
    useSafeAreaInsets: () => metrics.insets,
    useSafeAreaFrame: () => metrics.frame,
    initialWindowMetrics: metrics,
  };
});