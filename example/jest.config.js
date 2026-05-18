module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^@marcocrupi/react-native-keep-awake-plus$':
      '<rootDir>/node_modules/@marcocrupi/react-native-keep-awake-plus/index.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|@react-native-community|@marcocrupi/react-native-keep-awake-plus)/)',
  ],
};
