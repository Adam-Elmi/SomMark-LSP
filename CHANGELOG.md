# Changelog

## v3.0.2 (2026-07-09)

### Fixed

- **`applyLspStubs` corrupted block syntax outside logic blocks** — the stub replacement was running a global text substitution across the entire document. This turned function calls like `getPages()` inside label text or props into `[]`, breaking the parser. Replacements are now scoped to `${ }$` logic blocks only.

## v3.0.0 (2026-07-02)

### Added

- **Completions provider** — block tag completions triggered by `[`, `,`, ` `, and `:`. Suggests known SomMark block names and props as you type.

- **Document formatting provider** — format `.smark` files on save or via the format document command.

- **CSS embedded highlighting** — CSS property values inside SomMark props (e.g. inline styles) are now highlighted using the `css-tree` parser, matching the token types used by the rest of the semantic token system.

- **`${ }$` closing brace semantic token** — the closing `}` of a JS template literal interpolation (`${ ... }`) is now correctly classified as `macro` type, consistent with the opening `${`.

- **Per-file LSP directive** — add `# @lsp format: html mapper: ./my-mapper.js` on the first line of any `.smark` file to override the format and mapper for that file specifically, without changing `smark.config.js`.

### Changed

- **Diagnostics now use the SomMark transpiler** — the custom QuickJS error handler (`quickJSToLSPDiagnostic`) has been removed. Errors from `static ${ }$` and `runtime ${ }$` blocks are now surfaced through the same transpiler pipeline as all other diagnostics, giving more accurate positions and consistent error messages across all block types.

### Fixed

- **Semantic tokens 500ms delay** — the tokens handler was polling for up to 500ms waiting for the document to appear in the store. The poll loop has been removed; the handler now returns immediately. Token highlighting no longer flashes on file open or switch.

- **Zed Ctrl+/ line commenting** — the config field was `line_comment` (wrong). Changed to `line_comments = ["# "]` (plural, array). Ctrl+/ now correctly toggles `# ` comments in Zed.

- **Broken images in editor READMEs** — neovim, vim, and Zed READMEs used relative image paths that broke on GitHub. Changed to absolute `raw.githubusercontent.com` URLs.

### Changed

- **Removed `@_` / `_@` auto-pair** from VS Code (`language-configuration.json`) and Zed (`config.toml`). The `@_` atblock syntax was removed from SomMark in v5.1.0.

- **Zed README** — added build step (`rustup target add wasm32-wasip1` + `cargo build --target wasm32-wasip1 --release`) and clarified the load-into-Zed flow. Removed the manual `cp` step — Zed compiles the extension itself.

- **Editor READMEs** — added auto-closing pairs tables to neovim, vim, and VS Code READMEs.

- **SomMark dependency** bumped to `^5.1.0`.

---

## v2.0.2 (2026-06-25)

### Fixed

- Fixed version bump issues.

---

## v2.0.1 (2026-06-24)

### Fixed

- Allow `return` outside functions in static blocks.
- Improved test robustness.

---

## v2.0.0 (2026-06-23)

### Added

- Full Zed editor support — extension, language config, bracket pairs, LSP wiring.
- Semantic tokens: `macro` type for `${ }$` blocks and JS template literal interpolations.
- Screenshots and config links added to README.

### Changed

- Major server refactor — fresh config loader using data URLs for cache-busting, real-time config watching.
