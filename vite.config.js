import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5199,
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
