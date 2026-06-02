import { TOKEN_TYPES, lexSync } from 'sommark';

/**
 * Extracts all embedded JavaScript from a SomMark document.
 * Returns a mapping of the virtual document content and a line map
 * to translate coordinates back to the original document.
 */
export function getVirtualJSContent(text) {
    let lexerTokens = [];
    try {
        lexerTokens = lexSync(text) || [];
    } catch (e) {
        return { content: "", mapping: [] };
    }

    let virtualContent = "";
    const mapping = []; // Stores { virtualLine, originalLine, originalCharOffset }

    let currentVirtualLine = 0;

    for (const t of lexerTokens) {
        let jsCode = "";
        let startPos = t.range.start;

        if (t.type === TOKEN_TYPES.LOGIC) {
            jsCode = t.value || "";
        } else if (t.type === TOKEN_TYPES.PREFIX_JS) {
            jsCode = (t.value || "").slice(3, -1); // Remove js{ and }
            startPos = { 
                line: t.range.start.line, 
                character: t.range.start.character + 3 
            };
        } else if (t.type === TOKEN_TYPES.STATIC_KEYWORD) {
            // Check if next token is LOGIC
            const nextT = lexerTokens[lexerTokens.indexOf(t) + 1];
            if (nextT && nextT.type === TOKEN_TYPES.LOGIC) {
                // Handled in LOGIC case
            }
        }

        if (jsCode) {
            const lines = jsCode.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const lineContent = lines[i];
                mapping.push({
                    virtualLine: currentVirtualLine,
                    originalLine: startPos.line + i,
                    originalCharOffset: (i === 0) ? startPos.character : 0
                });
                virtualContent += lineContent + "\n";
                currentVirtualLine++;
            }
            // Add a newline separator between blocks to avoid identifier merging
            virtualContent += "\n";
            currentVirtualLine++;
        }
    }

    return { content: virtualContent, mapping };
}
