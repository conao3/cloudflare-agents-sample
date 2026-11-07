import { defineConfig } from "vite-plus"

export default defineConfig({
  fmt: {
    semi: false,
    singleQuote: false,
    trailingComma: "all",
    sortPackageJson: false,
    ignorePatterns: ["**/worker-configuration.d.ts"],
  },
  lint: {
    categories: { correctness: "error", suspicious: "warn" },
    ignorePatterns: [
      "node_modules",
      "dist",
      ".direnv",
      ".wrangler",
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
        command:
          "for c in apps/dashboard samples/state-counter samples/scheduler; do (cd $c && wrangler types); done",
        cache: false,
      },
    },
  },
})
