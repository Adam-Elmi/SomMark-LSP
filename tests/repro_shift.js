import { computeSemanticTokens } from '../server/semantic_tokens.js';

const text = `[[ import = $roadmap: "/home/adam/Projects/Smark/SomMark/examples/html/roadmap.smark" ]]

$[[roadmap]]

[h1]SomMark: Markdown Showcase[end]
`;

async function run() {
    try {
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
            
            tokens.push({ line: currentLine, char: currentChar, length, type });
        }

        console.log("Tokens for Line 1 (Import - index 0):");
        const line0Tokens = tokens.filter(t => t.line === 0);
        line0Tokens.forEach((t, i) => {
            console.log(`${i}: C${t.char} (len: ${t.length}, typeIndex: ${t.type})`);
        });

        console.log("\nTokens for Line 3 (Usage - index 2):");
        const line2Tokens = tokens.filter(t => t.line === 2);
        line2Tokens.forEach((t, i) => {
            console.log(`${i}: C${t.char} (len: ${t.length}, typeIndex: ${t.type})`);
        });

        // Verification logic
        const keywordIdx = 1;
        const variableIdx = 4;
        const stringIdx = 3;

        const importKeyword = line0Tokens.find(t => t.type === keywordIdx && t.char === 3);
        const importVariable = line0Tokens.find(t => t.type === variableIdx);
        const importString = line0Tokens.find(t => t.type === stringIdx);

        if (importKeyword && importVariable && importString) {
            console.log("\nSUCCESS: Granular import tokens found.");
        } else {
            console.error("\nFAIL: Missing granular import tokens.");
        }

        const usageVar = line2Tokens.find(t => t.type === variableIdx);
        const usageKeywords = line2Tokens.filter(t => t.type === keywordIdx);

        if (usageVar && usageKeywords.length >= 2) {
            console.log("SUCCESS: Granular usage tokens found.");
        } else {
            console.error("FAIL: Missing granular usage tokens.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

run();
