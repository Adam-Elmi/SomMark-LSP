# SomMark Support for Vim (using Coc.nvim)

This directory contains pre-configured files to add SomMark support to Vim using **coc.nvim**.

## Files
- [vimrc](file:///home/adam/Projects/Smark/SomMark-LSP/editors/vim/vimrc): Sample Vim configuration.
- [coc-settings.json](file:///home/adam/Projects/Smark/SomMark-LSP/editors/vim/coc-settings.json): Language server configuration for coc.nvim.

## Setup

1. **Install coc.nvim**: Follow the instructions at [coc.nvim](https://github.com/neoclide/coc.nvim).
2. **Configure Language Server**: Add the contents of `coc-settings.json` to your global `coc-settings.json` (usually `:CocConfig` in Vim).

```json
{
  "languageserver": {
    "sommark-lsp": {
      "command": "sommark-lsp",
      "args": ["--stdio"],
      "filetypes": ["sommark", "smark"],
      "rootPatterns": ["package.json", ".git"]
    }
  }
}
```

3. **Filetype Detection**: Create `~/.vim/ftdetect/sommark.vim` and add:
```vim
autocmd BufRead,BufNewFile *.smark set filetype=sommark
```

4. **Syntax Highlighting**: Create `~/.vim/syntax/sommark.vim` for basic highlighting, or rely on semantic tokens if your client supports them.
