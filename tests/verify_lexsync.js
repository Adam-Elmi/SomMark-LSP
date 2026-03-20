import { lexSync } from 'sommark';

const text = `[[ import = $roadmap: "/home/adam/Projects/Smark/SomMark/examples/html/roadmap.smark" ]]

$[[roadmap]]

[h1]SomMark: Markdown Showcase[end]
`;

function run() {
    const lexerTokens = lexSync(text) || [];
    
    console.log(`lexSync returned ${lexerTokens.length} tokens.`);
    lexerTokens.forEach((t, i) => {
        console.log(`${i}: type=${t.type}, value=${JSON.stringify(t.value)}, line=${t.range.start.line}, char=${t.range.start.character}`);
    });
}

run();
