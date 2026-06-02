# SomMark Support for Neovim (via nvim-lspconfig)

This directory contains the minimal setup required to add native SomMark Language Server support to Neovim using the **nvim-lspconfig** plugin.

![SomMark in Neovim](../../screenshots/nvim.png)

## Prerequisites

You must have [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig) installed in your Neovim environment (e.g., via `lazy.nvim`, `packer`, etc.).

## Setup Instructions

To configure the LSP, you simply need to add the provided snippet to your Neovim configuration file.

1. Open your Neovim configuration file (usually `~/.config/nvim/init.lua`).
2. **If you use a plugin manager like `lazy.nvim`**, scroll down to the bottom of the file (or anywhere *after* your plugin manager's `setup()` block).
3. Copy the contents of the [`sommark-lsp.lua`](sommark-lsp.lua) file from this directory and paste it into your configuration.

The snippet does two things:
1. **Filetype Detection**: Tells Neovim to treat `.smark` files as the `sommark` language.
2. **LSP Configuration**: Defines the custom `sommark-lsp` server and attaches it to the `sommark` filetype natively.

That's it! Restart Neovim and open any `.smark` file to see real-time diagnostics and syntax highlighting.
