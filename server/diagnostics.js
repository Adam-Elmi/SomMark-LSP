import { DiagnosticSeverity } from "vscode-languageserver/node.js";
import SomMark, { preprocessRuntimeLogic } from "sommark";
import { findAndLoadConfigFresh } from "./config.js";
import { fileURLToPath, pathToFileURL } from "node:url";
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
            return await fs.readFile(configPath, 'utf8');
        } catch {
            const parent = path.dirname(currentDir);
            if (parent === currentDir) break;
            currentDir = parent;
        }
    }
    return null;
}

function buildGlobalsPreamble(lspConfigContent) {
    if (!lspConfigContent || !lspConfigContent.trim()) return '';
    try {
        const ast = acorn.parse(lspConfigContent, { ecmaVersion: 'latest', sourceType: 'module' });
        if (!ast.body || ast.body.length === 0) return '';
    } catch {
        return '';
    }
    const body = lspConfigContent.replace(/export\s+default/, '').replace(/;\s*$/, '');
    return `Object.assign(globalThis, (${body}));\n`;
}

async function doValidate(connection, document) {
    const text = document.getText();
    const filename = document.uri.startsWith("file://") ? fileURLToPath(document.uri) : document.uri;

    const config = await findAndLoadConfigFresh(filename);
    const globalsPreamble = buildGlobalsPreamble(await findLSPConfig(filename));
    const diagnostics = [];

    // 1. SomMark Structural Validation
    const smark = new SomMark({
        src: text,
        format: config.format || "html",
        filename: filename,
        mapperFile: config.mapperFile || config.mappingFile,
        placeholders: config.placeholders || config.placeholder || {}
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

    // 2. Collect JS Logic Blocks
    const logicBlocksToValidate = [];

    if (ast) {
        // Collect exact nodes from the AST along with active loop scopes
        const collected = [];
        collectLogicNodes(ast, collected);
        for (const entry of collected) {
            const nodeStartOffset = positionToOffset(text, entry.node.range.start);
            const offset = text.indexOf("${", nodeStartOffset) + 2;
            logicBlocksToValidate.push({
                code: entry.node.code,
                offset,
                isRuntime: entry.node.type === "RuntimeLogic",
                loopVars: entry.loopVars
            });
        }
    } else {
        // Fallback to regex when structural parse fails
        const jsRegex = /\$\{([\s\S]*?)\}\$/g;
        let match;
        while ((match = jsRegex.exec(text)) !== null) {
            const jsCode = match[1];
            const offset = match.index + 2; // ${
            const beforeBlock = text.slice(0, match.index).trim();
            const isRuntime = !beforeBlock.endsWith("static");
            logicBlocksToValidate.push({
                code: jsCode,
                offset,
                isRuntime
            });
        }
    }

    // 3. Embedded JS Validation (Logic Blocks only)
    if (logicBlocksToValidate.length > 0) {
        const baseDir = path.dirname(filename);
        const Evaluator = (await import("sommark")).Evaluator;

        try {
            // Lazy initialization of Evaluator VM for this validation cycle
            Evaluator.destroy();
            await Evaluator.init(baseDir);

            for (const block of logicBlocksToValidate) {
                if (block.code && block.code.trim()) {
                    // First check syntax with Acorn (allowing top-level return for static blocks)
                    let syntaxValid = false;
                    try {
                        acorn.parse(block.code, { ecmaVersion: 'latest', sourceType: 'module', allowReturnOutsideFunction: true });
                        syntaxValid = true;
                    } catch (e) {
                        const diag = acornToLSPDiagnostic(e, block.code, block.offset, text);
                        if (diag) diagnostics.push(diag);
                    }

                    // If syntax is valid, check runtime errors with QuickJS (ONLY for static logic blocks!)
                    if (syntaxValid && !block.isRuntime) {
                        try {
                            if (block.loopVars && block.loopVars.length > 0) {
                                const mockVars = {};
                                for (const v of block.loopVars) {
                                    mockVars[v] = {};
                                }
                                Evaluator.inject(mockVars);
                            }
                            await Evaluator.execute(globalsPreamble + block.code);
                        } catch (e) {
                            const preambleLines = (globalsPreamble.match(/\n/g) || []).length;
                            const diag = quickJSToLSPDiagnostic(e, block.code, block.offset, text, preambleLines);
                            if (diag) diagnostics.push(diag);
                        }
                    }

                    // If it is a runtime block, run the preprocessor to check compile-time static/import errors!
                    if (syntaxValid && block.isRuntime) {
                        try {
                            await preprocessRuntimeLogic(block.code, filename, config.security || {});
                        } catch (e) {
                            const diag = preprocessorToLSPDiagnostic(e, block.code, block.offset, text);
                            if (diag) diagnostics.push(diag);
                        }
                    }
                }
            }
        } finally {
            // ALWAYS destroy and clean up the Evaluator VM instance at the end of the validation cycle
            Evaluator.destroy();
        }
    }

    connection.sendDiagnostics({ uri: document.uri, diagnostics });
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

    let shortMessage = cleanError;
    if (shortMessage.includes('\n')) {
        const lines = shortMessage.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines[0] === "[Transpiler Error]:" && lines[1]) {
            shortMessage = `${lines[0]} ${lines[1]}`;
        } else {
            shortMessage = lines[0];
        }
    }

    return {
        severity: DiagnosticSeverity.Error,
        range: clampRange(fullText, startPos.line, startPos.character, endPos.line, endPos.character),
        message: shortMessage,
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


function collectLogicNodes(nodes, result = [], activeLoopVars = []) {
    if (!nodes) return result;
    const array = Array.isArray(nodes) ? nodes : [nodes];
    for (const node of array) {
        if (!node) continue;

        let newLoopVars = [...activeLoopVars];
        if (node.type === "ForEach") {
            let asVar = "item";
            if (node.args) {
                if (typeof node.args.as === "string") {
                    asVar = node.args.as;
                } else if (node.args.as && typeof node.args.as === "object") {
                    asVar = node.args.as.value || "item";
                }
            }
            newLoopVars.push(asVar);
        }

        if (node.type === "StaticLogic" || node.type === "RuntimeLogic") {
            result.push({
                node,
                loopVars: activeLoopVars
            });
        }
        if (node.args) {
            for (const key in node.args) {
                const val = node.args[key];
                if (val && typeof val === "object") {
                    collectLogicNodes(val, result, newLoopVars);
                }
            }
        }
        if (node.body) {
            collectLogicNodes(node.body, result, newLoopVars);
        }
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
    
    let shortMessage = cleanError;
    // Extract just the core error reason instead of the huge multiline snippet (fixes Zed inline rendering)
    const msgMatch = cleanError.match(/\n([^\n]+)\s+at line\s*\d+/i);
    if (msgMatch) {
        shortMessage = msgMatch[1].trim();
    }
    
    return { severity: DiagnosticSeverity.Error, range, message: shortMessage, source: 'sommark' };
}

export function parseSomMarkWarning(w, text) {
    const cleanWarning = stripColors(w);
    const lineMatch = cleanWarning.match(/at line\s*(\d+)/i);
    let line = lineMatch ? parseInt(lineMatch[1]) - 1 : 0;
    const range = clampRange(text, line, 0, line, 100);
    return {
        severity: DiagnosticSeverity.Warning,
        range,
        message: cleanWarning,
        source: 'sommark'
    };
}

function quickJSToLSPDiagnostic(e, code, offset, fullText, preambleLines = 0) {
    let startPos;
    if (e.line !== undefined) {
        // QuickJS line is 1-indexed and relative to the full executed code
        // (preamble + block.code). Subtract preamble lines to get the position
        // within block.code only.
        const codeRelativeLine = e.line - preambleLines;
        if (codeRelativeLine < 1) {
            startPos = offsetToPosition(fullText, offset);
        } else {
            const lines = code.split('\n');
            let relativeOffset = 0;
            for (let i = 0; i < codeRelativeLine - 1; i++) {
                if (lines[i] !== undefined) relativeOffset += lines[i].length + 1;
            }
            relativeOffset += (e.column !== undefined ? e.column - 1 : 0);
            startPos = offsetToPosition(fullText, offset + relativeOffset);
        }
    } else {
        startPos = offsetToPosition(fullText, offset);
    }

    const range = clampRange(fullText, startPos.line, startPos.character, startPos.line, startPos.character + 1);

    return {
        severity: DiagnosticSeverity.Error,
        range,
        message: `[Runtime Error]: ${e.message}`,
        source: 'quickjs'
    };
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

