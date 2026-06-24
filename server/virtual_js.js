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
