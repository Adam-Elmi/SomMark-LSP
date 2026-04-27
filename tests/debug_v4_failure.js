import { validateTextDocument } from '../server/diagnostics.js';
import { fileURLToPath } from 'node:url';

async function simulateLSP() {
    const text = `[Gallery = 
  images: js{["nature.jpg", "tech.jpg"]}, 
  active: js{true}
]
  This block uses native JS arrays and booleans.
[end]`;

    const mockConnection = {
        sendDiagnostics: ({ uri, diagnostics }) => {
            console.log("Diagnostics:", JSON.stringify(diagnostics, null, 2));
        }
    };

    const mockDocument = {
        uri: 'file:///home/adam/Projects/Smark/SomMark/debug.smark',
        getText: () => text
    };

    console.log("Simulating LSP validation for debug.smark...");
    await validateTextDocument(mockConnection, mockDocument);
}

simulateLSP();
