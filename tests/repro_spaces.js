import { lexSync } from 'sommark';
import { computeSemanticTokens } from '../server/semantic_tokens.js';

const text = `[[  import   =    $roadmap   :    "/path/to/roadmap.smark"    ]]`;

async function run() {
    try {
        console.log("--- LEXER TOKENS ---");
        const lexerTokens = lexSync(text);
        lexerTokens.forEach((t, i) => {
            console.log(`${i}: ${t.type} val=[${t.value}] range=${JSON.stringify(t.range.start)}`);
        });

        console.log("\n--- SEMANTIC TOKENS (Decoded) ---");
        const result = await computeSemanticTokens(text);
        const data = result.data;
        
        let currentLine = 0;
        let currentChar = 0;
        let tokens = [];

        for (let i = 0; i < data.length; i += 5) {
            const deltaLine = data[i];
            const deltaChar = data[i+1];
            const length = data[i+2];
            const type = data[i+3];
            
            currentLine += deltaLine;
            if (deltaLine === 0) {
                currentChar += deltaChar;
            } else {
                currentChar = deltaChar;
            }
            
            tokens.push({ line: currentLine, char: currentChar, length, type, text: text.substr(currentChar, length) });
        }

        tokens.forEach((t, i) => {
            console.log(`${i}: L${t.line} C${t.char} len=${t.length} type=${t.type} text=[${t.text}]`);
        });

    } catch (e) {
        console.error("Error:", e);
    }
}

run();
