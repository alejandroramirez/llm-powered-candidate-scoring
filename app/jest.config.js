// jest.config.js
const nextJest = require("next/jest")

const createJestConfig = nextJest({
	dir: "./", // Path to your Next.js app root
})

const customJestConfig = {
	setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
	testEnvironment: "jest-environment-jsdom",
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/src/$1",
	},
}

module.exports = createJestConfig(customJestConfig)
