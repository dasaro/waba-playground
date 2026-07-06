// WABA Playground examples.
// Two families of curated examples:
//  (1) Algebra demos across the four semirings: Gödel (weakest-link cycle),
//      Arctic (joint accumulation), Bottleneck-cost (worst-case + MAX monoid),
//      Tropical (weights as probabilities).
//  (2) Real SCIENTIFIC DEBATES whose weights take a natural meaning under the
//      matching algebra, with the WABA-accepted (min-cost) extension reproducing
//      today's scientific consensus and β measuring how much evidence a holdout
//      must dismiss:
//        - big_bang_steady_state  : consilience              (Arctic,  β=5,  cost-0 consensus)
//        - smoking_lung_cancer    : Bradford-Hill consilience (Arctic,  β=54, cost-0 consensus)
//        - solar_neutrino         : combined significance     (Tropical, β=53, cost-0 consensus)
//        - age_of_earth           : weakest-link              (Gödel,   β=80, cost-0 consensus)
//        - plate_tectonics        : consilience w/ a TOLERATED objection (Arctic, β=19, cost-7 consensus)
//     Each debate is modelled as a DERIVATION CHAIN: no evidence assumption attacks a
//     stance directly. Instead the evidence combines into intermediate CLAIMS which
//     combine into the refutation of the rival. Because the ⊗ operators are associative
//     (arctic/tropical + , gödel min) the propagated weights — and the β thresholds —
//     are unchanged; the chains just expose the debate's inferential structure, best
//     viewed in Assumption-Branching mode (which renders every intermediate claim node).
// `probabilistic` is synced from the WABA repo (waba-modules.js); the rest are inline.

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

%% DERIVATION CHAIN (no observation attacks a stance directly): the five lines first
%% combine into three intermediate CLAIMS, which in turn combine into not_steady.
%% Arctic ⊗ = + is associative, so the accumulated strength is still 1+1+1+1+1 = 5 --
%% but the graph now shows the debate's inferential STRUCTURE rather than a flat pile.
%%   hot_dense_past             <- cmb_exists, cmb_blackbody     (⊗=+  1+1 = 2)  relic thermal bath
%%   primordial_nucleosynthesis <- he4_abundance, deuterium      (⊗=+  1+1 = 2)  BBN in the first minutes
%%   cosmic_evolution           <- radio_counts                 (      1)      the universe evolves
%%   not_steady                 <- the three claims above        (⊗=+  2+2+1 = 5)
head(r_hot, hot_dense_past).
body(r_hot, cmb_exists; r_hot, cmb_blackbody).
head(r_bbn, primordial_nucleosynthesis).
body(r_bbn, he4_abundance; r_bbn, deuterium).
head(r_evo, cosmic_evolution).
body(r_evo, radio_counts).
head(r_ns, not_steady).
body(r_ns, hot_dense_past; r_ns, primordial_nucleosynthesis; r_ns, cosmic_evolution).

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

