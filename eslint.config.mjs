import { createRequire } from "module";
const require = createRequire(import.meta.url);

import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";

// Importing the individual rule sets from airbnb-base
// This bypasses the ESM loader issues in Node 25
const airbnbBestPractices = require("eslint-config-airbnb-base/rules/best-practices");
const airbnbErrors = require("eslint-config-airbnb-base/rules/errors");
const airbnbNode = require("eslint-config-airbnb-base/rules/node");
const airbnbStyle = require("eslint-config-airbnb-base/rules/style");
const airbnbVariables = require("eslint-config-airbnb-base/rules/variables");
const airbnbEs6 = require("eslint-config-airbnb-base/rules/es6");

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname, 
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      // Spread each individual rule set
      ...airbnbBestPractices.rules,
      ...airbnbErrors.rules,
      ...airbnbNode.rules,
      ...airbnbStyle.rules,
      ...airbnbVariables.rules,
      ...airbnbEs6.rules,

      // TypeScript Recommended Rules
      ...tseslint.configs["recommended"].rules,
      // Use optional chaining in case the specific version naming differs
      ...(tseslint.configs["recommended-type-checked"]?.rules || {}),
      
      // Your Specific Overrides
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/explicit-function-return-type": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      
      // Essential Airbnb-to-TS compatibility overrides
      "import/extensions": "off",
      "import/no-unresolved": "off",
      "import/prefer-default-export": "off",
      "no-use-before-define": "off",
      "@typescript-eslint/no-use-before-define": "error",
      "no-shadow": "off",
      "@typescript-eslint/no-shadow": "error",
      "complexity": ["error", 10],

      // Tuned Airbnb rules
      "no-param-reassign": ["error", { "props": false }], // ban param rebinding, allow property mutation

      // Disabled Airbnb rules
      "no-underscore-dangle": "off",  // TS has private keyword; _name convention is fine
      "no-restricted-syntax": "off",  // for...of is fine in modern TS/Node — regenerator concern is obsolete
      "no-plusplus": "off",           // i++ in loops is universally understood
      "no-redeclare": "off",          // TS function overloads look like redeclarations; TS compiler handles this
    },
  },
  prettierConfig, // Always last
];