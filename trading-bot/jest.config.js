/** Pure-TypeScript unit tests (indicators, engine, crypto, REST signing). */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
};
