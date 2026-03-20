-- Neovim Configuration for SomMark Native LSP
-- Uses lazy.nvim as plugin manager

-- 1. Bootstrap lazy.nvim
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable",
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

-- 2. Basic Settings
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.expandtab = true
vim.opt.shiftwidth = 2
vim.opt.tabstop = 2
vim.opt.hidden = true
vim.opt.updatetime = 300

-- 3. Plugins setup
require("lazy").setup({
  -- LSP Support
  {
    "neovim/nvim-lspconfig",
    config = function()
      local lspconfig = require('lspconfig')
      local configs = require('lspconfig.configs')

      -- Define custom SomMark LSP if not already defined
      if not configs.sommark_lsp then
        configs.sommark_lsp = {
          default_config = {
            cmd = { "sommark-lsp", "--stdio" },
            filetypes = { 'sommark', 'smark' },
            root_dir = lspconfig.util.root_pattern('package.json', '.git', 'smark.config.js'),
            settings = {},
          },
        }
      end

      -- Setup SomMark LSP
      lspconfig.sommark_lsp.setup{
        on_attach = function(client, bufnr)
          -- Keybindings for LSP
          local opts = { noremap=true, silent=true, buffer=bufnr }
          vim.keymap.set('n', 'gd', vim.lsp.buf.definition, opts)
          vim.keymap.set('n', 'K', vim.lsp.buf.hover, opts)
          vim.keymap.set('n', 'gi', vim.lsp.buf.implementation, opts)
          vim.keymap.set('n', 'gr', vim.lsp.buf.references, opts)
        end
      }
    end
  },
  -- Syntax Highlighting (Optional but recommended)
  {
    "nvim-treesitter/nvim-treesitter",
    build = ":TSUpdate",
  }
})

-- 4. Filetype Detection
vim.filetype.add({
  extension = {
    smark = 'sommark',
  },
})
