import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

const pagesBase = process.env.VITE_BASE_PATH?.trim();

// https://vite.dev/config/
export default defineConfig({
  base: pagesBase && pagesBase.length > 0 ? pagesBase : './',
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/onnxruntime-web")) {
            return id.includes("/webgpu") ? "onnx-webgpu" : "onnx-wasm";
          }
          if (
            id.includes("/src/lib/recognizer/ml/probabilisticRecognizer")
            || id.includes("/src/lib/recognizer/ml/modelRuntime")
          ) {
            return "ml-recognition";
          }
        },
      },
    },
  },
});
