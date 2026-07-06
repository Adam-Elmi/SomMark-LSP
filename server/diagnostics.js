import { DiagnosticSeverity } from "vscode-languageserver/node.js";
import SomMark, { preprocessRuntimeLogic } from "sommark";
import { findAndLoadConfigFresh, parseFileDirective } from "./config.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import * as acorn from 'acorn';

// ========================================================================== //
//  1. Document Validation Logic                                              //
// ========================================================================== //

let globalActivePromise = null;
let nextPendingValidation = null;

export async function validateTextDocument(connection, document) {
    // If a validation is already active, register/overwrite this as the next pending validation
    if (globalActivePromise) {
        nextPendingValidation = { connection, document };
        return;
    }

    // Set the active promise lock
    let resolveLock;
    globalActivePromise = new Promise(resolve => { resolveLock = resolve; });

    try {
        await doValidate(connection, document);
    } catch (err) {
        console.error("LSP Diagnostics Error: ", err);
    } finally {
        globalActivePromise = null;
        resolveLock();

        // If there's a pending validation, run it next
        if (nextPendingValidation) {
            const { connection: nextConn, document: nextDoc } = nextPendingValidation;
            nextPendingValidation = null;
            // Defer to the next tick to yield execution control
            setImmediate(() => validateTextDocument(nextConn, nextDoc));
        }
    }
}

async function findLSPConfig(filename) {
    let currentDir = path.dirname(filename);
    while (currentDir) {
        const configPath = path.join(currentDir, 'sommark.lsp.js');
        try {
            await fs.access(configPath);
            return configPath;
        } catch {
            const parent = path.dirname(currentDir);
            if (parent === currentDir) break;
            currentDir = parent;
        }
    }
    return null;
}

async function loadLspConfig(configPath) {
    if (!configPath) return {};
    try {
        const content = await fs.readFile(configPath, 'utf8');
        const match = content.match(/export\s+default\s+([\s\S]+)/);
        if (!match) return {};
        const valueExpr = match[1].replace(/;\s*$/, '');
        // eslint-disable-next-line no-new-func
        return new Function(`return (${valueExpr})`)() || {};
    } catch { return {}; }
}

// Match balanced parentheses up to 2 levels deep — handles args like
// SomMark.raw(JSON.stringify({...}, null, 2)) without leaving a stray ')'.
const BALANCED_ARGS = '(?:[^)(]|\\((?:[^)(]|\\([^)]*\\))*\\))*';

// Recursively walk the stub object and replace call sites in source.
// Functions → replaced with their return value (JSON-encoded).
// Plain objects → recurse with dotted prefix.
function applyLspStubs(text, stubs, prefix = '') {
    for (const [key, value] of Object.entries(stubs || {})) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'function') {
            try {
                const returnVal = value();
                const jsonVal = JSON.stringify(returnVal ?? null);
                const escaped = fullKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                text = text.replace(new RegExp(`${escaped}\\s*\\(${BALANCED_ARGS}\\)`, 'g'), jsonVal);
            } catch { /* skip bad stubs */ }
        } else if (value !== null && typeof value === 'object') {
            text = applyLspStubs(text, value, fullKey);
        }
    }
    return text;
}

function parseLspGlobals(stubs) {
    const globals = {};
    for (const [key, value] of Object.entries(stubs || {})) {
        // Include function stubs as no-op functions so SomMark's evaluator
        // recognises framework-injected globals (glob, getHeadings, etc.)
        // without the user having to list them in smark.config.js.
        if (typeof value === 'function') globals[key] = value;
        else if (value !== null) globals[key] = value ?? {};
    }
    return globals;
}

