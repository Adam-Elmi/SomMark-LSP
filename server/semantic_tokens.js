import { SemanticTokensBuilder } from 'vscode-languageserver/node.js';
import { TOKEN_TYPES, lexSync } from 'sommark';
import * as acorn from 'acorn';
import * as csstree from 'css-tree';

// ========================================================================== //
//  1. Semantic Tokens Legend                                                 //
// ========================================================================== //
export const tokenTypes = [
    'keyword',     // Standard keywords
    'variable',    // Identifiers
    'property',    // Object properties, CSS properties
    'parameter',   // Function parameters
    'string',      // Strings
    'comment',     // Comments
    'operator',    // Operators
    'punctuation', // Brackets, colons, etc.
    'function',    // Function names
    'method',      // Method names
    'number',      // Numbers
    'type',        // Types, CSS tags
    'class',       // Classes, SomMark IDs
    'macro'        // Macros
];
export const tokenModifiers = ['declaration', 'documentation', 'static', 'abstract'];

export const legend = {
    tokenTypes,
    tokenModifiers
};

// ========================================================================== //
//  2. Main Highlighting Logic                                                //
// ========================================================================== //

function offsetToPosition(text, offset) {
    const textBefore = text.slice(0, offset);
    const linesBefore = textBefore.split('\n');
    return {
        line: linesBefore.length - 1,
        character: linesBefore[linesBefore.length - 1].length
    };
}

function correctLexerTokens(lexerTokens, text) {
    const logicRegex = /(\$\{)([\s\S]*?)(\}\$)/g;
    const logicBlocks = [];
    let match;
    while ((match = logicRegex.exec(text)) !== null) {
        const startPos = offsetToPosition(text, match.index);
        const endPos = offsetToPosition(text, match.index + match[0].length);
        logicBlocks.push({
            start: startPos,
            end: endPos,
            isSingleLine: startPos.line === endPos.line
        });
    }

    for (const t of lexerTokens) {
        if (!t.range || !t.range.start || !t.range.end) continue;

        const line = t.range.start.line;
        let totalShift = 0;
        for (const block of logicBlocks) {
            if (block.end.line === line) {
                const shiftIntroduced = block.isSingleLine ? 4 : 2;
                const reportedEndChar = block.end.character - shiftIntroduced;
                if (t.range.start.character >= reportedEndChar) {
                    totalShift += shiftIntroduced;
                }
            }
        }

        if (totalShift > 0) {
            t.range.start.character += totalShift;
            t.range.end.character += totalShift;
        }
    }
}

