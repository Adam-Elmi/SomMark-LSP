import { SemanticTokensBuilder } from 'vscode-languageserver/node.js';
import { TOKEN_TYPES, lexSync } from 'sommark';
import * as acorn from 'acorn';

// ========================================================================== //
//  1. Semantic Tokens Legend                                                 //
// ========================================================================== //
export const tokenTypes = [
    'keyword',     // Structural keywords
    'variable',    // Identifiers / variables
    'property',    // Props and keys
    'parameter',   // Parameters
    'string',      // Quoted string values
    'comment',     // Comments
    'operator',    // Operators and punctuation
    'punctuation', // Brackets, colons, etc.
    'function',    // Function names
    'method',      // Method names
    'number',      // Number literals
    'type',        // Types, CSS tags
    'class',       // Block identifiers
    'macro',       // Logic block markers (${ }$)
];
export const tokenModifiers = ['declaration', 'documentation', 'static', 'abstract'];

export const legend = { tokenTypes, tokenModifiers };

// ========================================================================== //
//  2. Position Helpers                                                       //
// ========================================================================== //

function positionToOffset(text, line, character) {
    const lines = text.split('\n');
    let offset = 0;
    for (let i = 0; i < line && i < lines.length; i++) {
        offset += lines[i].length + 1; // +1 for \n
    }
    return offset + character;
}

// ========================================================================== //
//  3. Main Highlighting Logic                                                //
// ========================================================================== //

