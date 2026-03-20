# SomMark Support for Neovim (using nvim-lspconfig)

This directory contains pre-configured files to add SomMark support to Neovim using **nvim-lspconfig**.

## Files
- [init.lua](file:///home/adam/Projects/Smark/SomMark-LSP/editors/vim/init.lua): Sample Neovim configuration.

## Setup

1. **Install nvim-lspconfig**: Follow the instructions at [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig).
2. **Configure Language Server**: Add the following to your Neovim configuration (`init.lua`):

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

if not configs.sommark_lsp then
  configs.sommark_lsp = {
    default_config = {
      cmd = { 'sommark-lsp', '--stdio' },
      filetypes = { 'sommark', 'smark' },
      root_dir = lspconfig.util.root_pattern('package.json', '.git'),
      settings = {},
    },
  }
end

lspconfig.sommark_lsp.setup{}
```

3. **Filetype Detection**: Add this to your `init.lua` or `ftdetect/sommark.lua`:
```lua
vim.filetype.add({
  extension = {
    smark = 'sommark',
  },
})
```
