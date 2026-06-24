# SomMark LSP <img src="icons/sommark.png" width="80" align="right" alt="SomMark Logo">

A Language Server for **SomMark** (`.smark` files) that adds real-time error checking, semantic syntax highlighting, and embedded JavaScript validation to your editor.

---

## What It Does

When you open a `.smark` file, the language server:

- **Checks SomMark structure** — reports unknown tags, missing `[end]` keywords, malformed block arguments, and similar structural errors as you type.
- **Validates embedded JavaScript** — logic blocks (`${ ... }$`) are parsed for syntax errors using Acorn, and static blocks are also executed inside an isolated QuickJS sandbox to catch runtime errors before you even run the file.
- **Provides semantic highlighting** — every token (block identifiers, keywords, keys, values, logic markers, comments, operators) gets a meaningful color from the language server rather than relying on basic TextMate patterns.

---

## Installation

Install the language server globally:

```bash
npm install -g sommark-lsp
```

This puts the `sommark-lsp` binary on your PATH, which editors use to start the server.

---

## Editor Setup

| Editor | Guide | Notes |
|--------|-------|-------|
| VS Code | [editors/vscode/README.md](editors/vscode/README.md) | |
| Neovim | [editors/neovim/README.md](editors/neovim/README.md) | |
| Vim | [editors/vim/README.md](editors/vim/README.md) | |
| Zed | [editors/zed-sommark/README.md](editors/zed-sommark/README.md) | Requires Rust + `rustup target add wasm32-wasip1` |

---

## Project Configuration — `smark.config.js`

Place a `smark.config.js` file in your project root (or any parent directory). The language server walks up the directory tree from the open file to find it.

```js
// smark.config.js
export default {
    format: "html",           // Output format passed to the SomMark compiler
    placeholders: {           // Values injected into ${placeholder} expressions
        siteName: "My App",
        version: "1.0.0"
    },
    mapperFile: "./mapper.js" // Optional: module that maps custom block names
};
```

All fields are optional. If no config file is found, the server uses safe defaults.

---

## LSP Global Mocks — `sommark.lsp.js`

Some SomMark frameworks inject global variables into the runtime that the language server does not know about. For example, **SomMark-Web** makes a `PKG` object available inside every logic block without any import statement. The server's JavaScript validator (QuickJS) will report a `ReferenceError` for these identifiers because it runs in isolation.

To fix this, create a `sommark.lsp.js` file anywhere in your project tree (the server searches upward from each open file, just like `smark.config.js`):

```js
// sommark.lsp.js
export default {
    PKG: {
        import: async () => ({}),
        resolve: (path) => path
    },
    db: {
        query: async () => [],
        find:  async () => null
    },
    auth: {
        user: () => null
    }
}
```

**How it works:** The server reads this file, strips the `export default`, and turns it into:

```js
Object.assign(globalThis, ({ PKG: {...}, db: {...}, auth: {...} }));
```

This line runs inside QuickJS before your logic block code, so the sandbox already has those names defined. The values are mock stubs — their only purpose is to prevent false `ReferenceError` diagnostics. They are never used in actual output.

**Rules:**
- The file must export a plain object literal as its default export.
- Values can include functions (they run natively inside QuickJS, not serialized).
- If the file is empty or contains only comments, it is silently ignored.
- The file is re-read from disk on every validation cycle — no restart needed after editing it.

---

## How Validation Works

For each logic block in the document, the server runs two passes:

1. **Acorn (syntax check)** — Parses the block as a JavaScript module. Reports syntax errors immediately with exact position. This runs for both `static` and `runtime` blocks.

2. **QuickJS (runtime check)** — Only runs for `static` blocks. Executes the block code inside a sandboxed QuickJS VM. Catches `ReferenceError`, `TypeError`, failed `SomMark.import()` calls, and other runtime problems. Runtime blocks are skipped here because their logic depends on request-time data that does not exist at edit time.

Errors from both passes are shown as red squiggles pointing to the exact character where the problem is.

---

## Semantic Token Types

The server assigns the following token types (visible in editors that support LSP semantic highlighting):

| Type | What it highlights |
|------|--------------------|
| `keyword` | `[import]`, `[end]`, `static`, `runtime`, `p{}`, `v{}`, `null`, `true`, `false` |
| `class` | Block identifiers (`[myBlock]`) |
| `property` | Block argument keys |
| `variable` | Keys inside `p{}` / `v{}` prefix expressions |
| `string` | Quoted keys, quoted values |
| `number` | Numeric values |
| `comment` | `//` and `/* */` comments |
| `macro` | `${`, `}$`, `!`, escape sequences |
| `operator` | `:`, `=`, `,`, `\|` |
| `function` | JS function calls inside logic blocks |
| `variable` | JS variable names inside logic blocks |
| `string` | JS string / template literals inside logic blocks |
| `number` | JS numeric literals inside logic blocks |

---

## License

MIT
