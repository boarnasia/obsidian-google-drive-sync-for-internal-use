// Obsidian のコミュニティプラグイン審査スキャナーと同じ設定（eslint-plugin-obsidianmd の docs/configuration.md）。
// 違いは validate-manifest / validate-license を有効のままにしている点だけ。スキャナーは
// これらを別に検査するので、手元でも同じ指摘を先に受けておく。
import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.*", "manifest.json"],
        },
        extraFileExtensions: [".json"],
      },
    },
  },

  ...obsidianmd.configs.recommended,

  {
    files: ["**/*.{ts,cts,mts,tsx,js,cjs,mjs,jsx}"],
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
      "obsidianmd/regex-lookbehind": "error",
      "obsidianmd/no-forbidden-elements": "error",

      "no-undef": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "import/no-unresolved": "off",
    },
  },

  globalIgnores([
    "node_modules",
    "main.js",
    ".local",
    "graphify-out",
    "esbuild.config.mjs",
    "vitest.config.*",
    "**/*.test.*",
    "**/tests/**",
    "**/*.mjs",
    "**/i18n/locales/**",
  ]),
]);
