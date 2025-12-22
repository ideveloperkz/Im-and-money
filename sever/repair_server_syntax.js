const fs = require('fs');
const path = 'server.js';

try {
    const data = fs.readFileSync(path, 'utf8');
    const lines = data.split(/\r?\n/);

    // Indices based on view_file analysis (1-based in view_file -> 0-based in array)
    // Line 1419 -> Index 1418: "        }"
    // Line 1422 -> Index 1421: "            io.emit('game:state_update', gameState.getState());"

    const idxBrace = 1418;
    const idxEmit = 1421;

    console.log(`Checking Index ${idxBrace}: "${lines[idxBrace]}"`);
    console.log(`Checking Index ${idxEmit}: "${lines[idxEmit]}"`);

    if (lines[idxBrace].trim() === '}' && lines[idxEmit].includes('io.emit')) {
        console.log('Target confirmed. Removing lines...');

        // Remove lines from 1419 to 1423 (Indices 1418 to 1422)
        // Except we might want to keep newlines or just comment them out.
        // Actually, just removing the lines (splicing) is cleaner but changes line numbers for future.
        // Replacing with empty string preserves structure.

        lines[idxBrace] = ''; // Remove '}'
        lines[idxBrace + 1] = ''; // Remove blank line 1420
        lines[idxBrace + 2] = ''; // Remove comment 1421
        lines[idxEmit] = '';      // Remove io.emit 1422
        lines[idxEmit + 1] = '';  // Remove blank line 1423 if present

        // Verify we aren't removing "catch" block?
        // Line 1424 (Index 1423) is usually "} catch".
        console.log(`Next line (Index 1423): "${lines[1423]}"`);

        fs.writeFileSync(path, lines.join('\n'), 'utf8');
        console.log('SUCCESS: server.js patched.');
    } else {
        console.error('ERROR: Content mismatch. Aborting.');
        process.exit(1);
    }
} catch (e) {
    console.error('Script Error:', e);
    process.exit(1);
}
