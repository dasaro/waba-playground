// WABA Playground examples.
// Two families of curated examples:
//  (1) Algebra demos on abstract rebuttal cycles: Gödel (weakest link), Arctic (joint
//      accumulation), Bottleneck-cost (worst-case + MAX monoid).
//  (2) Real SCIENTIFIC THEORY COMPETITIONS from the literature, each modelled so that:
//        - the accepted (consensus) theory is resolved at NON-ZERO cost: it must discard a
//          genuine, tolerated residual objection (there is no cost-0 extension);
//        - evidence enters as WEIGHTED ARGUMENT atoms (non-assumption, non-contrary) whose
//          weights encode real quantities (effect sizes, meta-analyses, σ / p-values, evidence
//          strength) and accumulate along derivation CHAINS into the rival's refutation;
//        - competing theories map 1:1 to assumptions; every framework has >= 2 stable models.
//        kpg_impact_vs_deccan  : Chicxulub impact vs Deccan volcanism      (Arctic,   accepted @8 / holdout @22)
//        higgs_boson_discovery : 5-sigma discovery vs background-fluctuation (Tropical, @8 / @109)
//        out_of_africa         : recent African origin vs multiregional     (Arctic,   @8 / @37)
//        lipid_hypothesis      : LDL causal vs LDL-is-only-a-marker         (Arctic,   @5 / @25)
//  (3) COST/WEAKNESS reasoning: weights read as a COST or WEAKNESS (not a strength) -- the natural home
//      of the cost-polarity semirings: Tropical (otimes=+ ; cost/improbability/risk ACCUMULATES) and
//      Bottleneck (otimes=max ; cost = the single WORST component / weakest link). Same nonzero-cost,
//      weighted-argument, multi-model contract as (2), from non-scientific domains:
//        detective_locked_house : butler vs intruder -- improbability of coincidences (Tropical,   @5 / @27)
//        weakest_link_security  : layered vs single barrier -- worst vulnerability   (Bottleneck, @3 / @9)
//        deorbit_plan_risk      : redundant vs single-string -- accumulated risk     (Tropical,   @5 / @28)

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

const KPG_IMPACT = `%% K-Pg MASS EXTINCTION: Chicxulub impact (accepted) vs Deccan volcanism (rival).
%% Arctic semiring (otimes=+ accumulates independent evidence strength; oplus=max), sum monoid, ub budget.
%% Weights = strength of each physical impact signature (small integers). The accepted impact
%% theory does NOT win for free: it must discard the residual "extinction-selectivity" objection
%% that keeps a Deccan contribution alive -> resolved at NON-ZERO cost 8 (< the Deccan holdout 22).

%% -- competing theories (1 assumption each) --
assumption(impact_theory).    contrary(impact_theory, c_impact).     % Alvarez / Chicxulub bolide
assumption(deccan_volcanism). contrary(deccan_volcanism, c_deccan).  % Deccan Traps flood basalts

%% -- observations: UNWEIGHTED support assumptions (they establish derivability; the STRENGTH
%%    lives in the weighted argument atoms below) --
assumption(obs_iridium).            contrary(obs_iridium, x_ir).
assumption(obs_shocked_quartz).     contrary(obs_shocked_quartz, x_sq).
assumption(obs_ejecta_crater).      contrary(obs_ejecta_crater, x_ej).
assumption(obs_extinction_pattern). contrary(obs_extinction_pattern, x_ep).

%% -- WEIGHTED ARGUMENTS (intermediate, non-contrary): strength of each impact signature --
weight(arg_iridium_anomaly, 9).  % global Ir spike ~30x crustal background (Alvarez et al. 1980)
head(d1, arg_iridium_anomaly). body(d1, obs_iridium).
weight(arg_shocked_quartz, 7).   % planar deformation features -- impact-diagnostic, not volcanic
head(d2, arg_shocked_quartz).  body(d2, obs_shocked_quartz).
weight(arg_global_ejecta, 6).    % worldwide spherule layer + 180-km Chicxulub crater at the boundary
head(d3, arg_global_ejecta).   body(d3, obs_ejecta_crater).

%% refute the rival: the three signatures ACCUMULATE (arctic otimes=+ : 9+7+6 = 22) against Deccan-only
head(rref, c_deccan). body(rref, arg_iridium_anomaly). body(rref, arg_shocked_quartz). body(rref, arg_global_ejecta).

%% residual SELF-ACTIVATED objection to the accepted theory (weight 8 < 22): extinction
%% selectivity / gradual pre-boundary decline keeps a Deccan contribution on the table (Hull et al. 2020).
weight(arg_selectivity, 8).      head(dobj, arg_selectivity). body(dobj, obs_extinction_pattern).
head(robj, c_impact). body(robj, impact_theory). body(robj, arg_selectivity).  % active only when impact is IN
head(rmx, c_impact).  body(rmx, deccan_volcanism).                             % rival also attacks impact

budget(beta).
`;

