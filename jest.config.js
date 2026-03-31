/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  moduleNameMapper: {
    '^@wirex/types/(.*)$': '<rootDir>/src/types/$1',
    '^@wirex/errors/(.*)$': '<rootDir>/src/errors/$1',
    '^@wirex/config/(.*)$': '<rootDir>/src/config/$1',
    '^@wirex/wallet/(.*)$': '<rootDir>/src/wallet/$1',
    '^@wirex/stellar/(.*)$': '<rootDir>/src/stellar/$1',
    '^@wirex/transaction/(.*)$': '<rootDir>/src/transaction/$1',
    '^@wirex/api/(.*)$': '<rootDir>/src/api/$1',
    '^@wirex/websocket/(.*)$': '<rootDir>/src/websocket/$1',
    '^@wirex/reference/(.*)$': '<rootDir>/src/reference/$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts', '!src/types/**'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  verbose: true,
};
