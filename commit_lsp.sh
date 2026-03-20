#!/bin/bash
# Individual commit script for SomMark-LSP

FILES=(
    ".gitignore"
    "LICENSE"
    "README.md"
    "package.json"
    "package-lock.json"
    "server/server.js"
    "server/diagnostics.js"
    "server/semantic_tokens.js"
    "editors/vscode/package.json"
    "editors/vscode/package-lock.json"
    "editors/vscode/extension.js"
    "editors/vscode/language-configuration.json"
    "editors/vscode/README.md"
    "editors/vim/vimrc"
    "editors/vim/coc-settings.json"
    "editors/vim/README.md"
    "editors/neovim/init.lua"
    "editors/neovim/README.md"
    "editors/helix/languages.toml"
    "editors/helix/README.md"
    "icons/sommark.png"
    "icons/sommark-icon.svg"
    "tests/test_v3_semantic.js"
    "tests/verify_v3_3_0.js"
    "tests/test_formatting.js"
    "tests/test_semantic.js"
    "tests/test_empty.js"
    "tests/test_builder.js"
    "tests/test_strip.js"
    "tests/verify_lexsync.js"
    "tests/verify_robustness.js"
    "tests/repro_shift.js"
    ".vscode/launch.json"
    "editors/vscode/.gitignore"
    "editors/vscode/icons/sommark-icon.svg"
    "editors/vscode/icons/sommark.png"
    "editors/vim/ftdetect/sommark.vim"
    "commit_lsp.sh"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        git add "$file"
        msg="add $file"
        # Simplify the message for better readability in git log
        msg=${msg//.\//} # remove ./ if present
        git commit -m "Created File: $msg"
    fi
done

echo "Successfully committed all files individually."
