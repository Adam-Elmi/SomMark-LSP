# SomMark Language Server (VS Code Extension)

This extension provides real-time diagnostics and semantic highlighting for SomMark files (`.smark`) using the **SomMark-LSP** server.

## Features
- **Diagnostics**: Real-time syntax error reporting.
- **Semantic Highlighting**: Advanced coloring for tags, identifiers, and block content.

## Setup for Development

1. Open this folder in VS Code: `editors/vscode`.
2. Run `npm install`.
3. Press **F5** (or `Debug > Start Debugging`) to launch a new "Extension Development Host" window.
4. Open a `.smark` file to see the LSP in action.

## Distributing the Extension

### 1. Local Installation (.vsix)
To create an installable package for yourself or friends:

1. Install `vsce` globally:
   ```bash
   npm install -g @vscode/vsce
   ```
2. Package the extension:
   ```bash
   vsce package
   ```
3. Install the resulting `.vsix` file in VS Code (`Extensions > ... > Install from VSIX...`).

### 2. Publishing to the Marketplace
To share with the world:

1. Create an account on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/).
2. Create a Publisher.
3. Get a Personal Access Token (PAT) from Azure DevOps.
4. Login via CLI:
   ```bash
   vsce login <publisher-name>
   ```
5. Publish:
   ```bash
   vsce publish
   ```

## Configuration
The extension is pre-configured to find the LSP server in the `server/` directory of the `SomMark-LSP` project.
