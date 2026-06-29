// WABA Playground examples.
// Curated WABA examples are synced from the mature WABA repo via waba-modules.js;
// each is chosen to illustrate a distinct WABA feature (classical recovery,
// preferred multi-extension, budgeted optimum, budgeted enumeration, probabilities).

export const examples = {
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
    practical_deliberation: {
        label: 'Practical Deliberation',
        description: 'Budgeted belief revision: enumerate which defaults can be retained by overriding disruptions within a revision budget (arctic + sum + ub, β=20).',
        section: 'curated',
        source: 'module',
        moduleKey: 'practical_deliberation',
        preset: {
            semiringFamily: 'tropical',
            polarity: 'higher',
            defaultPolicy: 'legacy',
            monoid: 'sum',
            optimization: 'minimize',
            budgetMode: 'ub',
            budgetIntent: 'bounded',
            semantics: 'stable',
            optMode: 'ignore',
            beta: 20
        }
    },
    scientific_theory: {
        label: 'Scientific Theory',
        description: 'Rule-heavy framework: minimize total discarded cost (tropical + sum + ub).',
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
    probabilistic: {
        label: 'Weights as Probabilities',
        description: 'Surprisal encoding: tropical computes the most-probable proof (decode p = e^-w/1000).',
        section: 'curated',
        source: 'module',
        moduleKey: 'probabilistic',
        preset: {
            semiringFamily: 'tropical',
            polarity: 'lower',
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
};

if (typeof window !== 'undefined') {
    window.WABAExamples = examples;
}
