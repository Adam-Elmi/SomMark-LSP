function stripColors(text) {
    if (Array.isArray(text)) text = text.join("");
    if (typeof text !== 'string') return String(text);
    return text
        .replace(/\x1b\[[0-9;]*m/g, '') // Strip ANSI escape codes
        .replace(/<\$[^:]+:([\s\S]*?)\$>/g, '$1') // Improved: Strip custom tags
        .replace(/-{10,}/g, '') // Strip long CLI borders (---)
        .replace(/\{line\}/g, '\n')
        .replace(/\{N\}/g, '\n')
        .trim();
}

const samples = [
    "<$red:Expected token$> <$blue:'Top-level Block'$>",
    "<$red:Found: $[[roadmap]] $> <$cyan:test$>",
    "Line 1{N}Line 2",
];

samples.forEach(s => {
    console.log(`Original: [${s}]`);
    console.log(`Stripped:\n[${stripColors(s)}]\n`);
});