const SMOKING_LUNG_CANCER = `%% ============================================================================
%% WABA curated debate: "Smoking causes lung cancer"
%% ============================================================================
%% Guide: Doll & Hill / Bradford-Hill causal criteria  vs  R. A. Fisher's
%% "constitutional hypothesis" (a hidden genetic factor causes BOTH smoking and
%% lung cancer -> confounding, not causation).
%%
%% Semiring : arctic  (oplus=max, otimes=+, 1bar=0, 0bar=#inf) -- CONSILIENCE.
%%            The Bradford-Hill lines are INDEPENDENT lines of evidence; the
%%            support of a joint argument is the SUM of its premises' support
%%            (otimes=+), and oplus=max keeps the best-supported derivation. So
%%            the weight of the argument refuting confounding = accumulated evid.
%% Monoid   : sum   -- total tolerated objection-severity when discarding.
%% Budget   : ub    -- inconsistency budget beta = how much accumulated evidence
%%            you are willing to DISMISS to hold the rival (confounding) stance.
%% Weights  : integer encoding of the relative evidential force of each line
%%            (a modelling encoding, NOT a physical constant). Decisive lines
%%            (strength of association RR~10-20, dose-response, reversibility)
%%            carry the most weight.
%%
%% ABA rigor:
%%   * contrary is a TOTAL FUNCTION -- exactly one contrary atom per assumption.
%%     The evidence lines attack the confounding stance by ALL deriving its
%%     SINGLE contrary atom (no_conf) via ONE joint rule, combined by otimes=+.
%%   * every assumption has a contrary (dummy c_* for the settled evidence leaves).
%%   * flat: no assumption is ever a rule head (heads are no_conf / no_caus).
%% ============================================================================

%% ---------------------------------------------------------------------------
%% THE TWO RIVAL STANCES
%% ---------------------------------------------------------------------------
%% caus : "smoking causes lung cancer"  (the modern consensus)
assumption(caus).   contrary(caus, no_caus).
%% conf : Fisher's constitutional / confounding hypothesis
%%        "a hidden genetic factor causes both smoking and cancer; no causation"
%%   Given a modest positive weight: Fisher's confounding argument is a serious
%%   a-priori statistical objection (it has real force), just decisively
%%   outweighed by the accumulated Bradford-Hill case (54 >> 8).
assumption(conf).   weight(conf, 8).   contrary(conf, no_conf).

%% ---------------------------------------------------------------------------
%% THE BRADFORD-HILL LINES OF EVIDENCE  (independent evidence assumptions)
%% weight = integer encoding of that line's evidential force
%% ---------------------------------------------------------------------------
assumption(assoc).      weight(assoc, 10).   contrary(assoc, c_assoc).      % strong association, RR ~ 10-20
assumption(dose).       weight(dose, 9).     contrary(dose, c_dose).        % dose-response / biological gradient
assumption(reverse).    weight(reverse, 9).  contrary(reverse, c_reverse).  % reversibility: risk falls after cessation
assumption(consist).    weight(consist, 7).  contrary(consist, c_consist).  % consistency across many studies/populations
assumption(mechanism).  weight(mechanism, 6).contrary(mechanism, c_mech).   % mechanism: carcinogens in tar
assumption(temporal).   weight(temporal, 5). contrary(temporal, c_temporal).% temporality: smoking precedes cancer
assumption(coherent).   weight(coherent, 4). contrary(coherent, c_coherent).% coherence with known biology
assumption(animal).     weight(animal, 4).   contrary(animal, c_animal).    % animal carcinogenesis experiments

%% ---------------------------------------------------------------------------
%% ARGUMENTS (rule heads are derived atoms, never assumptions)
%% ---------------------------------------------------------------------------
%% DERIVATION CHAIN (no evidence line attacks a stance directly): the eight Bradford-
%% Hill lines first fuse into THREE intermediate strands of the causal argument, which
%% then combine to refute confounding. arctic otimes=+ is associative, so the total is
%% still 54 -- but the graph now shows HOW the case is built, strand by strand.
%%   not_confoundable        <- assoc, dose, reverse            (⊗=+ 10+9+9 = 28)
%%       a strong, dose-graded, reversible association is not explicable by confounding
%%   biologically_causal     <- mechanism, animal, coherent     (⊗=+ 6+4+4 = 14)
%%       tar carcinogens + animal experiments + coherent biology establish a mechanism
%%   epidemiologically_sound <- consist, temporal               (⊗=+ 7+5 = 12)
%%       consistent across populations, and smoking precedes the cancer
%%   no_conf                 <- the three strands above         (⊗=+ 28+14+12 = 54)
head(r_str, not_confoundable).
body(r_str, assoc; r_str, dose; r_str, reverse).
head(r_bio, biologically_causal).
body(r_bio, mechanism; r_bio, animal; r_bio, coherent).
head(r_epi, epidemiologically_sound).
body(r_epi, consist; r_epi, temporal).
head(r_conf, no_conf).
body(r_conf, not_confoundable; r_conf, biologically_causal; r_conf, epidemiologically_sound).

%% Fisher's side is itself a short chain (his inferential step, not a bare attack):
%%   genetic_common_cause <- conf                 a hidden genotype drives both habits
%%   no_caus              <- genetic_common_cause a common cause => no DIRECT causation
head(r_fish1, genetic_common_cause). body(r_fish1, conf).
head(r_fish2, no_caus).              body(r_fish2, genetic_common_cause).
`;

