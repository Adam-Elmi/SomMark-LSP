import * as prettier from "prettier";
import { TOKEN_TYPES, lexSync } from "sommark";

const PRETTIER_PARSERS = {
    js:  "babel",
    css: "css",
};

/**
 * Finds all smark-raw blocks with smark-syntax using the lexer,
 * formats each body with Prettier, and returns LSP TextEdits.
 */
export async function formatDocument(text, formattingOptions) {
    const edits = [];
    let lexerTokens = [];

    try {
        lexerTokens = lexSync(text) || [];
    } catch {
        return edits;
    }

    const tabSize  = formattingOptions?.tabSize  ?? 4;
    const useTabs  = formattingOptions?.insertSpaces === false;

    let props    = {};
    let inHeader = false;
    let lastKey  = null;

    for (let i = 0; i < lexerTokens.length; i++) {
        const t = lexerTokens[i];

        if (t.type === TOKEN_TYPES.OPEN_BRACKET) {
            props    = {};
            inHeader = true;
            lastKey  = null;
        } else if (inHeader && t.type === TOKEN_TYPES.KEY) {
            lastKey = t.value;
        } else if (inHeader && t.type === TOKEN_TYPES.VALUE && lastKey) {
            props[lastKey] = t.value;
            lastKey = null;
        } else if (inHeader && t.type === TOKEN_TYPES.CLOSE_BRACKET) {
            inHeader = false;
            const isRaw = props["smark-raw"] === "true" || props["smark-raw"] === true;
            const lang  = props["smark-syntax"]?.toLowerCase().replace(/['"]/g, "");
            const parser = PRETTIER_PARSERS[lang];

            if (!isRaw || !parser) continue;

            const bodyToken = lexerTokens[i + 1];
            if (!bodyToken || bodyToken.type !== TOKEN_TYPES.TEXT) continue;

            const raw = bodyToken.value;

            // Strip leading/trailing newlines for formatting, restore after
            const leadingNewline  = raw.startsWith("\n") ? "\n" : "";
            const trailingNewline = raw.endsWith("\n")   ? "\n" : "";
            const content = raw.replace(/^\n/, "").replace(/\n$/, "");

            let formatted;
            try {
                formatted = await prettier.format(content, {
                    parser,
                    tabWidth:  tabSize,
                    useTabs,
                    printWidth: 80,
                });
            } catch {
                continue; // skip blocks with syntax errors
            }

            // Remove trailing newline prettier always adds, restore original wrapping
            const formattedBody = leadingNewline + formatted.replace(/\n$/, "") + trailingNewline;

            if (formattedBody === raw) continue; // no change

            const start = bodyToken.range.start;
            const end   = bodyToken.range.end;

            edits.push({
                range: {
                    start: { line: start.line, character: start.character },
                    end:   { line: end.line,   character: end.character   },
                },
                newText: formattedBody,
            });
        }
    }

    return edits;
}