export async function computeSemanticTokens(text) {
    const builder = new SemanticTokensBuilder();
    let lexerTokens = [];

    try {
        lexerTokens = lexSync(text) || [];
        correctLexerTokens(lexerTokens, text);
    } catch (e) {
        console.error("[Highlighting Error]:", e.message);
    }

    const allTokens = [];

    // ========================================================================== //
    //  3. Collect JS/CSS sections using Regex                                   //
    // ========================================================================== //
    const sections = [];

    // JS Blocks: @_script_@ ... @_end_@ or @_js_@ ... @_end_@
    const jsRegex = /@_(?:script|js)_@(?:;\s*)?([\s\S]*?)@_end_@/g;
    let match;
    while ((match = jsRegex.exec(text)) !== null) {
        const content = match[1];
        if (content && content.trim()) {
            sections.push({
                startOffset: match.index + match[0].indexOf(content),
                content,
                grammar: 'javascript'
            });
        }
    }

    // Prefix JS: js{ ... }
    const prefixJsRegex = /js\{([\s\S]*?)\}/g;
    while ((match = prefixJsRegex.exec(text)) !== null) {
        const content = match[1];
        if (content && content.trim()) {
            sections.push({ startOffset: match.index + 3, content, grammar: 'javascript' });
        }
    }

    // Logic Blocks: ${ ... }$
    const logicRegex = /(\$\{)([\s\S]*?)(\}\$)/g;
    while ((match = logicRegex.exec(text)) !== null) {
        const startMarker = match[1];
        const content = match[2];
        const endMarker = match[3];

        addManualToken(allTokens, match.index, match.index + 2, text, 'macro', 4);
        addManualToken(allTokens, match.index + match[0].length - 2, match.index + match[0].length, text, 'macro', 4);

        if (content && content.trim()) {
            sections.push({ startOffset: match.index + 2, content, grammar: 'javascript' });
        }
    }

    // CSS Blocks: @_style_@ ... @_end_@ or @_css_@ ... @_end_@
    const cssRegex = /@_(?:style|css)_@(?:;\s*)?([\s\S]*?)@_end_@/g;
    while ((match = cssRegex.exec(text)) !== null) {
        const content = match[1];
        if (content && content.trim()) {
            sections.push({
                startOffset: match.index + match[0].indexOf(content),
                content,
                grammar: 'css'
            });
        }
    }

    // ========================================================================== //
    //  4. Process Lexer Tokens (Structural)                                     //
    // ========================================================================== //
    for (let i = 0; i < lexerTokens.length; i++) {
        const t = lexerTokens[i];
        let type = null;
        let modifiers = [];

        switch (t.type) {
            case TOKEN_TYPES.COMMENT: case TOKEN_TYPES.COMMENT_BLOCK: type = 'comment'; break;
            case TOKEN_TYPES.IMPORT: case TOKEN_TYPES.USE_MODULE: case TOKEN_TYPES.END_KEYWORD:
            case TOKEN_TYPES.FOR_EACH: case TOKEN_TYPES.SLOT_KEYWORD: case TOKEN_TYPES.GLOBAL_KEYWORD:
                type = 'keyword'; modifiers.push('declaration'); break;
            case TOKEN_TYPES.STATIC_KEYWORD: case TOKEN_TYPES.RUNTIME_KEYWORD: {
                let isLogic = false;
                for (let j = i + 1; j < lexerTokens.length; j++) {
                    const nextToken = lexerTokens[j];
                    if (nextToken.type === TOKEN_TYPES.WHITESPACE || 
                        nextToken.type === TOKEN_TYPES.COMMENT || 
                        nextToken.type === TOKEN_TYPES.COMMENT_BLOCK ||
                        (nextToken.type === TOKEN_TYPES.TEXT && nextToken.value.trim() === '')) {
                        continue;
                    }
                    if (nextToken.type === TOKEN_TYPES.LOGIC) {
                        isLogic = true;
                    }
                    break;
                }
                if (isLogic) {
                    type = 'keyword'; modifiers.push('declaration');
                }
                break;
            }
            case TOKEN_TYPES.IDENTIFIER: case TOKEN_TYPES.BLOCK_ID: type = 'class'; break;
            case TOKEN_TYPES.KEY: type = 'property'; break;
            case TOKEN_TYPES.VALUE: case TOKEN_TYPES.QUOTE: type = 'string'; break;
            case TOKEN_TYPES.LOGIC:
                // Markers are now handled by regex loop for better reliability
                break;
            case TOKEN_TYPES.OPEN_BRACKET: case TOKEN_TYPES.CLOSE_BRACKET: case TOKEN_TYPES.THIN_ARROW:
            case TOKEN_TYPES.OPEN_AT: case TOKEN_TYPES.CLOSE_AT: case TOKEN_TYPES.OPEN_PAREN: case TOKEN_TYPES.CLOSE_PAREN:
                type = 'keyword'; break;
            case TOKEN_TYPES.EXCLAMATION_MARK: case TOKEN_TYPES.COLON: case TOKEN_TYPES.COMMA:
            case TOKEN_TYPES.SEMICOLON: case TOKEN_TYPES.EQUAL: case TOKEN_TYPES.ESCAPE:
                type = 'operator'; break;
        }

        if (type) {
            const lines = (t.value || "").split('\n');
            for (let i = 0; i < lines.length; i++) {
                const lineContent = lines[i];
                if (lineContent.length === 0) continue;
                allTokens.push({
                    line: t.range.start.line + i,
                    char: (i === 0) ? t.range.start.character : 0,
                    length: lineContent.length,
                    typeIndex: tokenTypes.indexOf(type),
                    modifierBitmask: modifiers.reduce((mask, mod) => mask | (1 << tokenModifiers.indexOf(mod)), 0),
                    priority: 1
                });
            }
        }
    }

    // ========================================================================== //
    //  5. Manual Highlighting (Acorn for JS, CSS-Tree for CSS)                  //
    // ========================================================================== //
    for (const section of sections) {
        if (section.grammar === 'javascript') {
            highlightJS(section.content, section.startOffset, text, allTokens);
        } else if (section.grammar === 'css') {
            highlightCSS(section.content, section.startOffset, text, allTokens);
        }
    }

    // ========================================================================== //
    //  6. Post-Processing                                                       //
    // ========================================================================== //
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
                    eclipsed = true; break;
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
//  Internal Lexer Mappings                                                   //
// ========================================================================== //

function highlightJS(code, startOffset, fullText, allTokens, priority = 3) {
    try {
        // We use a regular array to peek ahead
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

            // Detect and recursively highlight SomMark.static("...") or SomMark.static(`...`)
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

            // 1. Keywords
            if (token.type.keyword) {
                const name = code.slice(token.start, token.end);
                if (['const', 'let', 'var', 'class', 'function', 'this', 'new'].includes(name)) {
                    type = 'macro';
                } else {
                    type = 'keyword';
                }
            }
            // 2. Identifiers with Context
            else if (label === 'name') {
                const name = code.slice(token.start, token.end);

                // Function call or method: foo( or obj.method(
                if (next && next.type.label === '(') {
                    if (prev && prev.type.label === 'new') {
                        type = 'class';
                    } else if (/^[A-Z]/.test(name)) {
                        type = name === name.toUpperCase() ? 'variable' : 'class';
                    } else {
                        type = 'function';
                    }
                }
                // Class or Function Declaration
                else if (prev && prev.type.label === 'class') type = 'class';
                else if (prev && prev.type.label === 'function') type = 'function';
                // Property access: obj.prop or { prop: val }
                else if (prev && prev.type.label === '.') type = 'property';
                else if (next && next.type.label === ':') type = 'property';
                // Contextual keywords (like 'from' in import)
                else if (name === 'from' || name === 'of' || name === 'as' || name === 'async' || name === 'await' || name === 'get' || name === 'set') {
                    type = 'keyword';
                }
                // TitleCase (Class/Constructor) or UPPER_CASE (Constant)
                else if (/^[A-Z]/.test(name)) {
                    type = name === name.toUpperCase() ? 'variable' : 'class';
                }
                else {
                    type = 'variable';
                }
            }
            // 3. Literals
            else if (label === 'string' || label === 'template' || label === 'regexp') {
                type = 'string';
            }
            else if (label === 'num') {
                type = 'number';
            }
            // 4. Operators
            else if (token.type.isAssign || label === 'operator' || label === 'prefix' || label === 'postfix' || ['?', ':', '??', '?.'].includes(label)) {
                type = 'operator';
            }
            // 5. Punctuators
            else if (['(', ')', '{', '}', '[', ']', ',', ';', '.', '...'].includes(label)) {
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

function highlightCSS(code, startOffset, fullText, allTokens) {
    try {
        const tokens = csstree.tokenize(code);
        csstree.walk(csstree.parse(code), {
            enter: (node) => {
                let type = null;
                if (node.type === 'Identifier') {
                    // Check if it looks like a property
                    type = 'variable';
                } else if (node.type === 'TypeSelector') {
                    type = 'type';
                } else if (node.type === 'IdSelector') {
                    type = 'class';
                } else if (node.type === 'ClassSelector') {
                    type = 'class';
                } else if (node.type === 'Declaration') {
                    // Property is handled by identifier mapping inside declaration
                } else if (node.type === 'Number') {
                    type = 'number';
                } else if (node.type === 'String') {
                    type = 'string';
                } else if (node.type === 'Function') {
                    type = 'function';
                } else if (node.type === 'Atrule') {
                    type = 'keyword';
                }

                if (type && node.loc) {
                    addManualToken(allTokens, node.loc.start.offset + startOffset, node.loc.end.offset + startOffset, fullText, type, 3);
                }
            }
        });
    } catch (e) {
        // Silently ignore CSS parse errors
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

// Compatibility export
export function initializeHighlighter() { }