async function doValidate(connection, document) {
    const text = document.getText();
    const filename = document.uri.startsWith("file://") ? fileURLToPath(document.uri) : document.uri;

    const config = await findAndLoadConfigFresh(filename);
    const fileDirective = parseFileDirective(text, path.dirname(filename));
    const lspStubs = await loadLspConfig(await findLSPConfig(filename));
    const processedText = applyLspStubs(text, lspStubs);
    const configVars = config.variables || config.placeholders || {};
    const allVariables = { ...configVars, ...parseLspGlobals(lspStubs) };
    const diagnostics = [];
    const projectRoot = config.resolvedConfigPath
        ? path.dirname(config.resolvedConfigPath)
        : path.dirname(filename);

    const importAliases = {};
    for (const [key, value] of Object.entries(config.importAliases || {})) {
        importAliases[key] = path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
    }

    // Validate # @lsp directive values and report errors on line 0
    const KNOWN_FORMATS = new Set(["html", "markdown", "mdx", "xml", "json", "jsonc", "csv", "toml", "yaml", "text"]);
    const directiveRange = { start: { line: 0, character: 0 }, end: { line: 0, character: text.indexOf("\n") === -1 ? text.length : text.indexOf("\n") } };

    if (fileDirective.format && !KNOWN_FORMATS.has(fileDirective.format)) {
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: directiveRange,
            message: `Unknown format "${fileDirective.format}". Known formats: ${[...KNOWN_FORMATS].join(", ")}.`,
            source: "sommark"
        });
    }

    if (fileDirective.mapperFile) {
        try {
            await fs.access(fileDirective.mapperFile);
        } catch {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: directiveRange,
                message: `Mapper file not found: "${fileDirective.mapperFile}".`,
                source: "sommark"
            });
        }
    }

    if (diagnostics.length > 0) {
        connection.sendDiagnostics({ uri: document.uri, diagnostics });
        return;
    }

    // 1. SomMark Structural Validation
    const smark = new SomMark({
        src: processedText,
        format: fileDirective.format || config.format || "html",
        filename: filename,
        mapperFile: fileDirective.mapperFile || config.mapperFile || config.mappingFile,
        placeholders: config.placeholders || config.placeholder || {},
        variables: allVariables,
        importAliases
    });

    let ast = null;
    try {
        ast = await smark.parse();
    } catch (error) {
        diagnostics.push(parseSomMarkError(error, text));
    }

    if (smark.warnings && smark.warnings.length > 0) {
        smark.warnings.forEach(w => {
            diagnostics.push(parseSomMarkWarning(w, text));
        });
    }

    // 2. Transpile — catches JS runtime errors from static blocks and transpiler-level errors.
    // SomMark handles scoping (loop vars, etc.) correctly, so no manual scope tracking needed.
    if (ast) {
        try {
            await smark.transpile();
        } catch (error) {
            diagnostics.push(parseSomMarkError(error, text));
        }
    }

    // 3. Collect JS Logic Blocks for Acorn syntax check + runtime preprocessor
    const logicBlocksToValidate = [];

    if (ast) {
        const collected = [];
        collectLogicNodes(ast, collected);
        for (const entry of collected) {
            const nodeStartOffset = positionToOffset(text, entry.node.range.start);
            const offset = text.indexOf("${", nodeStartOffset) + 2;
            logicBlocksToValidate.push({
                code: entry.node.code,
                offset,
                isRuntime: entry.node.type === "RuntimeLogic",
            });
        }
    } else {
        // Fallback to regex when structural parse fails
        const jsRegex = /\$\{([\s\S]*?)\}\$/g;
        let match;
        while ((match = jsRegex.exec(text)) !== null) {
            const jsCode = match[1];
            const offset = match.index + 2;
            const beforeBlock = text.slice(0, match.index).trim();
            const isRuntime = !beforeBlock.endsWith("static");
            logicBlocksToValidate.push({ code: jsCode, offset, isRuntime });
        }
    }

    for (const block of logicBlocksToValidate) {
        if (!block.code?.trim()) continue;

        // Acorn: catch syntax errors in every block
        let syntaxValid = false;
        try {
            acorn.parse(block.code, { ecmaVersion: 'latest', sourceType: 'module', allowReturnOutsideFunction: true });
            syntaxValid = true;
        } catch (e) {
            // Retry as a parenthesised expression — handles {obj} and [arr] literals
            // which are ambiguous in statement context ({} = block, not object).
            try {
                acorn.parse(`(${block.code.trim()})`, { ecmaVersion: 'latest', sourceType: 'module' });
                syntaxValid = true;
            } catch {
                const diag = acornToLSPDiagnostic(e, block.code, block.offset, text);
                if (diag) diagnostics.push(diag);
            }
        }

        // Preprocessor: validate runtime blocks for SomMark.import / SomMark.static usage.
        // SomMark.static requires an active evaluator (only live during smark.transpile above);
        // those errors are already caught in step 2. Ignore them here to avoid false positives.
        if (syntaxValid && block.isRuntime) {
            try {
                await preprocessRuntimeLogic(block.code, filename, config.security || {});
            } catch (e) {
                const msg = typeof e === 'string' ? e : (e?.message ?? '');
                if (msg.includes("No active EvaluatorState")) continue;
                const diag = preprocessorToLSPDiagnostic(e, block.code, block.offset, text);
                if (diag) diagnostics.push(diag);
            }
        }
    }

    // 4. smark-syntax embedded language validation
    const SUPPORTED_SYNTAX_LANGS = new Set(["js", "css"]);
    if (ast) {
        const syntaxBlocks = collectSyntaxBlocks(ast);
        for (const block of syntaxBlocks) {
            const lang = block.lang;
            const bodyLine = block.node.range?.start?.line ?? 0;
            const blockRange = clampRange(text, bodyLine, 0, bodyLine, 100);

            if (!SUPPORTED_SYNTAX_LANGS.has(lang)) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: blockRange,
                    message: `[LSP] Unsupported smark-syntax language "${lang}". Supported: ${[...SUPPORTED_SYNTAX_LANGS].join(", ")}.`,
                    source: "sommark-lsp"
                });
                continue;
            }

            const body = block.node.body?.map(n => String(n.text || "")).join("") || "";
            if (!body.trim()) continue;

            const bodyOffset = positionToOffset(text, { line: bodyLine + 1, character: 0 });

            if (lang === "js") {
                try {
                    acorn.parse(body, { ecmaVersion: "latest", sourceType: "module", allowReturnOutsideFunction: true });
                } catch (e) {
                    const diag = acornToLSPDiagnostic(e, body, bodyOffset, text);
                    if (diag) diagnostics.push({ ...diag, source: "sommark-lsp" });
                }
            } else if (lang === "css") {
                try {
                    const csstree = await import("css-tree");
                    csstree.parse(body, {
                        onParseError(e) {
                            const errLine = bodyLine + 1 + (e.line - 1);
                            const errChar = e.column - 1;
                            const range = clampRange(text, errLine, errChar, errLine, errChar + 10);
                            diagnostics.push({
                                severity: DiagnosticSeverity.Error,
                                range,
                                message: `[LSP] CSS: ${e.message}`,
                                source: "sommark-lsp"
                            });
                        }
                    });
                } catch { /* import failure — css-tree unavailable */ }
            }
        }
    }

    connection.sendDiagnostics({ uri: document.uri, diagnostics });
}

