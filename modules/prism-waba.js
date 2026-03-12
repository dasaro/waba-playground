/**
 * Prism.js language definition for the WABA simple editor.
 */
(function registerWabaLanguage(Prism) {
    Prism.languages.waba = {
        comment: {
            pattern: /%.*$/m,
            greedy: true
        },
        rule: {
            pattern: /([a-z_][a-z0-9_]*)\s*<-/i,
            inside: {
                atom: /^[a-z_][a-z0-9_]*/i,
                arrow: /<-/
            }
        },
        contrary: {
            pattern: /\([^)]+\)/,
            inside: {
                punctuation: /[(),]/,
                atom: /[a-z_][a-z0-9_]*/i
            }
        },
        weight: {
            pattern: /([a-z_][a-z0-9_]*)\s*:\s*(\d+)/i,
            inside: {
                atom: /^[a-z_][a-z0-9_]*/i,
                punctuation: /:/,
                number: /\d+/
            }
        },
        atom: /\b[a-z_][a-z0-9_]*\b/i,
        number: /\b\d+\b/,
        punctuation: /[(){},;:]/,
        operator: /<-/
    };
}(Prism));
