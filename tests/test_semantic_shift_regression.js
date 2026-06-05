import { computeSemanticTokens, tokenTypes } from '../server/semantic_tokens.js';

const text = `# Comment
# Comment
# Comment
# Comment
# Comment
[for-each = static \${
    const users = [ { name: "A" } ];
    return users;
}\$
     as: "user"]
`;

async function test() {
    const res = await computeSemanticTokens(text);
    const data = res.data;
    
    // Decode relative semantic tokens back to absolute coordinates
    let currentLine = 0;
    let currentChar = 0;
    const decoded = [];
    
    for (let i = 0; i < data.length; i += 5) {
        const deltaLine = data[i];
        const deltaChar = data[i+1];
        const length = data[i+2];
        const typeIndex = data[i+3];
        
        currentLine += deltaLine;
        if (deltaLine > 0) {
            currentChar = deltaChar;
        } else {
            currentChar += deltaChar;
        }
        
        decoded.push({
            line: currentLine,
            char: currentChar,
            length,
            type: tokenTypes[typeIndex]
        });
    }
    
    const line9Tokens = decoded.filter(t => t.line === 9);
    console.log("Decoded tokens on line 10 (0-indexed 9):", line9Tokens);
    
    // Verify that "as" (property) is at character 5 with length 2
    const asToken = line9Tokens.find(t => t.char === 5 && t.length === 2);
    // Verify that "user" (string) starts at character 10 with length 4
    const userToken = line9Tokens.find(t => t.char === 10 && t.length === 4);
    
    if (asToken && userToken) {
        console.log("SUCCESS: LSP semantic tokens are perfectly aligned on the end of logic block line!");
    } else {
        console.error("FAILURE: Semantic tokens are misaligned!", line9Tokens);
        process.exit(1);
    }
}

test().catch(err => {
    console.error("Test error:", err);
    process.exit(1);
});
