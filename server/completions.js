import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node.js";

const HTML_TAGS = [
    "a", "abbr", "address", "article", "aside", "audio", "b", "blockquote",
    "body", "br", "button", "canvas", "caption", "cite", "code", "col",
    "colgroup", "data", "datalist", "dd", "del", "details", "dfn", "dialog",
    "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure",
    "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header",
    "hr", "html", "i", "iframe", "img", "input", "ins", "kbd", "label",
    "legend", "li", "link", "main", "map", "mark", "menu", "meta", "meter",
    "nav", "noscript", "object", "ol", "optgroup", "option", "output", "p",
    "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp",
    "script", "section", "select", "small", "source", "span", "strong",
    "style", "sub", "summary", "sup", "table", "tbody", "td", "template",
    "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track",
    "u", "ul", "var", "video", "wbr",
];

const SMARK_KEYWORDS = ["end", "if", "else", "elseif", "for", "use", "import", "comment"];

const DIRECTIVE_PROPS = [
    { label: "smark-raw",    detail: "Treat block body as verbatim raw content",           insertText: "smark-raw: true" },
    { label: "smark-syntax", detail: "Embedded language for highlighting and formatting",   insertText: "smark-syntax: " },
    { label: "smark-format", detail: "Format body on document format (requires smark-raw)", insertText: "smark-format: " },
];

const SYNTAX_LANGS = [
    { label: "js",  detail: "JavaScript" },
    { label: "css", detail: "CSS" },
];

/**
 * Determines completion context from the text of the current line up to the cursor.
 * Returns null if not in a completable position.
 */
function getContext(lineUpTo) {
    const lastOpen = lineUpTo.lastIndexOf("[");
    if (lastOpen === -1) return null;

    const afterOpen = lineUpTo.slice(lastOpen + 1);

    // Cursor is past a closing ] — not in a header
    if (afterOpen.includes("]")) return null;

    // After smark-syntax: suggest language values
    if (/\bsmark-syntax:\s*["']?[\w]*$/.test(afterOpen)) {
        return { type: "syntax-lang" };
    }

    // After smark-raw: suggest true/false
    if (/\bsmark-raw:\s*["']?[\w]*$/.test(afterOpen)) {
        return { type: "bool-value" };
    }

    // After comma or = sign — suggest prop keys
    if (/[,=]\s*[\w-]*$/.test(afterOpen)) {
        return { type: "prop-key" };
    }

    // Right after [ with optional partial word — suggest block names
    if (/^\s*[\w-]*$/.test(afterOpen)) {
        return { type: "block-name" };
    }

    return null;
}

export function getCompletions(text, position) {
    const lines = text.split("\n");
    const lineUpTo = (lines[position.line] || "").slice(0, position.character);
    const ctx = getContext(lineUpTo);
    if (!ctx) return null;

    switch (ctx.type) {
        case "block-name": {
            const keywords = SMARK_KEYWORDS.map(kw => ({
                label: kw,
                kind: CompletionItemKind.Keyword,
            }));
            const tags = HTML_TAGS.map(tag => ({
                label: tag,
                kind: CompletionItemKind.Class,
                detail: "HTML element",
            }));
            return [...keywords, ...tags];
        }

        case "prop-key": {
            return DIRECTIVE_PROPS.map(p => ({
                label:      p.label,
                kind:       CompletionItemKind.Property,
                detail:     p.detail,
                insertText: p.insertText,
            }));
        }

        case "syntax-lang": {
            return SYNTAX_LANGS.map(l => ({
                label:  `"${l.label}"`,
                kind:   CompletionItemKind.EnumMember,
                detail: l.detail,
            }));
        }

        case "bool-value": {
            return [
                { label: "true",  kind: CompletionItemKind.Value },
                { label: "false", kind: CompletionItemKind.Value },
            ];
        }

        default:
            return null;
    }
}
