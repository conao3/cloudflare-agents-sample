{
  description = "Samples of the Cloudflare Agents platform";

  inputs = {
    flake-parts.url = "github:hercules-ci/flake-parts";
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    treefmt-nix.url = "github:numtide/treefmt-nix";
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [ inputs.treefmt-nix.flakeModule ];
      systems = [
        "x86_64-linux"
        "aarch64-darwin"
      ];

      perSystem =
        { config, pkgs, ... }:
        let
          nodejs = pkgs.nodejs_26;
          pnpm = pkgs.pnpm.override { nodejs-slim = pkgs.nodejs-slim_26; };
          vp = pkgs.writeShellApplication {
            name = "vp";
            runtimeInputs = [
              nodejs
              pnpm
            ];
            text = ''
              workspace_root="$PWD"
              while [[ "$workspace_root" != / && ! -f "$workspace_root/pnpm-workspace.yaml" ]]; do
                workspace_root="$(dirname "$workspace_root")"
              done

              if [[ ! -f "$workspace_root/pnpm-workspace.yaml" ]]; then
                printf '%s\n' "vp must run inside the cloudflare-agents-sample workspace" >&2
                exit 1
              fi

              if [[ "''${1:-}" == install ]]; then
                shift
                exec pnpm install "$@"
              fi

              vp_cli="$workspace_root/node_modules/vite-plus/bin/vp"
              if [[ ! -f "$vp_cli" ]]; then
                printf '%s\n' "The local Vite+ CLI is missing; run 'vp install' first" >&2
                exit 1
              fi

              export PATH="${nodejs}/bin:$workspace_root/node_modules/.bin:$PATH"
              exec ${nodejs}/bin/node "$vp_cli" "$@"
            '';
          };
        in
        {
          devShells.default = pkgs.mkShell {
            inputsFrom = [ config.treefmt.build.devShell ];
            packages = [
              nodejs
              pnpm
              pkgs.wrangler
              vp
            ];
          };

          treefmt.programs.nixfmt.enable = true;
        };
    };
}
