import fs from "fs";
import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
  server: {
    host: true,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, "localhost+3-key.pem")),
      cert: fs.readFileSync(path.resolve(__dirname, "localhost+3.pem")),
    },
  },
});