export async function computeSemanticTokens(text) {
    const builder = new SemanticTokensBuilder();
    let lexerTokens = [];

    try {
        lexerTokens = lexSync(text) || [];
    } catch (e) {
        console.error("[Highlighting Error]:", e.message);
    }

    const allTokens = [];
    const sections = [];
    let inPVPrefix = false;
    let prevNonWs = null;

    // ======================================================================== //
    //  4. Process Lexer Tokens                                                 //
    // ======================================================================== //
    for (let i = 0; i < lexerTokens.length; i++) {
        const t = lexerTokens[i];
        let type = null;
        let modifiers = [];

        switch (t.type) {
            case TOKEN_TYPES.COMMENT:
            case TOKEN_TYPES.COMMENT_BLOCK:
                type = 'comment';
                break;

            case TOKEN_TYPES.IMPORT:
            case TOKEN_TYPES.USE_MODULE:
            case TOKEN_TYPES.END_KEYWORD:
            case TOKEN_TYPES.FOR_EACH:
            case TOKEN_TYPES.SLOT_KEYWORD:
                type = 'keyword';
                modifiers.push('declaration');
                break;

            case TOKEN_TYPES.STATIC_KEYWORD:
            case TOKEN_TYPES.RUNTIME_KEYWORD:
                type = 'keyword';
                modifiers.push('declaration');
                break;

            case TOKEN_TYPES.LOGIC_OPEN:
            case TOKEN_TYPES.LOGIC_CLOSE:
                type = 'macro';
                break;

            case TOKEN_TYPES.LOGIC: {
                const startOffset = positionToOffset(text, t.range.start.line, t.range.start.character);
                sections.push({ startOffset, content: t.value, grammar: 'javascript' });
                break;
            }

            case TOKEN_TYPES.IDENTIFIER:
                type = 'class';
                break;

            case TOKEN_TYPES.KEY:
                if (inPVPrefix) type = 'variable';
                else if (prevNonWs === TOKEN_TYPES.QUOTE) type = 'string';
                else type = 'property';
                break;

            case TOKEN_TYPES.QUOTE:
                type = 'string';
                break;

            case TOKEN_TYPES.VALUE: {
                if (prevNonWs === TOKEN_TYPES.QUOTE) {
                    type = 'string';
                } else {
                    const v = t.value.trim();
                    if (v === 'null') type = 'keyword';
                    else if (v === 'true' || v === 'false') type = 'keyword';
                    else if (v !== '' && !isNaN(v)) type = 'number';
                }
                break;
            }

            case TOKEN_TYPES.PREFIX_P:
            case TOKEN_TYPES.PREFIX_V:
                type = 'keyword';
                break;

            case TOKEN_TYPES.PREFIX_OPEN:
                inPVPrefix = true;
                type = 'keyword';
                break;

            case TOKEN_TYPES.PREFIX_CLOSE:
                inPVPrefix = false;
                type = 'keyword';
                break;

            case TOKEN_TYPES.ESCAPE:
            case TOKEN_TYPES.EXCLAMATION_MARK:
                type = 'macro';
                break;

            case TOKEN_TYPES.PIPELINE:
            case TOKEN_TYPES.COLON:
            case TOKEN_TYPES.COMMA:
            case TOKEN_TYPES.EQUAL:
                type = 'operator';
                break;

            case TOKEN_TYPES.OPEN_BRACKET:
            case TOKEN_TYPES.CLOSE_BRACKET:
                type = 'keyword';
                break;
        }

        if (t.type !== TOKEN_TYPES.WHITESPACE) prevNonWs = t.type;

        if (type) {
            const startLine = t.range.start.line;
            const startChar = t.range.start.character;
            const endLine = t.range.end.line;
            const endChar = t.range.end.character;
            const modifierBitmask = modifiers.reduce((mask, mod) => mask | (1 << tokenModifiers.indexOf(mod)), 0);

            if (startLine === endLine) {
                const length = endChar - startChar;
                if (length > 0) {
                    allTokens.push({ line: startLine, char: startChar, length, typeIndex: tokenTypes.indexOf(type), modifierBitmask, priority: 1 });
                }
            } else {
                for (let l = startLine; l <= endLine; l++) {
                    const lineText = text.split('\n')[l] || '';
                    const char = (l === startLine) ? startChar : 0;
                    const length = (l === endLine) ? endChar - char : lineText.length - char;
                    if (length > 0) {
                        allTokens.push({ line: l, char, length, typeIndex: tokenTypes.indexOf(type), modifierBitmask, priority: 1 });
                    }
                }
            }
        }
    }

    // ======================================================================== //
    //  5. JS Highlighting (Acorn)                                              //
    // ======================================================================== //
    for (const section of sections) {
        if (section.grammar === 'javascript') {
            highlightJS(section.content, section.startOffset, text, allTokens);
        }
    }

    // ======================================================================== //
    //  6. Post-Processing                                                      //
    // ======================================================================== //
    allTokens.sort((a, b) => {
        if (a.line !== b.line) return a.line - b.line;
        if (a.char !== b.char) return a.char - b.char;
        return b.priority - a.priority;
    });

    const filteredTokens = [];
    for (let i = 0; i < allTokens.length; i++) {
        const token = allTokens[i];
        let eclipsed = false;
        for (let j = 0; j < allTokens.length; j++) {
            const other = allTokens[j];
            if (other.line === token.line && other.priority > token.priority) {
                const tokenEnd = token.char + token.length;
                if (other.char < tokenEnd && (other.char + other.length) > token.char) {
                    eclipsed = true;
                    break;
                }
            }
        }
        if (!eclipsed) filteredTokens.push(token);
    }

    let lastLine = -1;
    let nextAvailableChar = -1;
    for (const token of filteredTokens) {
        if (token.line > lastLine) { lastLine = token.line; nextAvailableChar = 0; }
        if (token.char < nextAvailableChar) continue;
        builder.push(token.line, token.char, token.length, token.typeIndex, token.modifierBitmask);
        nextAvailableChar = token.char + token.length;
    }

    const result = builder.build();
    return { data: Array.from(result.data) };
}

// ========================================================================== //
//  7. JS Highlighter (Acorn)                                                 //
// ========================================================================== //

