import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  base: "/GSC_Calendar_Embed/",

  server: {
    proxy: {
      "/crossbar": {
        target: "https://www.greenwichskatingclub.org",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/crossbar/, "")
      }
    }
  }
});