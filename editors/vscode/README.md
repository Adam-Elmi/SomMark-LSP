# SomMark Support for VS Code

This is the official SomMark Language Server extension for **Visual Studio Code**. It provides native integration with features like real-time diagnostics, semantic syntax highlighting, and automatic code formatting.

![SomMark in VS Code](../../screenshots/vscode.png)

## Features
- **Semantic Highlighting**: Accurate coloring for tags, identifiers, and block content directly from the Language Server.
- **Real-time Diagnostics**: Instantly shows syntax errors and build failures as you type (squiggled red lines).
- **Embedded Languages**: Beautiful syntax highlighting inside your logic blocks for JS, CSS, Python, SQL, and 70+ other languages!

## Installation (Recommended)

You can easily install this extension directly from within VS Code:
1. Open VS Code.
2. Open the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
3. Search for **"SomMark Language Server"**.
4. Click **Install**.

That's it! Open any `.smark` file and the Language Server will automatically boot up.

---

## For Developers (Local Build)

If you are developing the extension or want to install an unreleased version from source, you can package it locally:

1. Open your terminal and navigate to this directory.
2. Run the following commands to bundle and install the `.vsix` file:
```bash
cd editors/vscode
npm install
npx vsce package
code --install-extension sommark-lsp-*.vsix
```