function highlightJS(code, startOffset, fullText, allTokens, priority = 3) {
    try {
        const tokens = Array.from(acorn.tokenizer(code, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            allowAwaitOutsideFunction: true,
            allowReturnOutsideFunction: true,
            allowImportExportEverywhere: true,
            onComment: (isBlock, text, start, end) => {
                addManualToken(allTokens, start + startOffset, end + startOffset, fullText, 'comment', priority);
            }
        }));

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const next = tokens[i + 1];
            const prev = tokens[i - 1];

            // Recursively highlight SomMark.static("...") or SomMark.static(`...`)
            const isSomMarkStatic = (
                token.type.label === 'name' &&
                token.value === 'SomMark' &&
                next && next.type.label === '.' &&
                tokens[i + 2] && tokens[i + 2].type.label === 'name' && tokens[i + 2].value === 'static' &&
                tokens[i + 3] && tokens[i + 3].type.label === '('
            );

            if (isSomMarkStatic) {
                const argToken = tokens[i + 4];
                if (argToken) {
                    let innerCode = null;
                    let innerStart = 0;
                    if (argToken.type.label === 'string') {
                        innerCode = code.slice(argToken.start + 1, argToken.end - 1);
                        innerStart = argToken.start + 1;
                    } else if (argToken.type.label === '`' && tokens[i + 5] && tokens[i + 5].type.label === 'template') {
                        const templateToken = tokens[i + 5];
                        innerCode = code.slice(templateToken.start, templateToken.end);
                        innerStart = templateToken.start;
                    }
                    if (innerCode !== null) {
                        highlightJS(innerCode, innerStart + startOffset, fullText, allTokens, priority + 1);
                    }
                }
            }

            let type = null;
            const label = token.type.label;

            if (token.type.keyword) {
                const name = code.slice(token.start, token.end);
                type = ['const', 'let', 'var', 'class', 'function', 'this', 'new'].includes(name) ? 'macro' : 'keyword';
            } else if (label === 'name') {
                const name = code.slice(token.start, token.end);
                if (['const', 'let', 'var'].includes(name)) {
                    type = 'macro';
                } else if (next && next.type.label === '(') {
                    type = prev && prev.type.label === 'new' ? 'class' : /^[A-Z]/.test(name) ? (name === name.toUpperCase() ? 'variable' : 'class') : 'function';
                } else if (prev && prev.type.label === 'class') type = 'class';
                else if (prev && prev.type.label === 'function') type = 'function';
                else if (prev && prev.type.label === '.') type = 'property';
                else if (next && next.type.label === ':') type = 'property';
                else if (['from', 'of', 'as', 'async', 'await', 'get', 'set', 'undefined'].includes(name)) type = 'keyword';
                else if (/^[A-Z]/.test(name)) type = name === name.toUpperCase() ? 'variable' : 'class';
                else type = 'variable';
            } else if (label === 'string' || label === 'template' || label === 'regexp' || label === '`') {
                type = 'string';
            } else if (label === 'num') {
                type = 'number';
            } else if (label === 'privateId') {
                type = 'property';
            } else if (label === '${') {
                type = 'macro';
            } else if (token.type.isAssign || label === 'operator' || label === 'prefix' || label === 'postfix' || ['?', ':', '??', '?.'].includes(label)) {
                type = 'operator';
            } else if (['(', ')', '{', '}', '[', ']', ',', ';', '.', '...'].includes(label)) {
                type = 'punctuation';
            }

            if (type) {
                addManualToken(allTokens, token.start + startOffset, token.end + startOffset, fullText, type, priority);
            }
        }
    } catch (e) {
        // Silently ignore JS parse errors for highlighting
    }
}

function addManualToken(allTokens, startOffset, endOffset, fullText, type, priority) {
    if (endOffset <= startOffset) return;

    const tokenText = fullText.slice(startOffset, endOffset);
    const textBefore = fullText.slice(0, startOffset);
    const linesBefore = textBefore.split('\n');
    const startLine = linesBefore.length - 1;
    const startChar = linesBefore[linesBefore.length - 1].length;

    const tokenLines = tokenText.split('\n');
    for (let i = 0; i < tokenLines.length; i++) {
        const lineContent = tokenLines[i];
        if (lineContent.length === 0) continue;
        allTokens.push({
            line: startLine + i,
            char: (i === 0) ? startChar : 0,
            length: lineContent.length,
            typeIndex: tokenTypes.indexOf(type),
            modifierBitmask: 0,
            priority
        });
    }
}
