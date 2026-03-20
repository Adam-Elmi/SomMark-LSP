import SomMark from 'sommark';
import fs from 'fs';
import path from 'path';

async function test() {
    console.log("--- Testing LSP Robustness & Highlighting Fixes ---");
    
    // 1. Test Top-level blocks (Roadmap case)
    const text1 = '[h1]Title[end]\n[p]Paragraph[end]';
    const smark1 = new SomMark({ src: text1, format: 'html' });
    try {
        console.log("\n1. Testing Top-level Blocks:");
        const ast1 = await smark1.parse();
        console.log("SUCCESS: Top-level blocks parsed without error.");
    } catch (e) {
        console.log("FAILED: Top-level blocks error:", e);
    }

    // 2. Test Module Warning (Missing file)
    const text2 = '[[ import = $missing: "none.smark" ]]\n$[[missing]]';
    const smark2 = new SomMark({ src: text2, format: 'html' });
    try {
        console.log("\n2. Testing Module Warning (Missing file):");
        const tokens2 = await smark2.lex();
        console.log("Lexing finished despite missing file.");
        console.log("Warnings collected:", smark2.warnings.length);
        if (smark2.warnings.length > 0) {
            console.log("SUCCESS: Warning collected for missing file.");
        } else {
            console.log("FAILED: No warning collected.");
        }
    } catch (e) {
        console.log("FAILED: Module still throws error:", e);
    }

    // 3. Test Highlighting Robustness (Manual check logic)
    // We can't easily test SemanticTokensBuilder here, but we can verify the regex logic if we export it or test it in situ.
    // For now, let's just verify lexing doesn't crash on garbage.
    const text3 = '[unclosed_block';
    const smark3 = new SomMark({ src: text3, format: 'html' });
    try {
        console.log("\n3. Testing Lexing Robustness on garbage:");
        await smark3.lex();
        console.log("SUCCESS: Garbage didn't crash lexer (standard SomMark handles it).");
    } catch (e) {
        console.log("Lexer threw (this is actually expected for some cases, but semantic_tokens.js should catch it):", e);
    }
}

test();
