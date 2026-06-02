# SomMark Support for Zed

This directory contains the official SomMark Language Server extension for the [Zed Editor](https://zed.dev/).

![SomMark in Zed](../../screenshots/zed.png)

## Installation Instructions

Because this extension is currently in development (unreleased), you will need to install it locally as a Dev Extension in Zed.

### 1. Compile the Extension
Before Zed can load the extension, it must be compiled into WebAssembly.
Open your terminal, navigate to this directory (`editors/zed-sommark`), and run:
```bash
cargo build --target wasm32-wasip1 --release
```
*(Note: You must have Rust installed with the `wasm32-wasip1` target added via `rustup target add wasm32-wasip1`)*

### 2. Install into Zed
Once compiled, you can load it directly into Zed:
1. Open Zed.
2. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac).
3. Search for and run the command: **`zed: install dev extension`**
4. A file browser will open. Navigate to this `editors/zed-sommark` directory and select it.

That's it! Zed will instantly load the extension, attach the `sommark-lsp` server to any `.smark` files you open, and provide full syntax highlighting and real-time diagnostics.
