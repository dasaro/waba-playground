// WABA Playground examples.
// The curated set spans the FOUR algebras and several attack shapes so the
// distinctive machinery is visible: Gödel (weakest-link, single-premise cycle),
// Arctic (reward accumulation, joint attacks), Bottleneck-cost (worst-case, MAX
// monoid), and Tropical (weights as probabilities) -- plus one real scientific
// debate, Big Bang vs Steady-State, cast as Arctic evidential consilience (weights
// count independent converging evidence lines). `probabilistic` is synced from the
// WABA repo (waba-modules.js); the others are inline.

const CONFLICT_CYCLE = `%% THREE-WAY STANDOFF -- the inconsistency budget at work (Gödel / weakest link).
%%
%% Three positions in a debate, each rebutting the next in a cycle:
%%     growth --rebuts--> climate --rebuts--> welfare --rebuts--> growth
%%
%% Classical ABA has NO stable extension here: an odd rebuttal cycle is a
%% deadlock. (Set Budget mode = none and run -> UNSATISFIABLE.) WABA spends an
%% inconsistency budget to DISCARD the least-entrenched rebuttal and settle on a
%% coherent stance. Each rebuttal has a single ground, so its weight is just that
%% ground's weight (Gödel ⊗ = min of one element).
%%
%% As configured (Gödel + sum + ub, beta = 8, enumerate) WABA returns exactly
%% THREE stable settlements, each dropping ONE rebuttal, at costs 3, 5 and 8.

assumption(growth).   weight(growth, 8).
assumption(climate).  weight(climate, 3).
assumption(welfare).  weight(welfare, 5).

head(r1, against_climate).  body(r1, growth).   % growth rebuts climate (weight 8)
head(r2, against_welfare).  body(r2, climate).  % climate rebuts welfare (weight 3)
head(r3, against_growth).   body(r3, welfare).  % welfare rebuts growth (weight 5)

contrary(climate, against_climate).
contrary(welfare, against_welfare).
contrary(growth,  against_growth).
`;

const ARCTIC_GROUNDS = `%% ACCUMULATED OBJECTIONS -- Arctic / max-plus (reward accumulation).
%%
%% Three positions rebut each other in a cycle, but here each rebuttal is a JOINT
%% attack built from TWO grounds. Under Arctic the conjunction ⊗ = + ADDS the
%% grounds, so a rebuttal backed by two strong grounds is harder to set aside.
%% (Contrast Gödel, where a rebuttal is only as strong as its weakest ground.)
%% Joint attacks render as ⬥ junction nodes in the Assumption-Branching view.
%%
%% As configured (Tropical-higher = Arctic, sum + ub, beta = 9, enumerate) WABA
%% finds the three coherent positions, dropping the rebuttal it can most afford --
%% at costs 5, 7 and 9 (= the SUMMED grounds behind each rebuttal).

assumption(eco).    weight(eco, 5).
assumption(jobs).   weight(jobs, 4).
assumption(health). weight(health, 3).
assumption(ground_a). weight(ground_a, 4).   % extra grounds backing each rebuttal
assumption(ground_b). weight(ground_b, 1).
assumption(ground_c). weight(ground_c, 4).

head(r1, against_jobs).   body(r1, eco).    body(r1, ground_a).   % eco + ground_a rebut jobs   (5+4=9)
head(r2, against_health). body(r2, jobs).   body(r2, ground_b).   % jobs + ground_b rebut health (4+1=5)
head(r3, against_eco).    body(r3, health). body(r3, ground_c).   % health + ground_c rebut eco  (3+4=7)

contrary(jobs,   against_jobs).
contrary(health, against_health).
contrary(eco,    against_eco).
contrary(ground_a, c_ga). contrary(ground_b, c_gb). contrary(ground_c, c_gc).
`;

