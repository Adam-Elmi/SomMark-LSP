# SomMark Support for Helix

To use the SomMark LSP in Helix, you need to configure it in your `languages.toml` file.

## Configuration

Add the following to your Helix `languages.toml`. 

- **Global Config**: `~/.config/helix/languages.toml`
- **Project Config**: `.helix/languages.toml`

```toml
[[language]]
name = "sommark"
scope = "source.sommark"
injection-regex = "sommark"
file-types = ["smark"]
roots = ["package.json", ".git"]
language-servers = [ "sommark-lsp" ]

[language-server.sommark-lsp]
# Replace 'YOUR_PATH_TO_SOMMARK_LSP' with the absolute path to your SomMark-LSP directory
command = "node"
args = ["YOUR_PATH_TO_SOMMARK_LSP/server/server.js", "--stdio"]
```

## Features

- **Diagnostics**: Real-time syntax error reporting.
- **Tree-sitter**: Helix relies on Tree-sitter for highlighting. Since no Tree-sitter grammar is currently provided, highlighting will be basic or fall back to plain text unless a grammar is added.