const SOLAR_NEUTRINO = `%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% SOLAR NEUTRINO PROBLEM
%% Neutrino oscillation (SSM correct) vs. Standard-Solar-Model error
%%
%% STORY
%% Homestake / Kamiokande / SAGE / GALLEX saw a solar electron-neutrino flux
%% ~1/3 of the Standard Solar Model (SSM) prediction. Two rival explanations:
%%   (A) the SSM is WRONG (the Sun really makes fewer neutrinos), or
%%   (B) neutrinos OSCILLATE (change flavour en route; the SSM is correct).
%% SNO (2001-02) settled it with TWO independent channels:
%%   - charged-current (CC): the electron-neutrino flux, reduced;
%%   - neutral-current (NC): the TOTAL all-flavour flux, which MATCHED the SSM.
%% A matched total flux means the Sun makes the predicted number of neutrinos,
%% so the SSM is NOT wrong; the electron deficit is flavour change. The combined
%% CC+NC evidence reached ~5.3 sigma -> discovery. Nobel Prize 2015.
%%
%% SEMIRING: tropical (min-plus), a COST/surprisal algebra.
%%   otimes = +   : premises of ONE joint argument accumulate SURPRISAL. The
%%                  significances of two INDEPENDENT measurements ADD (their
%%                  -log-p / chi-square surprisals accumulate additively).
%%   oplus  = min : among alternative proofs, keep the LEAST-surprising one.
%%   Weights = statistical significance in units of 0.1 sigma -- a modelling
%%             ENCODING of -log-p surprisal (see NATURALNESS caveat), NOT a
%%             claim that raw sigma adds (independent sigma add in quadrature;
%%             the surprisal that otimes=+ sums is the correct additive quantity).
%%
%% MONOID: sum. Extension cost = total significance of the SNO evidence a
%%   position must DISMISS (discard) to survive. sum = total ignored significance.
%%
%% BUDGET beta (UPPER bound, ub): the inconsistency budget = how much established
%%   significance a position is allowed to wave away. beta is a DISCOVERY /
%%   significance THRESHOLD: below it, the SNO result cannot be dismissed and the
%%   holdout "SSM is wrong" position is INFEASIBLE.
%%
%% WEIGHT ENCODING (units of 0.1 sigma; modelling encoding, not physical values)
%%   sno_cc (electron-nu deficit)   : 25  (~2.5 sigma on its own)
%%   sno_nc (total flux matches SSM): 28  (~2.8 sigma on its own)
%%   joint flavour_change argument  : 25 + 28 = 53  (~5.3 sigma) via otimes=+
%% Neither channel alone crosses discovery; SUMMED (tropical otimes=+) they do.
%%
%% EXPECTED RESULT (verified by enumeration + optimization)
%%   Min-cost accepted extension (cost 0, for every beta) = CONSENSUS:
%%     in: oscillation, sno_cc, sno_nc ; out: ssm_wrong
%%     (flavour_change is derived and DEFEATS ssm_wrong; nothing is discarded).
%%   The holdout "ssm_wrong in" costs 53 (it must discard the 5.3-sigma SNO
%%   attack) and is INFEASIBLE until beta >= 53. Threshold beta* = 53.
%%
%% USAGE (sweep beta):
%%   clingo --warn=no-atom-undefined -n 0 -c beta=B \
%%     WABA/core/base.lp WABA/semiring/tropical.lp WABA/defaults/legacy.lp \
%%     WABA/monoid/sum.lp WABA/constraint/ub.lp \
%%     WABA/filter/projection.lp WABA/semantics/stable.lp solar_neutrino.lp
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%% ============================================================================
%% ASSUMPTIONS
%% ============================================================================
assumption(oscillation).   % Position B: neutrinos oscillate (SSM correct)
assumption(ssm_wrong).     % Position A: the Standard Solar Model is wrong
assumption(sno_cc).        % Evidence leaf: SNO charged-current (e-nu deficit)
assumption(sno_nc).        % Evidence leaf: SNO neutral-current (total matches SSM)

%% ============================================================================
%% WEIGHTS (significance in units of 0.1 sigma; modelling encoding)
%% ============================================================================
weight(sno_cc, 25).        % ~2.5 sigma  (electron-neutrino deficit, on its own)
weight(sno_nc, 28).        % ~2.8 sigma  (total all-flavour flux matches SSM)

%% ============================================================================
%% RULES
%% The decisive joint argument: SNO's two INDEPENDENT channels together
%% demonstrate flavour change. Under tropical otimes=+ its surprisal is the SUM
%% 25 + 28 = 53 (~5.3 sigma). flavour_change is the CONTRARY of ssm_wrong:
%% a matched total flux (NC) plus a reduced electron flux (CC) proves the Sun
%% makes the predicted neutrinos, refuting "the SSM is wrong".
%% ============================================================================
%% DERIVATION CHAIN (neither channel attacks a stance directly): each SNO channel
%% first yields its own physical CLAIM, and the two claims combine into flavour_change.
%% tropical otimes=+ is associative, so the surprisal is still 28+25 = 53 (~5.3 sigma) --
%% but the graph now shows the actual physics: total-conserved AND electron-deficit
%% together force flavour change.
%%   total_flux_conserved <- sno_nc                 (28)  NC: the Sun makes the SSM number
%%   electron_deficit     <- sno_cc                 (25)  CC: only 1/3 arrive as electron-nu
%%   flavour_change       <- the two claims above   (⊗=+ 28+25 = 53)
head(r_nc, total_flux_conserved). body(r_nc, sno_nc).
head(r_cc, electron_deficit).     body(r_cc, sno_cc).
head(r_fc, flavour_change).
body(r_fc, total_flux_conserved; r_fc, electron_deficit).

%% ============================================================================
%% CONTRARIES (TOTAL FUNCTION: exactly one contrary atom per assumption)
%% ============================================================================
contrary(ssm_wrong, flavour_change).  % the SNO joint argument refutes position A
contrary(oscillation, c_osc).         % dummy: nothing derives c_osc (B unattacked)
contrary(sno_cc, c_cc).               % dummy: evidence leaf, never attacked
contrary(sno_nc, c_nc).               % dummy: evidence leaf, never attacked

%% Budget beta is supplied on the command line (-c beta=B).
budget(beta).
`;