const BOTTLENECK_WORSTCASE = `%% WORST-CASE CONCESSION -- Bottleneck-cost (min/max) + the MAX monoid.
%%
%% Three competing decisions, each blocked by a JOINT objection built from two
%% grounds. Under Bottleneck-cost the conjunction ⊗ = max, so an objection is only
%% as strong as its WORST ground. And the MAX monoid scores an extension by its
%% single worst concession (not the total). Together these mean WABA can retain
%% MORE positions cheaply -- paying only for the single hardest block it drops.
%%
%% As configured (Gödel-lower = Bottleneck-cost, max + ub, beta = 8, enumerate)
%% the settlements include retaining ALL THREE decisions by paying just the
%% hardest block (cost 8), alongside the two-decision settlements (5, 6, 8).

assumption(merge).  weight(merge, 3).
assumption(expand). weight(expand, 6).
assumption(hold).   weight(hold, 4).
assumption(caveat_a). weight(caveat_a, 5).   % grounds for each block (the worst one decides)
assumption(caveat_b). weight(caveat_b, 2).
assumption(caveat_c). weight(caveat_c, 8).

head(r1, block_expand). body(r1, merge).  body(r1, caveat_a).   % max(3,5) = 5
head(r2, block_hold).   body(r2, expand). body(r2, caveat_b).   % max(6,2) = 6
head(r3, block_merge).  body(r3, hold).   body(r3, caveat_c).   % max(4,8) = 8

contrary(expand, block_expand).
contrary(hold,   block_hold).
contrary(merge,  block_merge).
contrary(caveat_a, c_ca). contrary(caveat_b, c_cb). contrary(caveat_c, c_cc).
`;

const BIG_BANG_STEADY_STATE = `%% BIG BANG vs STEADY-STATE -- evidential consilience (Arctic / max-plus).
%%
%% A real 20th-century cosmology debate: the hot Big Bang (Gamow; Λ-CDM today) vs the
%% eternal, unchanging Steady-State universe with continuous matter creation (Bondi,
%% Gold & Hoyle, 1948). Here a weight counts INDEPENDENT converging lines of evidence
%% -- one "evidence unit" each -- so under Arctic the conjunction ⊗ = + ADDS the lines:
%% the joint case against Steady-State is exactly as strong as the NUMBER of independent
%% observations it rests on (this is Whewell's "consilience of inductions").
%%
%% Five methodologically distinct observations each require a hot, dense, evolving past
%% and so refute an eternal steady state (each weight 1):
assumption(cmb_exists).     weight(cmb_exists, 1).     % the cosmic microwave background exists (Penzias & Wilson, 1965)
assumption(cmb_blackbody).  weight(cmb_blackbody, 1).  % the CMB is a near-perfect blackbody (COBE/FIRAS) -- relic of a hot past
assumption(he4_abundance).  weight(he4_abundance, 1).  % primordial helium-4 ≈ 25% by mass (BBN) -- far more than stars can make
assumption(deuterium).      weight(deuterium, 1).      % primordial deuterium D/H (BBN) -- destroyed, not made, in stars
assumption(radio_counts).   weight(radio_counts, 1).   % radio-source / quasar counts evolve with cosmic time (Ryle)

%% The two rival stances:
assumption(big_bang).       weight(big_bang, 1).       % the hot Big Bang
assumption(steady_state).   weight(steady_state, 1).   % the eternal Steady-State universe

%% not_steady <- all five lines.  Arctic ⊗ = + makes its weight 1+1+1+1+1 = 5
%% ("a hot dense past is required"): the accumulated strength of the converging case.
head(r1, not_steady).
body(r1, cmb_exists). body(r1, cmb_blackbody). body(r1, he4_abundance).
body(r1, deuterium).  body(r1, radio_counts).

%% contrary(X, Y): "Y attacks X"  (contrary is a TOTAL function -- one per assumption)
contrary(steady_state, not_steady).   % the weight-5 converging case refutes Steady-State
contrary(big_bang, steady_state).     % Steady-State, if still held, attacks Big Bang (weight 1)
%% the five observations are unattacked (their contraries are never derivable):
contrary(cmb_exists, c1). contrary(cmb_blackbody, c2). contrary(he4_abundance, c3).
contrary(deuterium, c4).  contrary(radio_counts, c5).

%% As configured (Tropical-higher = Arctic, sum + ub, β = 5, enumerate):
%%   * the accepted (cost-0) extension is  in(big_bang), out(steady_state)  = today's
%%     SETTLED consensus. Big Bang wins at ZERO cost -- no evidence has to be set aside.
%%   * a Steady-State extension exists ONLY at β ≥ 5, and it costs exactly 5: to still
%%     hold Steady-State you must DISCARD the entire converging body of evidence (all 5
%%     lines). So β = 5 literally measures how much evidence a holdout must deny.
%%
%% NOTE: the integer weights are a modelling COUNT of independent evidence lines, not
%% physical constants ("5" is not a measured quantity). The primordial lithium-7
%% discrepancy is a real but tolerated WITHIN-model anomaly, not support for Steady-State.
`;