function collectSyntaxBlocks(nodes, result = []) {
    if (!nodes) return result;
    const array = Array.isArray(nodes) ? nodes : [nodes];
    for (const node of array) {
        if (!node) continue;
        if (node.type === "Block") {
            const isRaw = node.directives?.raw === "true" || node.directives?.raw === true;
            const lang = node.directives?.syntax;
            if (isRaw && lang) {
                result.push({ node, lang: String(lang).toLowerCase().replace(/['"]/g, "") });
            }
        }
        if (node.body) collectSyntaxBlocks(node.body, result);
    }
    return result;
}

function acornToLSPDiagnostic(e, code, offset, fullText) {
    if (!e.loc) return null;

    // Acorn loc is relative to the block
    // We need to convert it to absolute
    const startPos = offsetToPosition(fullText, offset + e.pos);

    return {
        severity: DiagnosticSeverity.Error,
        range: clampRange(fullText, startPos.line, startPos.character, startPos.line, startPos.character + 1),
        message: `[JS Error]: ${e.message.replace(/\s\(\d+:\d+\)$/, "")}`,
        source: 'acorn'
    };
}

function preprocessorToLSPDiagnostic(e, code, offset, fullText) {
    const cleanError = stripColors(e);

    let targetOffset = offset;
    let targetLength = 1;

    try {
        const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', allowReturnOutsideFunction: true });
        const matches = [];

        function traverse(node) {
            if (!node || typeof node !== "object") return;
            if (
                node.type === "CallExpression" &&
                node.callee.type === "MemberExpression" &&
                node.callee.object.name === "SomMark" &&
                node.arguments.length > 0
            ) {
                const propName = node.callee.property.name;
                if (propName === "static" || propName === "import") {
                    matches.push(node);
                }
            }
            for (const key of Object.keys(node)) {
                const child = node[key];
                if (Array.isArray(child)) {
                    for (const item of child) traverse(item);
                } else {
                    traverse(child);
                }
            }
        }
        traverse(ast);

        const staticMatches = matches.filter(m => m.callee.property.name === "static");
        const importMatches = matches.filter(m => m.callee.property.name === "import");

        let matchedNode = null;
        if (cleanError.includes("SomMark.static") || cleanError.includes("Static Code")) {
            if (staticMatches.length === 1) {
                matchedNode = staticMatches[0];
            } else {
                for (const match of staticMatches) {
                    const argNode = match.arguments[0];
                    let argValue = "";
                    if (argNode.type === "Literal") {
                        argValue = String(argNode.value);
                    } else if (argNode.type === "TemplateLiteral") {
                        argValue = argNode.quasis.map((q) => q.value.cooked).join("");
                    }
                    if (argValue && cleanError.includes(argValue.trim())) {
                        matchedNode = match;
                        break;
                    }
                }
            }
        } else if (cleanError.includes("SomMark.import") || cleanError.includes("JSON Parse Error")) {
            if (importMatches.length === 1) {
                matchedNode = importMatches[0];
            } else {
                for (const match of importMatches) {
                    const argNode = match.arguments[0];
                    let argValue = "";
                    if (argNode.type === "Literal") {
                        argValue = String(argNode.value);
                    } else if (argNode.type === "TemplateLiteral") {
                        argValue = argNode.quasis.map((q) => q.value.cooked).join("");
                    }
                    if (argValue && cleanError.includes(argValue.trim())) {
                        matchedNode = match;
                        break;
                    }
                }
            }
        }

        if (matchedNode) {
            targetOffset = offset + matchedNode.start;
            targetLength = matchedNode.end - matchedNode.start;
        }
    } catch (acornErr) {
        // Fall back to block offset
    }

    const startPos = offsetToPosition(fullText, targetOffset);
    const endPos = offsetToPosition(fullText, targetOffset + targetLength);

    return {
        severity: DiagnosticSeverity.Error,
        range: clampRange(fullText, startPos.line, startPos.character, endPos.line, endPos.character),
        message: cleanError,
        source: 'sommark-preprocessor'
    };
}


function offsetToPosition(text, offset) {
    const textBefore = text.slice(0, offset);
    const lines = textBefore.split('\n');
    return {
        line: lines.length - 1,
        character: lines[lines.length - 1].length
    };
}

function positionToOffset(text, position) {
    if (!position) return 0;
    const lines = text.split('\n');
    let offset = 0;
    for (let i = 0; i < position.line; i++) {
        if (lines[i] !== undefined) {
            offset += lines[i].length + 1; // +1 for the newline character
        }
    }
    offset += position.character;
    return offset;
}

export function clampRange(text, startLine, startChar, endLine, endChar) {
    const lines = text.split('\n');
    
    let sL = Math.max(0, Math.min(startLine, lines.length - 1));
    let sC = Math.max(0, Math.min(startChar, (lines[sL] || "").length));
    
    let eL = Math.max(0, Math.min(endLine, lines.length - 1));
    let eC = Math.max(0, Math.min(endChar, (lines[eL] || "").length));
    
    // Ensure start is before end
    if (sL > eL || (sL === eL && sC > eC)) {
        const tempL = sL; const tempC = sC;
        sL = eL; sC = eC;
        eL = tempL; eC = tempC;
    }
    
    // Ensure the range spans at least 1 character if possible, to make highlighting visible
    if (sL === eL && sC === eC) {
        if (sC < (lines[sL] || "").length) {
            eC++;
        } else if (sL < lines.length - 1) {
            eL++;
            eC = 0;
        } else if (sC > 0) {
            sC--;
        }
    }
    
    return {
        start: { line: sL, character: sC },
        end: { line: eL, character: eC }
    };
}


function collectLogicNodes(nodes, result = []) {
    if (!nodes) return result;
    const array = Array.isArray(nodes) ? nodes : [nodes];
    for (const node of array) {
        if (!node) continue;
        if (node.type === "StaticLogic" || node.type === "RuntimeLogic") {
            result.push({ node });
        }
        if (node.props) {
            for (const key in node.props) {
                const val = node.props[key];
                if (val && typeof val === "object") collectLogicNodes(val, result);
            }
        }
        if (node.body) collectLogicNodes(node.body, result);
    }
    return result;
}

export function parseSomMarkError(error, text) {
    const cleanError = stripColors(error);
    const multiLineMatch = cleanError.match(/from line\s*(\d+),\s*column\s*(\d+)\s*to line\s*(\d+),\s*column\s*(\d+)/i);
    const singleLineMatch = cleanError.match(/at line\s*(\d+),\s*from column\s*(\d+)\s*to\s*(?:column\s*)?(\d+)/i);
    const simpleLineMatch = cleanError.match(/at line\s*(\d+)/i);

    let startLine = 0, startChar = 0, endLine = 0, endChar = 1;
    if (multiLineMatch) {
        startLine = parseInt(multiLineMatch[1]) - 1;
        startChar = parseInt(multiLineMatch[2]) - 1;
        endLine = parseInt(multiLineMatch[3]) - 1;
        endChar = parseInt(multiLineMatch[4]);
    } else if (singleLineMatch) {
        startLine = parseInt(singleLineMatch[1]) - 1;
        startChar = parseInt(singleLineMatch[2]) - 1;
        endLine = startLine;
        endChar = parseInt(singleLineMatch[3]);
    } else if (simpleLineMatch) {
        startLine = parseInt(simpleLineMatch[1]) - 1;
        startChar = 0;
        endLine = startLine;
        endChar = 1;
    }
    const range = clampRange(text, startLine, startChar, endLine, endChar);
    
    // Strip position coordinates — already encoded in the diagnostic range
    const message = cleanError
        .replace(/\s*from line\s*\d+,\s*column\s*\d+\s*to line\s*\d+,\s*column\s*\d+/gi, '')
        .replace(/\s*at line\s*\d+,\s*from column\s*\d+\s*to\s*(?:column\s*)?\d+/gi, '')
        .replace(/\s*at line\s*\d+/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return { severity: DiagnosticSeverity.Error, range, message, source: 'sommark' };
}

export function parseSomMarkWarning(w, text) {
    if (w && typeof w === "object") {
        const message = stripColors(w.message || "");
        const line = w.range?.start?.line ?? 0;
        const range = clampRange(text, line, 0, line, 100);
        return { severity: DiagnosticSeverity.Warning, range, message, source: "sommark" };
    }
    const cleanWarning = stripColors(w);
    const lineMatch = cleanWarning.match(/at line\s*(\d+)/i);
    const line = lineMatch ? parseInt(lineMatch[1]) - 1 : 0;
    const range = clampRange(text, line, 0, line, 100);
    return { severity: DiagnosticSeverity.Warning, range, message: cleanWarning, source: "sommark" };
}

// ========================================================================== //
//  3. Utility: Strip ANSI & Formatting                                       //
// ========================================================================== //
function stripColors(text) {
    if (Array.isArray(text)) text = text.join("");
    if (typeof text !== 'string') return String(text);
    return text
        .replace(/\x1b\[[0-9;]*m/g, '') // Strip ANSI escape codes
        .replace(/<\$[^:]+:([\s\S]*?)\$>/g, '$1') // Strip custom tags
        .replace(/-{10,}/g, '') // Strip long CLI borders (---)
        .replace(/\{line\}/g, '\n')
        .replace(/\{N\}/g, '\n')
        .trim();
}