const HIGGS_DISCOVERY = `%% HIGGS-BOSON DISCOVERY (July 2012): a new ~125 GeV boson exists (accepted) vs the
%% background-fluctuation null (rival). Tropical semiring (otimes=+ ADDS surprisal, Fisher-style;
%% oplus=min keeps the least-surprising proof), sum monoid, ub budget.
%% Weights = SURPRISAL under the null = local significance in units of sigma x10 -- the natural
%% currency for combined-significance / p-value reasoning. The discovery is resolved at NON-ZERO
%% cost 8: it must discard the look-elsewhere / trials-factor caveat every local 5-sigma carries.

%% -- competing hypotheses (1 assumption each) --
assumption(higgs_exists).      contrary(higgs_exists, c_higgs).           % a new ~125 GeV boson exists
assumption(null_fluctuation).  contrary(null_fluctuation, c_null).        % the excess is a background fluctuation

%% -- observations: UNWEIGHTED support assumptions (the two experiments' datasets) --
assumption(obs_atlas).         contrary(obs_atlas, x_atlas).
assumption(obs_cms).           contrary(obs_cms, x_cms).

%% -- WEIGHTED ARGUMENTS (surprisal under the null = local sigma x10) --
weight(surprisal_atlas, 59).   % ATLAS 5.9 local sigma (arXiv:1207.7214)
head(a1, surprisal_atlas). body(a1, obs_atlas).
weight(surprisal_cms, 50).     % CMS 5.0 local sigma (arXiv:1207.7235)
head(a2, surprisal_cms).   body(a2, obs_cms).

%% refute the null: independent surprisals ADD (tropical otimes=+ : 59+50 = 109) -- far past 5 sigma
head(rref, c_null). body(rref, surprisal_atlas). body(rref, surprisal_cms).

%% residual SELF-ACTIVATED objection to the discovery (weight 8 < 109): the look-elsewhere effect --
%% the GLOBAL significance is below the local 5-sigma, and in 2012 it was not yet confirmed to be
%% THE Standard-Model Higgs (spin/couplings). Modelled as an objection derived from the claim itself.
weight(look_elsewhere, 8).     head(dobj, look_elsewhere). body(dobj, higgs_exists).
head(robj, c_higgs). body(robj, look_elsewhere).            % active only when the discovery is asserted
head(rmx, c_higgs). body(rmx, null_fluctuation).            % the null, if held, attacks the discovery

budget(beta).
`;

