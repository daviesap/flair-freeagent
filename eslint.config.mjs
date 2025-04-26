import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { 
    files: ["**/*.{js,mjs,cjs}"], 
    plugins: { js }, 
    extends: ["js/recommended"], 
    languageOptions: { 
      sourceType: "commonjs",
      ecmaVersion: "latest",
      globals: {
        ...globals.node,   // 👈 ADD this (Node.js globals like Buffer, process, etc)
      },
    },
  }
]);