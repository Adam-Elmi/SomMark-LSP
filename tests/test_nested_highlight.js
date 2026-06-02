import { computeSemanticTokens, tokenTypes } from '../server/semantic_tokens.js';

const sample = `runtime \${
  const usersData = SomMark.static(\`
    const a = 1;
    return a;
  \`)
}\$`;

async function run() {
    console.log("Input Source Code:\n" + sample);
    console.log("\nComputing semantic tokens...");
    
    const result = await computeSemanticTokens(sample);
    const data = result.data;
    
    let currentLine = 0;
    let currentChar = 0;
    let lastLine = -1;
    let lastChar = -1;
    
    console.log("\nDecoded & Validating Tokens:");
    for (let i = 0; i < data.length; i += 5) {
        const deltaLine = data[i];
        const deltaChar = data[i+1];
        const length = data[i+2];
        const typeIndex = data[i+3];
        const type = tokenTypes[typeIndex];
        
        currentLine += deltaLine;
        if (deltaLine === 0) {
            currentChar += deltaChar;
        } else {
            currentChar = deltaChar;
        }
        
        // Extract the raw token text from the sample
        const lines = sample.split('\n');
        const lineText = lines[currentLine] || "";
        const tokenText = lineText.substring(currentChar, currentChar + length);
        
        console.log(`L${currentLine}:C${currentChar} (len: ${length}) - [${type}] : "${tokenText}"`);

        if (currentLine < lastLine || (currentLine === lastLine && currentChar < lastChar)) {
            console.error(`FAIL: Out of order token at L${currentLine}:C${currentChar} after L${lastLine}:C${lastChar}`);
            process.exit(1);
        }
        
        lastLine = currentLine;
        lastChar = currentChar;
    }
    
    console.log("\nSUCCESS: All tokens are in correct, strictly increasing order!");
}

run();
