# SomMark Support for Neovim (via nvim-lspconfig)

This directory contains the minimal setup required to add native SomMark Language Server support to Neovim using the **nvim-lspconfig** plugin.

![SomMark in Neovim](https://raw.githubusercontent.com/Adam-Elmi/SomMark-LSP/master/screenshots/nvim.png)

## Prerequisites

- **Node.js** — required to run the language server
- **sommark-lsp** — install globally:

```bash
npm install -g sommark-lsp
```

- **[nvim-lspconfig](https://github.com/neovim/nvim-lspconfig)** — installed via `lazy.nvim`, `packer`, etc.

## Setup Instructions

To configure the LSP, you simply need to add the provided snippet to your Neovim configuration file.

1. Open your Neovim configuration file (usually `~/.config/nvim/init.lua`).
2. **If you use a plugin manager like `lazy.nvim`**, scroll down to the bottom of the file (or anywhere *after* your plugin manager's `setup()` block).
3. Copy the contents of the [`sommark-lsp.lua`](sommark-lsp.lua) file from this directory and paste it into your configuration.

The snippet does three things:
1. **Filetype Detection**: Tells Neovim to treat `.smark` files as the `sommark` language.
2. **LSP Configuration**: Defines the custom `sommark-lsp` server and attaches it to the `sommark` filetype natively.
3. **Auto-Closing Pairs**: Registers SomMark-specific pair keymaps for the `sommark` filetype (no plugins required).

That's it! Restart Neovim and open any `.smark` file to see real-time diagnostics and syntax highlighting.

## Auto-Closing Pairs

The configuration includes native Neovim keymaps for SomMark syntax — no plugins required:

| Type | Gets |
|------|------|
| `[` | `[]` |
| `(` | `()` |
| `{` | `{}` |
| `"` | `""` |
| `'` | `''` |
| `` ` `` | ` `` `` ` |
| `${` | `${ }$` |
| `###` | `###  ###` |
