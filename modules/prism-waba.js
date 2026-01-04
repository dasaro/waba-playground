/**
 * Prism.js WABA Language Definition
 * Syntax highlighting for WABA (Weighted Assumption-Based Argumentation) files
 */

(function (Prism) {
    Prism.languages.waba = {
        // Comments (% ...)
        'comment': {
            pattern: /%.*$/m,
            greedy: true
        },

        // Rules with arrow syntax (a <- b, c)
        'rule': {
            pattern: /([a-z_][a-z0-9_]*)\s*<-/i,
            inside: {
                'atom': /^[a-z_][a-z0-9_]*/i,
                'arrow': /<-/
            }
        },

        // Contraries (a, c_a)
        'contrary': {
            pattern: /\([^)]+\)/,
            inside: {
                'punctuation': /[(),]/,
                'atom': /[a-z_][a-z0-9_]*/i
            }
        },

        // Weights (atom : number)
        'weight': {
            pattern: /([a-z_][a-z0-9_]*)\s*:\s*(\d+)/i,
            inside: {
                'atom': /^[a-z_][a-z0-9_]*/i,
                'punctuation': /:/,
                'number': /\d+/
            }
        },

        // Atoms (lowercase identifiers)
        'atom': /\b[a-z_][a-z0-9_]*\b/i,

        // Numbers
        'number': /\b\d+\b/,

        // Punctuation
        'punctuation': /[(){},;:]/,

        // Operators
        'operator': /<-/
    };
}(Prism));
