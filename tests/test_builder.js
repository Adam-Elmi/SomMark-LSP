import { SemanticTokensBuilder } from 'vscode-languageserver/node.js';

const builder = new SemanticTokensBuilder();
// Test absolute coordinates
builder.push(0, 5, 2, 0, 0); 
builder.push(0, 10, 2, 0, 0); 
builder.push(1, 2, 3, 1, 0);

console.log('Result Data (Delta Encoded):', JSON.stringify(builder.build().data));
