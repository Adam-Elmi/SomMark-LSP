import { computeSemanticTokens, tokenTypes } from '../server/semantic_tokens.js';
import assert from 'node:assert';

async function test() {
    console.log("Testing SomMark v3 Semantic Tokens...");

    const sample = `[import = plan: "edu.plan.smark" ][end]
[$use-module = plan][end]
# Normal text
[h1]Title[end]`;

    const result = await computeSemanticTokens(sample);
    const data = result.data;

    // Tokens are encoded as 5 integers: deltaLine, deltaStartChar, length, tokenType, tokenModifiers
    // We need to decode them to verify.
    
    let currentLine = 0;
    let currentChar = 0;
    const decodedTokens = [];

    for (let i = 0; i < data.length; i += 5) {
        const deltaLine = data[i];
        const deltaStartChar = data[i+1];
        const length = data[i+2];
        const typeIndex = data[i+3];
        
        currentLine += deltaLine;
        if (deltaLine === 0) {
            currentChar += deltaStartChar;
        } else {
            currentChar = deltaStartChar;
        }

        decodedTokens.push({
            line: currentLine,
            char: currentChar,
            length,
            type: tokenTypes[typeIndex]
        });
        
        // Update currentChar for next token on same line
        // Wait, the deltaStartChar is DELTA from the previous token's START char on the same line.
    }

    console.log("Decoded Tokens:");
    decodedTokens.forEach(t => {
        const content = sample.split('\n')[t.line].substring(t.char, t.char + t.length);
        console.log(`L${t.line}:${t.char} [${t.type}] "${content}"`);
    });

    // Verify 'import'
    const importToken = decodedTokens.find(t => t.type === 'keyword' && sample.split('\n')[t.line].substring(t.char, t.char + t.length) === 'import');
    assert.ok(importToken, "Should find 'import' as keyword");

    // Verify '$use-module'
    const useModuleToken = decodedTokens.find(t => t.type === 'keyword' && sample.split('\n')[t.line].substring(t.char, t.char + t.length) === '$use-module');
    assert.ok(useModuleToken, "Should find '$use-module' as keyword");

    console.log("\nSemantic tokens verification passed!");
}

test().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
