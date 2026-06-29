// WABA Playground examples.
// Each curated example is chosen to make WABA's distinctive machinery visible:
// the inconsistency budget resolving conflicts that classical ABA cannot, with
// several weighted resolutions at *different, non-zero* costs. `probabilistic`
// is synced from the WABA repo (waba-modules.js); the conflict examples are
// inline so the cycle structure is self-documenting.

const CONFLICT_CYCLE = `%% THREE-WAY STANDOFF -- the inconsistency budget at work.
%%
%% Three positions in a debate, each rebutting the next in a cycle:
%%     growth --rebuts--> climate --rebuts--> welfare --rebuts--> growth
%%
%% Classical ABA has NO stable extension here: an odd rebuttal cycle is a
%% deadlock. (Set Budget mode = none and run -> UNSATISFIABLE.) WABA spends an
%% inconsistency budget to DISCARD the least-entrenched rebuttal and settle on a
%% coherent stance. Each assumption's weight is how entrenched that position is.
%%
%% As configured (Godel + sum + ub, beta = 8, enumerate) WABA returns exactly
%% THREE stable settlements, each dropping ONE rebuttal, at costs 3, 5 and 8 --
%% the cheapest concession is the optimum.

assumption(growth).   weight(growth, 8).
assumption(climate).  weight(climate, 3).
assumption(welfare).  weight(welfare, 5).

head(r1, against_climate).  body(r1, growth).   % against_climate <- growth   (growth rebuts climate, weight 8)
head(r2, against_welfare).  body(r2, climate).  % against_welfare <- climate  (climate rebuts welfare, weight 3)
head(r3, against_growth).   body(r3, welfare).  % against_growth  <- welfare  (welfare rebuts growth, weight 5)

contrary(climate, against_climate).   % against_climate attacks climate
contrary(welfare, against_welfare).   % against_welfare attacks welfare
contrary(growth,  against_growth).    % against_growth  attacks growth
`;

const DISPUTE_CHAIN = `%% DISPUTE CHAIN -- a longer rebuttal cycle (five linked claims).
%%
%%     c1 -> c2 -> c3 -> c4 -> c5 -> c1   (each claim rebuts the next; c5 loops back)
%%
%% Like the three-way standoff this is classically a deadlock (no stable
%% extension). WABA enumerates the minimal settlements: FIVE stable positions,
%% each breaking exactly ONE rebuttal. Bigger cycle, richer landscape.
%%
%% As configured (Godel + sum + ub, beta = 9, enumerate) the five settlements
%% cost 2, 4, 6, 7 and 9 -- breaking the weakest rebuttal (cost 2) is optimal.

assumption(c1). weight(c1, 9).
assumption(c2). weight(c2, 4).
assumption(c3). weight(c3, 7).
assumption(c4). weight(c4, 2).
assumption(c5). weight(c5, 6).

head(r1, no_c2). body(r1, c1).   % c1 rebuts c2  (weight 9)
head(r2, no_c3). body(r2, c2).   % c2 rebuts c3  (weight 4)
head(r3, no_c4). body(r3, c3).   % c3 rebuts c4  (weight 7)
head(r4, no_c5). body(r4, c4).   % c4 rebuts c5  (weight 2)
head(r5, no_c1). body(r5, c5).   % c5 rebuts c1  (weight 6)

contrary(c2, no_c2).
contrary(c3, no_c3).
contrary(c4, no_c4).
contrary(c5, no_c5).
contrary(c1, no_c1).
`;

export const examples = {
    conflict_cycle: {
        label: 'Three-Way Standoff',
        description: 'Inconsistency budget: an odd rebuttal cycle that classical ABA cannot settle (UNSAT). WABA discards the cheapest rebuttal — three settlements at costs 3, 5, 8 (Gödel + sum + ub, β=8).',
        section: 'curated',
        source: 'inline',
        code: CONFLICT_CYCLE,
        preset: {
            semiringFamily: 'godel',
            polarity: 'higher',
            defaultPolicy: 'legacy',
            monoid: 'sum',
            optimization: 'minimize',
            budgetMode: 'ub',
            budgetIntent: 'bounded',
            semantics: 'stable',
            optMode: 'ignore',
            beta: 8
        }
    },
    dispute_chain: {
        label: 'Dispute Chain',
        description: 'A longer (five-claim) rebuttal cycle: still a classical deadlock, but WABA enumerates five weighted settlements at costs 2, 4, 6, 7, 9 (Gödel + sum + ub, β=9).',
        section: 'curated',
        source: 'inline',
        code: DISPUTE_CHAIN,
        preset: {
            semiringFamily: 'godel',
            polarity: 'higher',
            defaultPolicy: 'legacy',
            monoid: 'sum',
            optimization: 'minimize',
            budgetMode: 'ub',
            budgetIntent: 'bounded',
            semantics: 'stable',
            optMode: 'ignore',
            beta: 9
        }
    },
    probabilistic: {
        label: 'Weights as Probabilities',
        description: 'Surprisal encoding (w = -1000·ln p): tropical sums surprisals, and the budget β acts as a probability threshold. At β=800 the improbable "slippery" objection (p≈0.45, surprisal 798) can be overridden — two stances at cost 0 and 798.',
        section: 'curated',
        source: 'module',
        moduleKey: 'probabilistic',
        preset: {
            semiringFamily: 'tropical',
            polarity: 'lower',
            defaultPolicy: 'legacy',
            monoid: 'sum',
            optimization: 'minimize',
            budgetMode: 'ub',
            budgetIntent: 'bounded',
            semantics: 'stable',
            optMode: 'ignore',
            beta: 800
        }
    },
};

if (typeof window !== 'undefined') {
    window.WABAExamples = examples;
}
