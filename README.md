# SomMark-LSP <img src="icons/sommark.png" width="80" align="right">

Language Server Protocol (LSP) implementation for the SomMark markup language.

## Features
- **Diagnostics**: Accurate syntax error reporting with precise ranges.
- **Semantic Highlighting**: Perfect token-based coloring in any editor that supports LSP Semantic Tokens (VS Code, Neovim, CoC).
- **Easy Sharing**: Install globally to use across all editors with a single command.

## Installation

Go to the `SomMark-LSP` directory and install the server globally:

```bash
npm install -g sommark-lsp
```

This will register the `sommark-lsp` command.

## Editor Integration

### Vim (coc.nvim)
Add the following to your `coc-settings.json`:
```json
{
  "languageserver": {
    "sommark-lsp": {
      "command": "sommark-lsp",
      "args": ["--stdio"],
      "filetypes": ["sommark", "smark"],
      "rootPatterns": ["package.json", ".git"]
    }
  },
  "semanticTokens.enable": true
}
```
And add these to your `.vimrc`:
```vim
autocmd BufRead,BufNewFile *.smark set filetype=sommark
hi link CocSemKeyword Keyword
hi link CocSemString String
hi link CocSemVariable Identifier
```

### Neovim
Use `nvim-lspconfig` or manually:
```lua
vim.lsp.start({
  name = 'sommark-lsp',
  cmd = {'sommark-lsp', '--stdio'},
  root_dir = vim.fs.dirname(vim.fs.find({'package.json', '.git'}, { upward = true })[1]),
})
```

### Helix
Add to `~/.config/helix/languages.toml`:
```toml
[language-server.sommark-lsp]
command = "sommark-lsp"
args = ["--stdio"]

[[language]]
name = "sommark"
scope = "source.sommark"
file-types = ["smark"]
language-servers = [ "sommark-lsp" ]
```
> [!NOTE]
> Helix support is currently limited; diagnostics and some features work, but full syntax highlighting requires a Tree-sitter grammar (coming soon).

## Configuration
You can configure the LSP behavior via `smark.config.js` in your project root.
