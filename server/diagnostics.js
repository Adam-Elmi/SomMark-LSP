import { DiagnosticSeverity } from "vscode-languageserver/node.js";
import SomMark from "sommark";

// ========================================================================== //
//  1. Document Validation Logic                                              //
// ========================================================================== //
export async function validateTextDocument(connection, document) {
    const text = document.getText();
    // console.log("lexSync source:", lexSync.toString());

    const diagnostics = [];
    const smark = new SomMark({ 
        src: text, 
        format: 'html',
        filename: document.uri 
    });

    try {
        await smark.parse();
    } catch (error) {
        const cleanError = stripColors(error);
        
        // Multi-line range match: "at line 39, from line 39, column 0 to line 40, column 0"
        const multiLineMatch = cleanError.match(/from line\s*(\d+),\s*column\s*(\d+)\s*to line\s*(\d+),\s*column\s*(\d+)/i);
        // Single-line range match: "at line 39, from column 10 to 20" or "from column 10 to column 20"
        const singleLineMatch = cleanError.match(/at line\s*(\d+),\s*from column\s*(\d+)\s*to\s*(?:column\s*)?(\d+)/i);
        // Fallback for simple "at line X"
        const simpleLineMatch = cleanError.match(/at line\s*(\d+)/i);

        let range = { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } };

        if (multiLineMatch) {
            range = {
                start: { line: parseInt(multiLineMatch[1]) - 1, character: parseInt(multiLineMatch[2]) },
                end: { line: parseInt(multiLineMatch[3]) - 1, character: parseInt(multiLineMatch[4]) }
            };
        } else if (singleLineMatch) {
            const line = parseInt(singleLineMatch[1]) - 1;
            range = {
                start: { line, character: parseInt(singleLineMatch[2]) },
                end: { line, character: parseInt(singleLineMatch[3]) }
            };
        } else if (simpleLineMatch) {
            const line = parseInt(simpleLineMatch[1]) - 1;
            range = { start: { line, character: 0 }, end: { line, character: 1 } };
        }

        // Ensure range is at least 1 character wide and lines are positive
        range.start.line = Math.max(0, range.start.line);
        range.end.line = Math.max(0, range.end.line);
        if (range.start.line === range.end.line && range.start.character >= range.end.character) {
            range.end.character = range.start.character + 1;
        }

        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range,
            message: cleanError,
            source: 'sommark'
        });
    }

    // ========================================================================== //
    //  2. Warning Collection                                                     //
    // ========================================================================== //
    if (smark.warnings && smark.warnings.length > 0) {
        smark.warnings.forEach(w => {
            const cleanWarning = stripColors(w);
            const lineMatch = cleanWarning.match(/at line\s*(\d+)/i);
            
            let line = 0;
            if (lineMatch) {
                line = parseInt(lineMatch[1]) - 1;
            }

            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: Math.max(0, line), character: 0 },
                    end: { line: Math.max(0, line), character: 100 }
                },
                message: cleanWarning,
                source: 'sommark'
            });
        });
    }

    // Send the computed diagnostics to VS Code.
    connection.sendDiagnostics({ uri: document.uri, diagnostics });
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