const OUT_OF_AFRICA = `%% HUMAN ORIGINS: recent African origin (accepted) vs multiregional evolution (rival).
%% Arctic semiring (otimes=+ accumulates independent genetic evidence; oplus=max), sum monoid, ub budget.
%% Weights = strength of each genetic line of evidence. The accepted theory is resolved at NON-ZERO
%% cost 8: it must discard the archaic-admixture objection (Neanderthal/Denisovan ancestry), a real
%% deviation from strict replacement that partially vindicates the multiregional gene-flow idea.

%% -- competing theories (1 assumption each) --
assumption(recent_african_origin).   contrary(recent_african_origin, not_recent_african_origin).
assumption(multiregional_evolution). contrary(multiregional_evolution, not_multiregional_evolution).

%% -- observations: UNWEIGHTED support assumptions (the genetic datasets) --
assumption(mtdna_ychrom_coalescence).   contrary(mtdna_ychrom_coalescence, x_coal).
assumption(heterozygosity_distance_decay). contrary(heterozygosity_distance_decay, x_het).
assumption(african_basal_diversity).     contrary(african_basal_diversity, x_div).
assumption(archaic_admixture_signal).    contrary(archaic_admixture_signal, x_adm).

%% -- WEIGHTED ARGUMENTS (genetic evidence strength) --
weight(arg_coalescence, 12).      % mtDNA + Y-chromosome coalescence rooted in Africa (Cann et al. 1987)
head(d_coal, arg_coalescence). body(d_coal, mtdna_ychrom_coalescence).
weight(arg_serial_founder, 15).   % heterozygosity decays with distance from Africa (Ramachandran et al. 2005)
head(d_sf, arg_serial_founder). body(d_sf, heterozygosity_distance_decay).
weight(arg_african_diversity, 10).% Africa holds the highest basal genetic diversity
head(d_ad, arg_african_diversity). body(d_ad, african_basal_diversity).

%% refute the rival: the three lines ACCUMULATE (arctic otimes=+ : 12+15+10 = 37)
head(r_refute, not_multiregional_evolution).
body(r_refute, arg_coalescence). body(r_refute, arg_serial_founder). body(r_refute, arg_african_diversity).

%% residual SELF-ACTIVATED objection (weight 8 < 37): archaic admixture -- Neanderthal (~1.5-2%,
%% Green et al. 2010) and Denisovan (~4-6% in Melanesians, Reich et al. 2010) ancestry in non-Africans.
weight(objection_archaic_admixture, 8).
head(d_obj, objection_archaic_admixture). body(d_obj, archaic_admixture_signal).
head(r_obj, not_recent_african_origin).
body(r_obj, recent_african_origin). body(r_obj, objection_archaic_admixture).  % active only when OoA is IN
head(r_mx, not_recent_african_origin). body(r_mx, multiregional_evolution).

budget(beta).
`;

const LIPID_HYPOTHESIS = `%% LIPID HYPOTHESIS: LDL cholesterol is CAUSAL for atherosclerotic cardiovascular disease
%% (accepted) vs the older "LDL is only a marker / not causal" position (rival).
%% Arctic semiring (otimes=+ accumulates meta-analytic evidence; oplus=max), sum monoid, ub budget.
%% Weights = meta-analytic effect strength. The causal theory is resolved at NON-ZERO cost 5: it
%% must discard the residual-cardiovascular-risk objection (most events still occur despite LDL-lowering).

%% -- competing theories (1 assumption each) --
assumption(ldl_causal).      contrary(ldl_causal, c_ldl).       % LDL-C causally drives ASCVD (EAS 2017)
assumption(ldl_marker_only). contrary(ldl_marker_only, c_marker). % LDL is only a correlate, not a cause

%% -- observations: UNWEIGHTED support assumptions (the trial / genetic datasets) --
assumption(ctt_rct).    contrary(ctt_rct, x_ctt).      % statin RCT meta-analysis (CTT Collaboration)
assumption(mr_genetic). contrary(mr_genetic, x_mr).    % Mendelian-randomization / genetic datasets
assumption(pcsk9_rct).  contrary(pcsk9_rct, x_pcsk9).  % PCSK9-inhibitor RCTs (FOURIER)
assumption(res_risk).   contrary(res_risk, x_res).     % residual-risk / inflammation dataset (CANTOS)

%% -- WEIGHTED ARGUMENTS (meta-analytic effect strength) --
weight(arg_ctt, 8).    % ~22% fewer major vascular events per 1 mmol/L LDL drop, 170k patients (CTT 2010)
head(d_ctt, arg_ctt). body(d_ctt, ctt_rct).
weight(arg_mr, 11).    % lifelong genetically-lower LDL -> proportionally lower ASCVD (strongest CAUSAL evidence)
head(d_mr, arg_mr). body(d_mr, mr_genetic).
weight(arg_pcsk9, 6).  % further LDL-lowering on top of statins -> further event reduction (Sabatine 2017)
head(d_pcsk9, arg_pcsk9). body(d_pcsk9, pcsk9_rct).

%% refute the rival: the three lines ACCUMULATE (arctic otimes=+ : 8+11+6 = 25)
head(rref, c_marker). body(rref, arg_ctt). body(rref, arg_mr). body(rref, arg_pcsk9).

%% residual SELF-ACTIVATED objection (weight 5 < 25): residual cardiovascular risk -- ~70-80% of
%% events still occur despite LDL-lowering, motivating the inflammation hypothesis (Ridker et al. 2017).
weight(arg_resid, 5).  head(d_resid, arg_resid). body(d_resid, res_risk).
head(robj, c_ldl). body(robj, ldl_causal). body(robj, arg_resid).  % active only when the causal theory is IN
head(rmx, c_ldl). body(rmx, ldl_marker_only).

budget(beta).
`;

