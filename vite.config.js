import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split node_modules into category chunks so the first-paint bundle
        // stays small. Each chunk is fetched in parallel and cached
        // independently — bumping one dep doesn't invalidate the others.
        // Match on package boundaries (`/node_modules/<pkg>/`) to avoid
        // partial-name collisions (e.g. `react` matching `react-dom`,
        // `react-is`) and cross-chunk circular references.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/@supabase/")) return "supabase";
          if (id.includes("/@radix-ui/")) return "radix";
          if (id.includes("/mammoth/")) return "mammoth";
          if (id.includes("/lucide-react/")) return "lucide";
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/.test(id)) return "react";
          return "vendor";
        },
      },
    },
  },
});