const AGE_OF_EARTH = `%% =====================================================================
%% Age of the Earth: Kelvin's cooling estimate vs radiometric ~4.54 Gyr
%% =====================================================================
%% Semiring: godel  (oplus=max over alternative derivations, otimes=min over a
%%                   rule's premises = WEAKEST-LINK; higher weight = higher confidence).
%% Monoid  : sum (or max) over discarded-attack weights = inconsistency cost.
%% Budget  : ub (upper bound). beta = how much objection-strength a holdout may dismiss.
%%
%% Weights are a 1..100 CONFIDENCE encoding (a modelling device, NOT physical
%% constants): 100 = essentially certain, ~5 = a premise the evidence has refuted.
%%
%% THE DEBATE
%%   Position A (young_earth): Kelvin (1862), Earth ~20-100 Myr, from conductive
%%     cooling of an initially molten Earth. His conclusion is a CONJUNCTION of
%%     premises; the crucial one, "NO internal heat source" (no_internal_heat), is
%%     FALSE -- radioactivity (1896-1903) supplies internal heat and voids the calc.
%%   Position B (old_earth): radiometric dating gives ~4.54 Gyr; premises all strong.
%%
%% WHY godel / WEAKEST-LINK is the natural algebra here:
%%   Kelvin's young-Earth argument is a chain whose otimes=min strength is dragged
%%   down to its weakest premise. Once no_internal_heat's confidence collapses to ~5,
%%   the whole Kelvin argument is only strength 5 -- a WEAK attack on old_earth. The
%%   radiometric argument's weakest premise is still strong (~80), so its attack on
%%   young_earth is STRONG.
%%
%% CONSENSUS-VS-HOLDOUT STRUCTURE (asymmetric, following the settled-science
%% pattern): the ACCEPTED theory (old_earth) is defended for FREE by permanent,
%% strong radiometric evidence that refutes its rival; the rival (young_earth) is
%% attacked by that strength-80 evidence at all times. To overturn the consensus a
%% holdout must PAY to discard that strong objection (cost 80). Old_earth, by
%% contrast, is only attacked WHEN young_earth is actually adopted, so the settled
%% consensus stands at cost 0. beta is exactly "how much objection-strength a holdout
%% is allowed to dismiss": the young-Earth extension appears only once beta >= 80.

%% -------------------- BUDGET (beta set on the command line) --------------------
budget(beta).

%% -------------------- THE TWO RIVAL POSITIONS (assumptions) ------------------
%% Flat ABA: these are assumptions, never rule heads. Each has EXACTLY ONE contrary
%% (contrary is a total function: one contrary atom per assumption).
assumption(young_earth).   % Kelvin: Earth is young (~20-100 Myr)
assumption(old_earth).     % Radiometric: Earth is ~4.54 Gyr

%% contrary(Y,X): "X attacks Y".  Single contrary atom per assumption.
contrary(young_earth, c_young).   % c_young ("Earth is old") attacks young_earth
contrary(old_earth,   c_old).     % c_old   ("Earth is young") attacks old_earth

%% -------------------- EVIDENCE LEAVES (assumptions) --------------------------
%% Premises of the two arguments. Unattacked (their contraries are dummy,
%% never-derivable atoms), so they are always 'in'. Confidence weights are
%% intrinsic (godel: higher = stronger).

%% -- Radiometric argument premises (all strong) --
assumption(decay_constant_known). weight(decay_constant_known, 95).  % lab-measured decay const
assumption(isotope_ratios).       weight(isotope_ratios,       90).  % measured Pb/U ratios
assumption(closed_system).        weight(closed_system,        80).  % rock closed to loss/gain
contrary(decay_constant_known, c_decay).      % dummy, never derived
contrary(isotope_ratios,       c_iso).        % dummy, never derived
contrary(closed_system,        c_closed).     % dummy, never derived

%% -- Kelvin's cooling-chain premises --
assumption(initial_molten).       weight(initial_molten,       70).  % Earth began molten
assumption(conductive_cooling).   weight(conductive_cooling,   60).  % heat leaves by conduction
assumption(no_internal_heat).     weight(no_internal_heat,      5).  % NO internal source -- FALSE
contrary(initial_molten,     c_molten).        % dummy, never derived
contrary(conductive_cooling, c_cond).          % dummy, never derived
contrary(no_internal_heat,   c_noheat).        % dummy, never derived

%% -------------------- ARGUMENTS (rules) --------------------------------------

%% Both arguments are CHAINS (no premise attacks a stance directly). godel otimes=min
%% is associative, so the chain propagates the WEAKEST premise all the way to the
%% attack -- which is the whole point of this example: watch strength collapse to 5.

%% Radiometric CHAIN:  leaves -> radiometric_age -> c_young  ("Earth is old").
%% Built purely from the ALWAYS-IN radiometric leaves, so c_young is PERMANENTLY
%% active: young_earth is under attack no matter what stance is taken.
%%   radiometric_age <- decay_constant_known, isotope_ratios, closed_system
%%                      (otimes=min => min(95,90,80) = 80, still STRONG)
%%   c_young         <- radiometric_age                          (carries 80)
head(r_rad1, radiometric_age).
body(r_rad1, decay_constant_known; r_rad1, isotope_ratios; r_rad1, closed_system).
head(r_rad2, c_young). body(r_rad2, radiometric_age).

%% Kelvin CHAIN:  molten+conduction -> secular_cooling -> young_age_estimate -> c_old.
%% This is the young-Earth position's OWN case, deployed only when young_earth is
%% actually adopted (young_earth is a premise of the last step). Watch the weakest
%% link drag the strength down as the chain grows:
%%   secular_cooling    <- initial_molten, conductive_cooling      (min(70,60)     = 60)
%%   young_age_estimate <- secular_cooling, no_internal_heat       (min(60, 5)     =  5) <- COLLAPSE
%%       the refuted "no internal heat source" premise (weight 5) poisons the whole chain
%%   c_old              <- young_age_estimate, young_earth         (min(5,#sup)    =  5)  WEAK attack
%% Hence the settled consensus (old_earth in, young_earth out) faces NO active attack
%% and stands at cost 0; "reject both" is not stable (old_earth, left out, would be
%% unattacked and forced back in).
head(r_k1, secular_cooling).
body(r_k1, initial_molten; r_k1, conductive_cooling).
head(r_k2, young_age_estimate).
body(r_k2, secular_cooling; r_k2, no_internal_heat).
head(r_k3, c_old).
body(r_k3, young_age_estimate; r_k3, young_earth).
`;

