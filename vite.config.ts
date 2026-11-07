import { defineConfig } from "vite-plus"

export default defineConfig({
  fmt: {
    semi: false,
    singleQuote: false,
    trailingComma: "all",
    sortPackageJson: false,
    ignorePatterns: ["**/worker-configuration.d.ts", ".claude-dev/**", ".claude/**"],
  },
  lint: {
    categories: { correctness: "error", suspicious: "warn" },
    ignorePatterns: [
      "node_modules",
      "dist",
      ".direnv",
      ".wrangler",
      ".claude-dev",
      ".claude",
      "**/worker-configuration.d.ts",
    ],
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    tasks: {
      check: { command: "vp check" },
      build: {
        command: "cd apps/dashboard && vp build",
        cache: { input: [{ auto: true }, "!apps/dashboard/dist/**"] },
      },
      types: {
        command: "scripts/workers.sh types",
        cache: false,
      },
    },
  },
})
