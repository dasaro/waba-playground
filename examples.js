// WABA Playground examples.
// Curated WABA examples are synced from the mature WABA repo via waba-modules.js.
// Playground demos remain inline here as visualization fixtures.

const demoSimple = `%% Simple Example - Mixed Attacks
assumption(a).
assumption(b).
assumption(c).

weight(a, 80).
weight(b, 60).

head(r1, c_a).
body(r1, b).
weight(c_a, 70).

head(r2, c_c).
weight(c_c, 50).

contrary(a, c_a).
contrary(b, c_c).
contrary(c, c_c).
`;

const demoLinear = `%% Linear Topology Example
assumption(a).
assumption(b).
assumption(c).
assumption(d).

weight(a, 90).
weight(b, 70).
weight(c, 50).
weight(d, 30).

head(r1, c_a).
weight(c_a, 80).

head(r2, c_b).
body(r2, a).
weight(c_b, 85).

head(r3, c_c).
body(r3, b).
weight(c_c, 65).

head(r4, c_d).
body(r4, c).
weight(c_d, 45).

contrary(a, c_a).
contrary(b, c_b).
contrary(c, c_c).
contrary(d, c_d).
`;

const demoCycle = `%% Cycle Topology Example
assumption(a).
assumption(b).
assumption(c).

weight(a, 80).
weight(b, 70).
weight(c, 60).

head(r1, c_a).
body(r1, c).
weight(c_a, 75).

head(r2, c_b).
body(r2, a).
weight(c_b, 85).

head(r3, c_c).
body(r3, b).
weight(c_c, 65).

contrary(a, c_a).
contrary(b, c_b).
contrary(c, c_c).
`;

const demoTree = `%% Tree Topology Example
assumption(a).
assumption(b).
assumption(c).
assumption(d).

weight(a, 100).
weight(b, 80).
weight(c, 70).
weight(d, 50).

head(r1, c_a).
weight(c_a, 90).

head(r2, c_b).
body(r2, a).
weight(c_b, 85).

head(r3, c_c).
body(r3, a).
weight(c_c, 75).

head(r4, c_d).
body(r4, b).
weight(c_d, 60).

contrary(a, c_a).
contrary(b, c_b).
contrary(c, c_c).
contrary(d, c_d).
`;

const demoComplete = `%% Complete Topology Example
assumption(a).
assumption(b).
assumption(c).

weight(a, 90).
weight(b, 80).
weight(c, 70).

head(r1, c_a).
body(r1, b).
body(r1, c).
weight(c_a, 95).

head(r2, c_b).
body(r2, a).
body(r2, c).
weight(c_b, 90).

head(r3, c_c).
body(r3, a).
body(r3, b).
weight(c_c, 85).

contrary(a, c_a).
contrary(b, c_b).
contrary(c, c_c).
`;

const demoIsolated = `%% Isolated Components Example
assumption(a1).
assumption(a2).
assumption(b1).
assumption(b2).

weight(a1, 90).
weight(a2, 80).
weight(b1, 70).
weight(b2, 60).

head(r1, c_a1).
body(r1, a2).
weight(c_a1, 85).

head(r2, c_a2).
body(r2, a1).
weight(c_a2, 82).

head(r3, c_b1).
body(r3, b2).
weight(c_b1, 65).

head(r4, c_b2).
body(r4, b1).
weight(c_b2, 62).

contrary(a1, c_a1).
contrary(a2, c_a2).
contrary(b1, c_b1).
contrary(b2, c_b2).
`;

