import { computeSemanticTokens } from '../server/semantic_tokens.js';

const text = `[[ import = $roadmap: "/home/adam/Projects/Smark/SomMark/examples/html/roadmap.smark" ]]

$[[roadmap]]

[h1]SomMark: Markdown Showcase[end]

# Nested Elements
[Block]
    [Block]
        [Block]
            [Block]
                [Block]
                    This is a deeply nested block.
                    It can contain headings, lists, and other elements.
                    - Nested item 1
                    - Nested item 2
                [end]
            [end]
        [end]
    [end]
[end]
`;

async function run() {
    try {
        const result = await computeSemanticTokens(text);
        const data = result.data;
        
        let currentLine = 0;
        let currentChar = 0;
        let lastLine = -1;
        let lastChar = -1;
        
        console.log("Decoding tokens...");
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
            
            console.log(`L${currentLine}:C${currentChar} (len: ${length}, type: ${type})`);
            
            if (currentLine < lastLine || (currentLine === lastLine && currentChar < lastChar)) {
                console.error(`FAIL: Out of order token at L${currentLine}:C${currentChar} after L${lastLine}:C${lastChar}`);
                process.exit(1);
            }
            
            lastLine = currentLine;
            lastChar = currentChar;
        }
        console.log("SUCCESS: All tokens are in increasing order.");
    } catch (e) {
        console.error("Error during verification:", e);
        process.exit(1);
    }
}

run();
