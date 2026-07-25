import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    fileParallelism: false,
    globals: true,
    environment: "node",
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true
      }
    }
  }
});
