import { SemanticTokensBuilder } from 'vscode-languageserver/node.js';
import { TOKEN_TYPES, lexSync } from 'sommark';

// ========================================================================== //
//  1. Semantic Tokens Legend                                                 //
// ========================================================================== //
export const tokenTypes = ['function', 'keyword', 'parameter', 'string', 'variable', 'comment', 'operator'];
export const tokenModifiers = ['declaration', 'documentation'];

export const legend = {
    tokenTypes,
    tokenModifiers
};

// ========================================================================== //
//  2. Main Highlighting Logic                                                //
// ========================================================================== //
export async function computeSemanticTokens(text) {
    const builder = new SemanticTokensBuilder();
    let lexerTokens = [];

    try {
        // Use lexSync to ensure tokens match the physical lines in the editor (no import expansion)
        lexerTokens = lexSync(text) || [];
    } catch (e) {
        console.error("[Highlighting Error]:", e.message);
        // Fallback to empty tokens to avoid crashing the whole LSP request
    }

    const allTokens = [];

    // Helper to extract tokens from regex matches
    const getTokensFromRegex = (regex, type, modifiers = [], groupIndex = 0) => {
        const tokens = [];
        let match;
        const typeIndex = tokenTypes.indexOf(type);
        const modifierBitmask = modifiers.reduce((mask, mod) => mask | (1 << tokenModifiers.indexOf(mod)), 0);
        
        while ((match = regex.exec(text)) !== null) {
            const value = match[groupIndex];
            if (value === undefined) continue;

            let startPos = match.index;
            if (groupIndex > 0) {
                // Sum the lengths of all preceding groups to find the exact offset
                for (let i = 1; i < groupIndex; i++) {
                    startPos += (match[i] || "").length;
                }
            }

            // Check if this match is preceded by a '#' on the same line (commented out)
            const lineStartPos = text.lastIndexOf('\n', startPos) + 1;
            const lineBeforeMatch = text.slice(lineStartPos, startPos);
            if (lineBeforeMatch.trim().startsWith('#')) {
                continue;
            }

            const lines = value.split('\n');
            const textBefore = text.slice(0, startPos);
            const startLine = textBefore.split('\n').length - 1;
            const startChar = startPos - textBefore.lastIndexOf('\n') - 1;

            for (let i = 0; i < lines.length; i++) {
                const lineContent = lines[i];
                if (lineContent.length === 0) continue;
                const currentLine = startLine + i;
                const tokenStart = (i === 0) ? startChar : 0;
                
                tokens.push({
                    line: currentLine,
                    char: tokenStart,
                    length: lineContent.length,
                    typeIndex,
                    modifierBitmask,
                    priority: 2 // Regex tokens have higher priority
                });
            }
        }
        return tokens;
    };
    // ========================================================================== //
    //  3. Regex-based Highlighting (Imports & Modules)                           //
    // ========================================================================== //
    // 3.1 Highlight Imports: [import = alias: "file.smark" ]
    const importRegex = /(\[\s*)(import)(\s*=\s*)([a-zA-Z0-9_-]+)(\s*:\s*)("[^"]+"|'[^']+')(\s*\])/g;
    
    // Highlight 'import' as keyword
    allTokens.push(...getTokensFromRegex(importRegex, 'keyword', [], 2));
    // Highlight 'alias' as variable (declaration)
    allTokens.push(...getTokensFromRegex(importRegex, 'variable', ['declaration'], 4));
    // Highlight '"file.smark"' as string
    allTokens.push(...getTokensFromRegex(importRegex, 'string', [], 6));

    // 3.2 Highlight Module Usages [$use-module = alias]
    const usageRegex = /(\[\s*)(\$use-module)(\s*=\s*)([a-zA-Z0-9_-]+)(\s*\])/g;
    
    // Highlight '$use-module' as keyword
    allTokens.push(...getTokensFromRegex(usageRegex, 'keyword', [], 2));
    // Highlight 'alias' as variable
    allTokens.push(...getTokensFromRegex(usageRegex, 'variable', [], 4));

    // ========================================================================== //
    //  4. Lexer Token Collection                                                 //
    // ========================================================================== //
    for (const t of lexerTokens) {
        let type = '';
        let modifiers = [];

        switch (t.type) {
            case TOKEN_TYPES.COMMENT:
                type = 'comment';
                break;
            case TOKEN_TYPES.END_KEYWORD:
                type = 'keyword';
                modifiers.push('declaration');
                break;
            case TOKEN_TYPES.IDENTIFIER:
                type = 'variable';
                break;
            case TOKEN_TYPES.VALUE:
                type = 'string';
                break;
            case TOKEN_TYPES.OPEN_BRACKET:
            case TOKEN_TYPES.CLOSE_BRACKET:
            case TOKEN_TYPES.OPEN_AT:
            case TOKEN_TYPES.CLOSE_AT:
            case TOKEN_TYPES.OPEN_PAREN:
            case TOKEN_TYPES.CLOSE_PAREN:
                type = 'keyword';
                break;
            case TOKEN_TYPES.COLON:
            case TOKEN_TYPES.COMMA:
            case TOKEN_TYPES.SEMICOLON:
            case TOKEN_TYPES.EQUAL:
            case TOKEN_TYPES.THIN_ARROW:
            case TOKEN_TYPES.ESCAPE:
                type = 'operator';
                break;
            default:
                break;
        }

        if (type) {
            const rawValue = t.value || "";
            const lines = rawValue.split('\n');

            const startLineIndex = t.range.start.line;
            const startCharIndex = t.range.start.character;

            const typeIndex = tokenTypes.indexOf(type);
            const modifierBitmask = modifiers.reduce((mask, mod) => mask | (1 << tokenModifiers.indexOf(mod)), 0);

            for (let i = 0; i < lines.length; i++) {
                const lineContent = lines[i];
                if (lineContent.length === 0) continue;

                const currentLine = startLineIndex + i;
                const tokenStart = (i === 0) ? startCharIndex : 0;

                if (currentLine >= 0 && tokenStart >= 0) {
                    allTokens.push({
                        line: currentLine,
                        char: tokenStart,
                        length: lineContent.length,
                        typeIndex,
                        modifierBitmask,
                        priority: 1 // Lexer tokens have lower priority
                    });
                }
            }
        }
    }
    // ========================================================================== //
    //  5. Token Post-Processing (Sort & Filter overlaps)                         //
    // ========================================================================== //
    // 5.1 Sort tokens by line/char/priority
    allTokens.sort((a, b) => {
        if (a.line !== b.line) return a.line - b.line;
        if (a.char !== b.char) return a.char - b.char;
        return b.priority - a.priority;
    });

    // 5.2 Pre-filter to handle overlaps
    // This ensures regex tokens (priority 2) pre-empt lexer tokens (priority 1)
    const filteredTokens = [];
    for (let i = 0; i < allTokens.length; i++) {
        const token = allTokens[i];
        let eclipsed = false;
        for (let j = 0; j < allTokens.length; j++) {
            const other = allTokens[j];
            if (other.line === token.line && other.priority > token.priority) {
                const tokenEnd = token.char + token.length;
                const otherEnd = other.char + other.length;
                if (other.char < tokenEnd && otherEnd > token.char) {
                    eclipsed = true;
                    break;
                }
            }
        }
        if (!eclipsed) filteredTokens.push(token);
    }
    // ========================================================================== //
    //  6. Export result (Strict LSP Compliance)                                  //
    // ========================================================================== //
    let lastLine = -1;
    let nextAvailableChar = -1;

    for (const token of filteredTokens) {
        if (token.line > lastLine) {
            lastLine = token.line;
            nextAvailableChar = 0;
        }

        if (token.char < nextAvailableChar) {
            continue;
        }

        builder.push(token.line, token.char, token.length, token.typeIndex, token.modifierBitmask);
        nextAvailableChar = token.char + token.length;
    }


    return builder.build();
}