const DETECTIVE_LOCKED_HOUSE = `%% THE LOCKED-HOUSE MURDER: the butler (insider) vs a phantom intruder.
%% Tropical semiring (otimes=+, oplus=min) -- cost = IMPROBABILITY (surprisal) that ACCUMULATES.
%% The case against a theory = the SUM of the improbable coincidences it must treat as mere chance.
%% The insider theory wins at NON-ZERO cost 5 (one residual loose end) vs the intruder's 27.

assumption(insider).       contrary(insider,  c_insider).    % the butler (had a key + the alarm code) did it
assumption(intruder).      contrary(intruder, c_intruder).   % an outside stranger broke in and framed the butler
%% observations (unweighted support assumptions):
assumption(obs_noforce).   contrary(obs_noforce,  x_noforce).    % no forced entry
assumption(obs_codeused).  contrary(obs_codeused, x_codeused).   % the alarm was disarmed with the valid code
assumption(obs_nodna).     contrary(obs_nodna,    x_nodna).      % no stranger DNA at the scene
assumption(obs_footprint). contrary(obs_footprint,x_footprint).  % a smudged partial footprint of unknown shoe

%% WEIGHTED ARGUMENTS = the surprisal (improbability) each observation forces the INTRUDER theory to swallow:
weight(surprisal_noforce, 9).  head(d1, surprisal_noforce). body(d1, obs_noforce).   % a stranger leaving no forced-entry trace
weight(surprisal_code,   11).  head(d2, surprisal_code).    body(d2, obs_codeused).  % a stranger knowing the private code
weight(surprisal_nodna,   7).  head(d3, surprisal_nodna).   body(d3, obs_nodna).     % a violent stranger shedding zero DNA
%% refute the rival: the coincidences ACCUMULATE (tropical otimes=+ : 9+11+7 = 27)
head(rref, c_intruder). body(rref, surprisal_noforce). body(rref, surprisal_code). body(rref, surprisal_nodna).

%% residual doubt against the accepted insider theory (self-activated): the one unexplained footprint
weight(doubt_footprint, 5). head(dobj, doubt_footprint). body(dobj, insider). body(dobj, obs_footprint).
head(robj, c_insider). body(robj, doubt_footprint).
head(rmx, c_insider). body(rmx, intruder).   % adopting the rival also indicts the insider theory
budget(beta).
`;

const WEAKEST_LINK_SECURITY = `%% WEAKEST-LINK SECURITY: layered defence-in-depth (accepted) vs a single-barrier perimeter (rival).
%% Bottleneck-cost semiring (otimes=max, oplus=min) -- cost = the WORST component. A system is only as
%% strong as its WEAKEST LINK, so a design's exposure is its single worst vulnerability, NEVER a sum.
%% The layered design wins at NON-ZERO cost 3 (a residual insider risk) vs the single barrier's 9.

assumption(layered_defense). weight(layered_defense, 1). contrary(layered_defense, c_layered).
assumption(single_barrier).  weight(single_barrier, 1).  contrary(single_barrier, c_single).
%% single_barrier component vulnerabilities (WEIGHTED FACTS; higher severity = weaker point):
weight(vuln_service_entrance, 9). head(vs1, vuln_service_entrance).  % an unguarded service entrance
weight(vuln_default_password, 6). head(vs2, vuln_default_password).  % a default admin password
%% c_single = the design's WORST vulnerability (bottleneck otimes=max : max(9,6)=9)
head(rs, c_single). body(rs, vuln_service_entrance). body(rs, vuln_default_password).
%% layered_defense residual worst link (weighted fact):
weight(vuln_insider_risk, 3). head(vl1, vuln_insider_risk).          % a residual insider risk
head(rl, c_layered). body(rl, layered_defense). body(rl, vuln_insider_risk).  % self-activated : max(1,3)=3
head(rmx, c_layered). body(rmx, single_barrier).                     % the rival design also attacks the accepted
budget(beta).
`;

