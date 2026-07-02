const path = require("node:path");

module.exports = {
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  roots: [path.join(__dirname, "apps"), path.join(__dirname, "packages")],
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: path.join(__dirname, "tsconfig.jest.json"),
      },
    ],
  },
};
