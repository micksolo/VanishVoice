// Jest setup for React Native
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

// Polyfills
global.Buffer = Buffer;

// Mock crypto.getRandomValues
global.crypto = {
  getRandomValues: (arr) => {
    if (arr instanceof Uint8Array) {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
    }
    return arr;
  }
};

// Mock Expo modules that might be used in tests
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));