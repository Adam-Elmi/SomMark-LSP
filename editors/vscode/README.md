# SomMark Language Server

A VS Code extension for the SomMark language. It provides features like real-time diagnostics, semantic syntax highlighting, and automatic code formatting.

## Features

- **Semantic Highlighting**: Accurate coloring for tags, identifiers, and block content.
- **Dynamic Syntax Injection**: "Borrow" syntax highlighting for 70+ languages (JavaScript, CSS, Python, SQL, etc.) inside `@_Code_@`, `@_Style_@`, and `@_Script_@` blocks.
- **Real-time Diagnostics**: Shows syntax errors as you type.
- **Code Formatting**: Automatic formatting for your SomMark files using the Format Document command.


## Configuration

The extension works automatically without any extra settings.

## Requirements

- VS Code version 1.104.0 or higher.
- Files must end with .smark.
 

## For Developers

To test the extension locally:

1. Open the `editors/vscode` folder in VS Code.
2. Run `npm install` in your terminal.
3. Press F5 to start a new window with the extension active.

---
Created by [Adam-Elmi](https://github.com/Adam-Elmi)