const PLATE_TECTONICS = `%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% CONTINENTAL DRIFT / PLATE TECTONICS  vs  FIXISM
%%
%% STORY
%%   Wegener (1912-) argued the continents drift, stacking several INDEPENDENT
%%   lines of evidence: the coastline + continental-shelf fit, matching fossils
%%   (Mesosaurus, Glossopteris), matching orogenic rock belts, Permo-Carboniferous
%%   glacial tillites, and later paleomagnetism and the sea-floor magnetic stripes
%%   (Vine-Matthews, 1963).  Fixists (Harold Jeffreys) rejected drift on ONE
%%   quantitative objection: there is NO adequate MECHANISM -- the mantle is too
%%   rigid and the invoked forces far too weak to move continents.
%%
%%   The historically striking fact: plate tectonics was ACCEPTED (~1966-67) on the
%%   converging evidence BEFORE a fully worked-out driving mechanism was in hand.
%%   The heavyweight mechanism objection was TOLERATED at acceptance.  So the
%%   accepted mobilist position DISCARDS a real, decisive objection (paying its
%%   weight); it is admissible only because the ACCUMULATED evidence outweighs the
%%   objection budget.  (Contrast Big Bang, where the consensus wins at cost 0.)
%%
%% SEMIRING: arctic  (max-plus)   -- in the UI: family=tropical, polarity=higher
%%   * (+) conjunction = CONSILIENCE: the independent premises of one joint
%%     argument ADD their support.  Wegener's case is exactly a conjunction of
%%     independent evidence lines, so its strength is their SUM.
%%   * (max) alternative derivations = keep the best-supported argument.
%%   Weights are STRENGTH / lines-of-evidence support (higher = better).
%%
%% MONOID: sum   -- extension cost = TOTAL severity of the objections the accepted
%%   position must dismiss (discarded attacks).  BUDGET beta = how much objection-
%%   severity the community is willing to tolerate.
%%
%% CONSTRAINT: ub  (upper bound)  -- sum of discarded weights must be <= beta.
%% SEMANTICS: stable.  OPTIMIZATION: minimize (accept the min-cost extension).
%%
%% WEIGHTS are a MODELLING ENCODING (defensible small integers ranking the
%% relative evidential weight of each line), NOT physical constants.
%%
%% USAGE (sweep beta; holdout first appears at beta = 19):
%%   clingo --warn=no-atom-undefined -n 0 -c beta=19 \
%%     WABA/core/base.lp WABA/semiring/arctic.lp WABA/defaults/legacy.lp \
%%     WABA/monoid/sum.lp WABA/constraint/ub.lp WABA/filter/projection.lp \
%%     WABA/semantics/stable.lp  tectonics_final.lp
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%% ============================================================================
%% ASSUMPTIONS + CONTRARIES  (contrary is a TOTAL function: exactly one per assumption)
%% ============================================================================

%% -- Rival theories --
assumption(drift).          contrary(drift,  c_drift).    % mobilism / plate tectonics
assumption(fixism).         contrary(fixism, c_fixism).   % continents are fixed

%% -- Independent lines of evidence (unattacked leaves; dummy never-derivable contraries) --
assumption(fit).            contrary(fit,      c_fit).       % coastline + shelf fit
assumption(fossils).        contrary(fossils,  c_fossils).   % Mesosaurus / Glossopteris
assumption(rocks).          contrary(rocks,    c_rocks).     % matching orogenic belts
assumption(tillites).       contrary(tillites, c_tillites).  % Permo-Carboniferous glacial tillites
assumption(paleomag).       contrary(paleomag, c_paleomag).  % paleomagnetism (polar wander)
assumption(stripes).        contrary(stripes,  c_stripes).   % sea-floor magnetic stripes

%% -- The fixist mechanism objection premise (unattacked leaf; dummy contrary) --
assumption(rigid_mantle).   contrary(rigid_mantle, c_rigid_mantle). % "mantle too rigid, forces too weak"

%% ============================================================================
%% WEIGHTS  (arctic = STRENGTH; each line's evidential support, small integers)
%% ============================================================================
weight(fit,       2).   % suggestive but qualitative
weight(fossils,   3).   % biogeographic, strong
weight(rocks,     2).   % geological correlation
weight(tillites,  3).   % paleoclimatic, strong
weight(paleomag,  4).   % quantitative, mid-1950s
weight(stripes,   5).   % the Vine-Matthews clincher (1963), decisive
%% Sum of the six lines = 2+3+2+3+4+5 = 19  (arctic (x)=+ : consilience)

weight(rigid_mantle, 6).   % the single heavyweight mechanism objection
weight(drift,        1).   % bare hypothesis carries little weight on its own
weight(fixism,       1).

%% ============================================================================
%% ARGUMENTS (rules).  Head = derived contrary atom; body = premises.
%%   arctic:  premises of ONE rule ADD (consilience);  alternative rules -> max.
%% ============================================================================

%% [rev]  DERIVATION CHAIN: the six lines refute fixism through TWO intermediate
%%        claims (no line attacks a stance directly). arctic otimes=+ is associative,
%%        so the standing strength is still 2+3+2+3+4+5 = 19.
%%          continents_were_joined <- fit, fossils, tillites   (⊗=+ 2+3+3 = 8)
%%              the matching coastlines, fossils and glacial tillites => once one landmass
%%          seafloor_spreads       <- rocks, paleomag, stripes (⊗=+ 2+4+5 = 11)
%%              matching rock belts + polar wander + magnetic stripes => the floor spreads
%%          c_fixism               <- the two claims above     (⊗=+ 8+11 = 19)
head(r_join, continents_were_joined).
body(r_join, fit; r_join, fossils; r_join, tillites).
head(r_spread, seafloor_spreads).
body(r_spread, rocks; r_spread, paleomag; r_spread, stripes).
head(r_rev, c_fixism).
body(r_rev, continents_were_joined; r_rev, seafloor_spreads).

%% [mech] The mechanism objection, CHAINED: rigid_mantle first yields the claim
%%        "no adequate mechanism", which (with drift) bites the mobilist position:
%%          no_mechanism <- rigid_mantle                       (6)
%%          c_drift      <- drift, no_mechanism                (⊗=+ 1+6 = 7)
%%        Modelling choice: the objection is directed AT the act of endorsing drift
%%        (drift is a premise), so drift's own contrary depends on drift -- a "reject
%%        BOTH" answer is not stable (drift, left out, would be unattacked and forced
%%        back in), eliminating the trivial cost-0 skeptical extension while keeping the
%%        objection a genuine, payable cost.
head(r_nomech, no_mechanism). body(r_nomech, rigid_mantle).
head(r_mech, c_drift). body(r_mech, drift; r_mech, no_mechanism).

%% [mx]   Rival attack: holding fixism is itself an argument against drift.
%%        c_drift <- fixism    (strength = 1).  Lets the fixist holdout defeat
%%        drift (cheaply) when fixism is accepted; combined with [mech] by (+)=max,
%%        so in the mobilist world c_drift's strength is max(7,-) = 7.
head(r_mx, c_drift).  body(r_mx, fixism).

%% ----------------------------------------------------------------------------
%% RESULTING STABLE EXTENSIONS (verified by enumeration):
%%   {drift in,  fixism out}  discard c_drift@7   cost  7   <-- CONSENSUS (plate tectonics)
%%   {fixism in, drift  out}  discard c_fixism@19 cost 19   <-- fixist holdout
%%   {drift in,  fixism in }  discard both         cost 26
%%   ("reject both" is NOT stable -> no cost-0 degeneracy)
%% beta sweep:  beta<7 UNSAT;  7<=beta<19 consensus is UNIQUE;
%%              beta=19 fixist holdout first appears;  min-cost accepted = consensus (7).
%% ----------------------------------------------------------------------------
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
            beta: 5,
            graphMode: "assumption-branching"
        }
    },
    smoking_lung_cancer: {
        label: 'Smoking causes lung cancer',
        description: "A settled debate as Bradford-Hill CONSILIENCE (Arctic / max-plus): each of eight independent causal criteria is an evidence assumption and ⊗=+ sums them, so the case refuting R.A. Fisher's confounding (\"constitutional\") hypothesis has weight 54. Accepted at cost 0: smoking causes lung cancer (consensus); Fisher's holdout is admissible only at β=54 — the cost of dismissing the entire Bradford-Hill case. (Tropical-higher = arctic, sum + ub, β=54.)",
        section: 'curated',
        source: 'inline',
        code: SMOKING_LUNG_CANCER,
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
            beta: 54,
            graphMode: "assumption-branching"
        }
    },
    solar_neutrino: {
        label: 'Solar neutrino problem',
        description: "The solar-neutrino deficit as combined statistical significance (Tropical / min-plus): the measured electron-neutrino flux was ~1/3 of the Standard Solar Model. SNO's two channels (electron + total flux) give ⊗=+ additive surprisal (≈5.3σ) refuting \"the SSM is wrong\". Accepted at cost 0: neutrino oscillation / SSM correct (consensus, Nobel 2015); the SSM-error holdout survives only at β=53 (dismissing the SNO result). (Tropical-lower = tropical, sum + ub, β=53.)",
        section: 'curated',
        source: 'inline',
        code: SOLAR_NEUTRINO,
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
            beta: 53,
            graphMode: "assumption-branching"
        }
    },
    age_of_earth: {
        label: 'Age of the Earth: Kelvin vs radiometric',
        description: "A WEAKEST-LINK debate (Gödel / min): Kelvin's 1862 cooling estimate (20–100 Myr) is a conjunction whose weakest premise — \"no internal heat source\" — was refuted by radioactivity, so under ⊗=min his young-Earth argument is weak (strength 5). Radiometric dating gives ~4.54 Gyr. Accepted at cost 0: old Earth (consensus); the young-Earth holdout appears only at β=80 (waiving the strongest radiometric evidence). (Gödel + sum + ub, β=80.)",
        section: 'curated',
        source: 'inline',
        code: AGE_OF_EARTH,
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
            beta: 80,
            graphMode: "assumption-branching"
        }
    },
    plate_tectonics: {
        label: 'Plate tectonics vs fixism',
        description: "Continental drift as consilience with a TOLERATED objection (Arctic / max-plus): Wegener's converging lines (fossils, rock belts, glacial tillites, paleomagnetism, sea-floor stripes) vs the fixists' \"no adequate mechanism\". Unlike the other debates the accepted plate-tectonics extension pays a NONZERO cost 7 — it discards the mechanism objection, just as history tolerated it before the mechanism was found — yet still wins as the min-cost position (the fixist holdout costs 19). (Tropical-higher = arctic, sum + ub, β=19.)",
        section: 'curated',
        source: 'inline',
        code: PLATE_TECTONICS,
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
            beta: 19,
            graphMode: "assumption-branching"
        }
    },
};

if (typeof window !== 'undefined') {
    window.WABAExamples = examples;
}