export const examples = {
    conflict_cycle: {
        label: 'Three-Way Standoff',
        description: 'Gödel / weakest link: an odd rebuttal cycle classical ABA cannot settle (UNSAT). WABA discards the cheapest rebuttal — three settlements at costs 3, 5, 8 (Gödel + sum + ub, β=8).',
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
    arctic_grounds: {
        label: 'Accumulated Objections',
        description: 'Arctic / max-plus: a JOINT rebuttal gains force from each of its grounds (⊗=+), so well-supported rebuttals cost more to drop. Three positions at costs 5, 7, 9 (Tropical-higher = arctic, sum + ub, β=9). Joint attacks show as ⬥ junctions.',
        section: 'curated',
        source: 'inline',
        code: ARCTIC_GROUNDS,
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
            beta: 9
        }
    },
    bottleneck_worstcase: {
        label: 'Worst-Case Concession',
        description: 'Bottleneck-cost (min/max) + MAX monoid: a rebuttal is as strong as its WORST ground (⊗=max), and an extension costs only its single worst concession — so you can keep all three decisions by paying just the hardest block (8) (Gödel-lower = bottleneck, max + ub, β=8).',
        section: 'curated',
        source: 'inline',
        code: BOTTLENECK_WORSTCASE,
        preset: {
            semiringFamily: 'godel',
            polarity: 'lower',
            defaultPolicy: 'legacy',
            monoid: 'max',
            optimization: 'minimize',
            budgetMode: 'ub',
            budgetIntent: 'bounded',
            semantics: 'stable',
            optMode: 'ignore',
            beta: 8
        }
    },
    probabilistic: {
        label: 'Weights as Probabilities',
        description: 'Tropical / min-plus: surprisal encoding (w = -1000·ln p), so β acts as a probability threshold. At β=800 the improbable "slippery" objection (p≈0.45, surprisal 798) can be overridden — two stances at cost 0 and 798.',
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
    big_bang_steady_state: {
        label: 'Big Bang vs Steady-State',
        description: 'A real cosmology debate as evidential consilience (Arctic / max-plus): a weight counts independent converging evidence lines and ⊗=+ sums them. Five observations (the CMB, its blackbody spectrum, primordial helium-4 & deuterium, evolving radio-source counts) jointly refute Steady-State with weight 5. Accepted at cost 0: Big Bang — today\'s settled consensus; a Steady-State holdout is admissible only at β=5, the cost of dismissing all five lines. (Tropical-higher = arctic, sum + ub, β=5.)',
        section: 'curated',
        source: 'inline',
        code: BIG_BANG_STEADY_STATE,
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
            beta: 5
        }
    },
};

if (typeof window !== 'undefined') {
    window.WABAExamples = examples;
}
