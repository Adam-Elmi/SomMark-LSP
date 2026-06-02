-- Minimal Configuration to add SomMark LSP to an existing Neovim setup
-- Requires: neovim/nvim-lspconfig
-- IMPORTANT: If you use lazy.nvim or packer, make sure to place this code AFTER your plugin manager's setup() call!

-- 1. Filetype Detection
vim.filetype.add({
  extension = {
    smark = 'sommark',
  },
})

-- 2. Define and Setup SomMark Native LSP
local lspconfig_ok, lspconfig = pcall(require, 'lspconfig')
if not lspconfig_ok then
  return
end

local configs = require('lspconfig.configs')

if not configs.sommark_lsp then
  configs.sommark_lsp = {
    default_config = {
      cmd = { "sommark-lsp", "--stdio" },
      filetypes = { 'sommark', 'smark' },
      -- Stop the LSP search at the nearest package.json, git root, or smark config file
      root_dir = lspconfig.util.root_pattern('smark.config.js', 'package.json', '.git'),
      settings = {},
    },
  }
end

-- Initialize the server
lspconfig.sommark_lsp.setup{}

-- 3. Native Auto-Closing Pairs (No plugins required)
vim.api.nvim_create_autocmd("FileType", {
  pattern = "sommark",
  callback = function()
    local opts = { buffer = true, expr = false, silent = true }
    vim.keymap.set("i", "{", "{}<Left>", opts)
    vim.keymap.set("i", "[", "[]<Left>", opts)
    vim.keymap.set("i", "(", "()<Left>", opts)
    vim.keymap.set("i", '"', '""<Left>', opts)
    vim.keymap.set("i", "'", "''<Left>", opts)
    vim.keymap.set("i", "`", "``<Left>", opts)
    
    -- Custom Multi-Character Pairs
    vim.keymap.set("i", "${", "${}$<Left><Left>", opts)
    vim.keymap.set("i", "@_", "@_ _@<Left><Left><Left>", opts)
    vim.keymap.set("i", "###", "###  ###<Left><Left><Left><Left>", opts)
  end,
})