const DEORBIT_PLAN_RISK = `%% SPACECRAFT DEORBIT PLAN: a certified redundant plan (accepted) vs a single-string minimal plan (rival).
%% Tropical semiring (otimes=+, oplus=min) -- cost = FAILURE RISK that ACCUMULATES across steps.
%% The case against a plan = the SUM of the failure risks it must tolerate. The redundant plan wins at
%% NON-ZERO cost 5 (a residual sensor-crosscheck risk) vs the single-string plan's 28.

assumption(redundant).     contrary(redundant, c_redundant).       % the certified redundant-thruster plan
assumption(single_string). contrary(single_string, c_single).      % the single-string minimal plan
%% observations (unweighted support assumptions):
assumption(telemetry).     contrary(telemetry, x_telemetry).       % telemetry stream is nominal
assumption(burn_window).   contrary(burn_window, x_burn).          % the deorbit burn window is open

%% WEIGHTED ARGUMENTS = per-failure-mode risk the single-string plan must tolerate (milli-units):
weight(risk_valve_leak, 12).    head(dv, risk_valve_leak).     body(dv, telemetry).    % valve leak, unredundant propellant path
weight(risk_attitude_drift, 9). head(da, risk_attitude_drift). body(da, telemetry).    % attitude drift, no backup star-tracker
weight(risk_comms_blackout, 7). head(dc, risk_comms_blackout). body(dc, burn_window).  % comms blackout on a single downlink
%% refute the rival: the failure risks ACCUMULATE (tropical otimes=+ : 12+9+7 = 28)
head(rref, c_single). body(rref, risk_valve_leak). body(rref, risk_attitude_drift). body(rref, risk_comms_blackout).

%% residual risk against the accepted redundant plan (self-activated): a sensor cross-check can miss a fault
weight(risk_sensor_crosscheck, 5). head(dobj, risk_sensor_crosscheck). body(dobj, redundant). body(dobj, burn_window).
head(robj, c_redundant). body(robj, risk_sensor_crosscheck).
head(rmx, c_redundant). body(rmx, single_string).
budget(beta).
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
    kpg_impact_vs_deccan: {
        label: 'K-Pg extinction: impact vs volcanism',
        description: "A real Earth-science controversy as a theory competition. The Chicxulub asteroid impact (Alvarez et al. 1980) and Deccan Traps volcanism are the two competing triggers of the end-Cretaceous (K-Pg) mass extinction, 66 Ma. Each theory is one assumption; the physical evidence enters as WEIGHTED ARGUMENT atoms whose weights encode the strength of each impact signature (Arctic ⊗=+ accumulates independent lines, so the case against a Deccan-only cause sums to 22): the global iridium anomaly (~30× crustal background; 9), shock-metamorphosed quartz that volcanism cannot produce (7), and the worldwide ejecta layer plus the 180-km Chicxulub crater dated to the boundary (6). Crucially the accepted impact theory does NOT win for free: it must discard a real, still-live objection — the extinction-selectivity / gradual-decline pattern that keeps a Deccan contribution on the table (weight 8; Hull et al. 2020) — so it is resolved at COST 8, below the Deccan holdout's cost 22. This matches the consensus (Schulte et al. 2010, 41-author review): impact primary, volcanism a tolerated contributing factor. β=22 enumerates both extensions.",
        section: 'curated',
        source: 'inline',
        code: KPG_IMPACT,
        preset: {
            semiringFamily: 'tropical', polarity: 'higher',
            defaultPolicy: 'legacy', monoid: 'sum', optimization: 'minimize',
            budgetMode: 'ub', budgetIntent: 'bounded', semantics: 'stable',
            optMode: 'ignore', beta: 22, graphMode: "assumption-branching"
        }
    },
    higgs_boson_discovery: {
        label: 'Higgs boson: 5σ discovery vs the null',
        description: "The July 2012 Higgs-boson discovery as a statistical argument, showing weights as COMBINED SIGNIFICANCE / p-values under the Tropical semiring (⊗=+ adds surprisal, Fisher-style; ⊕=min keeps the least-surprising proof). The competing hypotheses are 'a new ~125 GeV boson exists' vs the 'background-fluctuation null'. Each experiment's local significance is a weighted argument in units of σ×10: ATLAS 5.9σ → 59 (arXiv:1207.7214) and CMS 5.0σ → 50 (arXiv:1207.7235); combined they give 59+50 = 109 units of surprisal against the null — far past the 5σ discovery threshold, so the null is defeated. The Higgs claim is nonetheless resolved at NON-ZERO cost 8: it must discard the look-elsewhere / trials-factor caveat every local 5σ carries (the global significance is lower, and in 2012 it was not yet confirmed to be THE Standard-Model Higgs). β=109 enumerates both the accepted discovery (cost 8) and the fluctuation holdout (cost 109 = the full surprisal a denier must wave away).",
        section: 'curated',
        source: 'inline',
        code: HIGGS_DISCOVERY,
        preset: {
            semiringFamily: 'tropical', polarity: 'lower',
            defaultPolicy: 'legacy', monoid: 'sum', optimization: 'minimize',
            budgetMode: 'ub', budgetIntent: 'bounded', semantics: 'stable',
            optMode: 'ignore', beta: 109, graphMode: "assumption-branching"
        }
    },
    out_of_africa: {
        label: 'Human origins: Out-of-Africa vs multiregional',
        description: "Human origins as a genetics-weighted theory competition: recent African origin (a single recent African source for modern humans) vs the older multiregional model (parallel regional evolution with gene flow). Genetic evidence enters as WEIGHTED ARGUMENT atoms (Arctic ⊗=+, evidence strength summing to 37): mitochondrial + Y-chromosome coalescence rooted in Africa (Cann et al. 1987; 12), the serial-founder signal — heterozygosity decaying with distance from Africa (Ramachandran et al. 2005; 15) — and Africa's highest basal genetic diversity (10). The accepted theory pays a genuine COST 8: it must discard the archaic-admixture objection — Neanderthal (~1.5-2%; Green et al. 2010) and Denisovan (~4-6% in Melanesians; Reich et al. 2010) ancestry in non-Africans is a real deviation from strict replacement that partly vindicates the multiregional gene-flow idea. So the modern consensus (recent African origin WITH limited archaic admixture) is the min-cost extension at 8, beating the multiregional holdout at 37. β=37 shows both.",
        section: 'curated',
        source: 'inline',
        code: OUT_OF_AFRICA,
        preset: {
            semiringFamily: 'tropical', polarity: 'higher',
            defaultPolicy: 'legacy', monoid: 'sum', optimization: 'minimize',
            budgetMode: 'ub', budgetIntent: 'bounded', semantics: 'stable',
            optMode: 'ignore', beta: 37, graphMode: "assumption-branching"
        }
    },
    lipid_hypothesis: {
        label: 'Lipid hypothesis: LDL causal vs marker-only',
        description: "The lipid hypothesis — that LDL cholesterol CAUSALLY drives atherosclerotic cardiovascular disease (ASCVD) — versus the older 'LDL is only a marker, not a cause' position, weighted by META-ANALYTIC effect sizes (Arctic ⊗=+, summing to 25). Three argument atoms: the Cholesterol Treatment Trialists' statin meta-analysis (~22% fewer major vascular events per 1 mmol/L LDL reduction, 170,000 patients; CTT 2010; weight 8), Mendelian randomization — lifelong genetically-lower LDL → proportionally lower ASCVD, the strongest CAUSAL evidence (11) — and PCSK9-inhibitor RCTs adding event reduction on top of statins (FOURIER, Sabatine et al. 2017; 6). The causal theory is accepted at NON-ZERO cost 5: it must discard the residual-risk objection — ~70-80% of events still occur despite LDL-lowering, motivating the inflammation hypothesis (CANTOS; Ridker et al. 2017). Consensus (Ference et al. 2017, EAS): LDL is causal, residual risk acknowledged — the min-cost extension at 5, beating the marker-only holdout at 25. β=25 shows both.",
        section: 'curated',
        source: 'inline',
        code: LIPID_HYPOTHESIS,
        preset: {
            semiringFamily: 'tropical', polarity: 'higher',
            defaultPolicy: 'legacy', monoid: 'sum', optimization: 'minimize',
            budgetMode: 'ub', budgetIntent: 'bounded', semantics: 'stable',
            optMode: 'ignore', beta: 25, graphMode: "assumption-branching"
        }
    },
    detective_locked_house: {
        label: 'Locked-house murder: butler vs intruder',
        description: "A murder-mystery as a WABA theory competition, showing weights as IMPROBABILITY (surprisal) under the Tropical semiring (otimes=+ sums independent surprisals, Fisher-style; oplus=min keeps the least-improbable overall account). Two theories explain a killing in a locked house: the butler did it (insider, accepted) or an outside stranger framed him (intruder, rival). Each weight is the improbability the LOSING theory must swallow to dismiss a clue as coincidence. Because independent surprisals add, the case against the intruder theory is the SUM of the coincidences it stacks: a stranger leaving no forced-entry trace (9), knowing the private alarm code (11), and shedding zero DNA at a violent scene (7) -- totalling 27. The insider theory explains all three at once, yet is not free: it carries one unexplained loose end, a smudged partial footprint (5). So it wins at cost 5, not 0 -- a real residual doubt, far below the rival's 27. Lower total surprisal = fewer improbable coincidences = the more parsimonious account -- exactly how a detective ranks explanations (inference to the best explanation / Occam). beta=27 enumerates both the accepted account (cost 5) and the intruder holdout (cost 27).",
        section: 'curated',
        source: 'inline',
        code: DETECTIVE_LOCKED_HOUSE,
        preset: {
            semiringFamily: 'tropical', polarity: 'lower',
            defaultPolicy: 'legacy', monoid: 'sum', optimization: 'minimize',
            budgetMode: 'ub', budgetIntent: 'bounded', semantics: 'stable',
            optMode: 'ignore', beta: 27, graphMode: "assumption-branching"
        }
    },
    weakest_link_security: {
        label: 'Weakest link: defence-in-depth vs single barrier',
        description: "A security-architecture decision as a WABA theory competition, showing weights as VULNERABILITY (cost/weakness) under the Bottleneck-cost semiring (otimes=max, oplus=min). Two designs compete: layered defence-in-depth (accepted) and a single-barrier perimeter (rival). A weight is the severity of one vulnerability, and -- crucially -- a chain is only as strong as its weakest link, so otimes=max makes a design's exposure equal to its WORST component, never a sum a real attacker could exploit one flaw at a time. The single-barrier design exposes an unguarded service entrance (severity 9) and a default admin password (6); its worst-case exposure is max(9,6)=9. The layered design forces an attacker through many controls, leaving only one residual weak link, insider risk (3), so its exposure is max(1,3)=3. The layered design wins at the NON-ZERO cost 3 rather than 0 -- no architecture is perfectly airtight -- yet is decisively safer than the rival's 9. Bottleneck is exactly right here: security is governed by the single worst breach point, so aggregation must take the maximum, not add severities. beta=9 enumerates both designs.",
        section: 'curated',
        source: 'inline',
        code: WEAKEST_LINK_SECURITY,
        preset: {
            semiringFamily: 'godel', polarity: 'lower',
            defaultPolicy: 'legacy', monoid: 'sum', optimization: 'minimize',
            budgetMode: 'ub', budgetIntent: 'bounded', semantics: 'stable',
            optMode: 'ignore', beta: 9, graphMode: "assumption-branching"
        }
    },
    deorbit_plan_risk: {
        label: 'Deorbit plan: redundant vs single-string (risk)',
        description: "A reliability-engineering decision as a WABA theory competition, showing weights as accumulated FAILURE RISK under the Tropical semiring (otimes=+ sums independent risks; oplus=min keeps the safest plan). A spacecraft must deorbit via one of two plans: a certified redundant-thruster plan (accepted) or a single-string minimal plan (rival). Each weight is a per-failure-mode risk (milli-units). The case against the single-string plan ACCUMULATES the risks of every failure mode it must tolerate -- a valve leak in an unredundant propellant path (12), uncorrected attitude drift with no backup star-tracker (9), and a comms blackout on a single downlink (7) -- totalling 28. The redundant plan wins, but NOT for free: it still carries a residual risk (its sensor cross-check can miss a fault, 5), so it is accepted at cost 5, not 0 -- a real residual exposure, far below the rival's 28. Tropical is the right algebra because independent failure risks add (a plan is only as safe as the sum of its exposures) and oplus=min selects the minimum-risk plan. beta=28 enumerates both the redundant plan (cost 5) and the single-string holdout (cost 28).",
        section: 'curated',
        source: 'inline',
        code: DEORBIT_PLAN_RISK,
        preset: {
            semiringFamily: 'tropical', polarity: 'lower',
            defaultPolicy: 'legacy', monoid: 'sum', optimization: 'minimize',
            budgetMode: 'ub', budgetIntent: 'bounded', semantics: 'stable',
            optMode: 'ignore', beta: 28, graphMode: "assumption-branching"
        }
    },
};

if (typeof window !== 'undefined') {
    window.WABAExamples = examples;
}
