module.exports = {
  preset: "react-native",
  testEnvironment: "node",
  testMatch: [
    "**/__tests__/**/*.offline.test.js",
    "**/__tests__/**/*.online.test.js",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    "^@react-native-async-storage/async-storage$":
      "<rootDir>/__mocks__/@react-native-async-storage/async-storage.js",
  },
  collectCoverageFrom: [
    "src/services/**/*.{ts,tsx,js,jsx}",
    "src/utils/**/*.{ts,tsx,js,jsx}",
    "!src/**/*.d.ts",
  ],
};
