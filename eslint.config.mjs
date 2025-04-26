import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { 
    files: ["**/*.mjs"], // ⬅️ NEW BLOCK for .mjs files
    languageOptions: {
      sourceType: "module",
      ecmaVersion: "latest",
    }
  },
  { 
    files: ["**/*.{js,cjs}"], // ⬅️ Your normal code
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      sourceType: "commonjs",
      ecmaVersion: "latest",
      globals: {
        ...globals.node,
      },
    },
  }
]);