export const examples = {
    simple_attack: {
        label: 'Simple Attack',
        description: 'Classical smoke run from the mature WABA surface.',
        section: 'curated',
        source: 'module',
        moduleKey: 'simple_attack',
        preset: {
            semiringFamily: 'godel',
            polarity: 'higher',
            defaultPolicy: 'legacy',
            monoid: 'sum',
            optimization: 'minimize',
            budgetMode: 'none',
            budgetIntent: 'no_discard',
            semantics: 'stable',
            optMode: 'ignore',
            beta: 0
        }
    },
    practical_deliberation: {
        label: 'Practical Deliberation',
        description: 'Curated planning example with count-bounded stable reasoning.',
        section: 'curated',
        source: 'module',
        moduleKey: 'practical_deliberation',
        preset: {
            semiringFamily: 'tropical',
            polarity: 'higher',
            defaultPolicy: 'legacy',
            monoid: 'count',
            optimization: 'minimize',
            budgetMode: 'ub',
            budgetIntent: 'bounded',
            semantics: 'stable',
            optMode: 'optN',
            beta: 2
        }
    },
    scientific_theory: {
        label: 'Scientific Theory',
        description: 'Curated scientific theory-selection example with tropical costs.',
        section: 'curated',
        source: 'module',
        moduleKey: 'scientific_theory',
        preset: {
            semiringFamily: 'tropical',
            polarity: 'lower',
            defaultPolicy: 'legacy',
            monoid: 'sum',
            optimization: 'minimize',
            budgetMode: 'ub',
            budgetIntent: 'bounded',
            semantics: 'stable',
            optMode: 'optN',
            beta: 275
        }
    },
    aspforaba_journal_example: {
        label: 'Reference Preferred',
        description: 'Exact preferred semantics against the public ASPforABA comparison case.',
        section: 'curated',
        source: 'module',
        moduleKey: 'aspforaba_journal_example',
        preset: {
            semiringFamily: 'godel',
            polarity: 'higher',
            defaultPolicy: 'legacy',
            monoid: 'sum',
            optimization: 'minimize',
            budgetMode: 'none',
            budgetIntent: 'no_discard',
            semantics: 'preferred',
            optMode: 'ignore',
            beta: 0
        }
    },
    strong_inference_bounded_lies: {
        label: 'Strong Inference',
        description: 'Reference example extracted from bounded temporary rejection.',
        section: 'curated',
        source: 'module',
        moduleKey: 'strong_inference_bounded_lies',
        preset: {
            semiringFamily: 'godel',
            polarity: 'higher',
            defaultPolicy: 'legacy',
            monoid: 'count',
            optimization: 'minimize',
            budgetMode: 'ub',
            budgetIntent: 'bounded',
            semantics: 'stable',
            optMode: 'optN',
            beta: 2
        }
    },
    expanding_universe_argumentation: {
        label: 'Expanding Universe',
        description: 'Reference scientific-discovery example with non-trivial derivation chains.',
        section: 'curated',
        source: 'module',
        moduleKey: 'expanding_universe_argumentation',
        preset: {
            semiringFamily: 'godel',
            polarity: 'higher',
            defaultPolicy: 'legacy',
            monoid: 'max',
            optimization: 'minimize',
            budgetMode: 'none',
            budgetIntent: 'no_discard',
            semantics: 'stable',
            optMode: 'ignore',
            beta: 0
        }
    },
    demo_simple: {
        label: 'Demo: Simple',
        description: 'Visualization fixture with mixed derived and non-derived attacks.',
        section: 'demos',
        source: 'inline',
        code: demoSimple,
        preset: {
            semiringFamily: 'godel',
            polarity: 'higher',
            defaultPolicy: 'legacy',
            monoid: 'sum',
            optimization: 'minimize',
            budgetMode: 'none',
            budgetIntent: 'no_discard',
            semantics: 'stable',
            optMode: 'ignore',
            beta: 0
        }
    },
    demo_linear: {
        label: 'Demo: Linear Topology',
        description: 'Visualization fixture for line-shaped attack graphs.',
        section: 'demos',
        source: 'inline',
        code: demoLinear,
        preset: {
            semiringFamily: 'godel',
            polarity: 'higher',
            defaultPolicy: 'legacy',
            monoid: 'sum',
            optimization: 'minimize',
            budgetMode: 'none',
            budgetIntent: 'no_discard',
            semantics: 'stable',
            optMode: 'ignore',
            beta: 0
        }
    },
    demo_cycle: {
        label: 'Demo: Cycle Topology',
        description: 'Visualization fixture for cyclic attacks.',
        section: 'demos',
        source: 'inline',
        code: demoCycle,
        preset: {
            semiringFamily: 'godel',
            polarity: 'higher',
            defaultPolicy: 'legacy',
            monoid: 'sum',
            optimization: 'minimize',
            budgetMode: 'none',
            budgetIntent: 'no_discard',
            semantics: 'stable',
            optMode: 'ignore',
            beta: 0
        }
    },
    demo_tree: {
        label: 'Demo: Tree Topology',
        description: 'Visualization fixture for branching attack graphs.',
        section: 'demos',
        source: 'inline',
        code: demoTree,
        preset: {
            semiringFamily: 'godel',
            polarity: 'higher',
            defaultPolicy: 'legacy',
            monoid: 'sum',
            optimization: 'minimize',
            budgetMode: 'none',
            budgetIntent: 'no_discard',
            semantics: 'stable',
            optMode: 'ignore',
            beta: 0
        }
    },
    demo_complete: {
        label: 'Demo: Complete Topology',
        description: 'Visualization fixture for dense attack graphs.',
        section: 'demos',
        source: 'inline',
        code: demoComplete,
        preset: {
            semiringFamily: 'godel',
            polarity: 'higher',
            defaultPolicy: 'legacy',
            monoid: 'sum',
            optimization: 'minimize',
            budgetMode: 'none',
            budgetIntent: 'no_discard',
            semantics: 'stable',
            optMode: 'ignore',
            beta: 0
        }
    },
    demo_isolated: {
        label: 'Demo: Isolated Components',
        description: 'Visualization fixture for disconnected conflict islands.',
        section: 'demos',
        source: 'inline',
        code: demoIsolated,
        preset: {
            semiringFamily: 'godel',
            polarity: 'higher',
            defaultPolicy: 'legacy',
            monoid: 'sum',
            optimization: 'minimize',
            budgetMode: 'none',
            budgetIntent: 'no_discard',
            semantics: 'stable',
            optMode: 'ignore',
            beta: 0
        }
    }
};

if (typeof window !== 'undefined') {
    window.WABAExamples = examples;
}
