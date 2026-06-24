# SomMark Support for Zed

This directory contains the official SomMark Language Server extension for the [Zed Editor](https://zed.dev/).

![SomMark in Zed](../../screenshots/zed.png)

## Prerequisites

- **Node.js** — required to run the language server
- **sommark-lsp** — install the language server globally:

```bash
npm install -g sommark-lsp
```

---

## Installation

Because this extension is not yet published to the Zed marketplace, install it as a Dev Extension.

### 1. Load into Zed

1. Open Zed.
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **`zed: install dev extension`**.
4. Navigate to this `editors/zed-sommark` directory and select it.

Zed will load the extension and attach the language server to any `.smark` file you open.

### 2. Enable Syntax Highlighting

Zed disables LSP-based syntax highlighting by default. Without this step the language server loads and diagnostics work, but no colors appear.

Open your Zed settings (`Ctrl+Shift+P` → **`zed: open settings`**) and add:

```json
{
  "languages": {
    "sommark": {
      "semantic_tokens": "full"
    }
  }
}
```

After saving the settings file, run **`language server: restart`** from the command palette and open a `.smark` file — syntax highlighting should now be active.
