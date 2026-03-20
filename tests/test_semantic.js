import { computeSemanticTokens, legend } from '../server/semantic_tokens.js';
import { lexSync } from 'sommark';

const sample = `[[ import = $hubCss: "examples/html/hub.css" ]]
@_Table_@: Feature;
Testing
@_end_@`;

const raw = lexSync(sample);
console.log('Raw Tokens:', JSON.stringify(raw, null, 2));

const tokens = computeSemanticTokens(sample);
console.log('Legend:', legend);
console.log('Result Data:', tokens.data);
console.log('Result Data Length:', tokens.data.length);
