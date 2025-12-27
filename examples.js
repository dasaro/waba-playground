// WABA Playground - Example Frameworks
// Following proper ABA modeling: assumptions = defeasible principles/theories
// Facts/observations are atoms (weighted), not assumptions

const examples = {
    simple: `%% Simple WABA Example
%% Demonstrates basic attack resolution with budget constraint

assumption(a).
assumption(b).
assumption(c).

weight(a, 80).
weight(b, 60).
weight(c, 40).

weight(c_a, 70).
weight(c_b, 50).
weight(c_c, 30).

% r1: c_a <- b (b attacks a via c_a)
head(r1, c_a). body(r1, b).

contrary(a, c_a).
contrary(b, c_b).
contrary(c, c_c).
`,

    medical: `%% Medical Ethics Decision
%% Proper ABA modeling: Only ethical PRINCIPLES are assumptions
%% Patient facts and clinical observations are weighted atoms

% ========== ASSUMPTIONS: Ethical Principles (defeasible) ==========
assumption(respect_autonomy).
assumption(act_beneficently).
assumption(do_no_harm).
assumption(act_justly).

weight(respect_autonomy, 90).
weight(act_beneficently, 85).
weight(do_no_harm, 80).
weight(act_justly, 75).

% ========== FACTS: Clinical observations and patient state ==========
% Modeled as rules with empty bodies (always supported)
head(fact1, patient_refuses_treatment).
head(fact2, condition_life_threatening).
head(fact3, treatment_has_side_effects).
head(fact4, resources_scarce).
head(fact5, patient_capacity_impaired).

weight(patient_refuses_treatment, 95).
weight(condition_life_threatening, 90).
weight(treatment_has_side_effects, 40).
weight(resources_scarce, 30).
weight(patient_capacity_impaired, 85).

% ========== DERIVED ACTIONS ==========
% r1: administer_treatment <- act_beneficently, condition_life_threatening
head(r1, administer_treatment). body(r1, act_beneficently; r1, condition_life_threatening).
weight(administer_treatment, 85).

% r2: withhold_treatment <- respect_autonomy, patient_refuses_treatment
head(r2, withhold_treatment). body(r2, respect_autonomy; r2, patient_refuses_treatment).
weight(withhold_treatment, 88).

% r3: override_refusal <- act_beneficently, patient_capacity_impaired
head(r3, override_refusal). body(r3, act_beneficently; r3, patient_capacity_impaired).
weight(override_refusal, 75).

% ========== CONTRARIES: Actions attack principles ==========
% Administering treatment against wishes attacks autonomy
contrary(respect_autonomy, c_autonomy).
head(r10, c_autonomy). body(r10, administer_treatment; r10, patient_refuses_treatment).
weight(c_autonomy, 82).

% Withholding life-saving treatment attacks beneficence
contrary(act_beneficently, c_beneficence).
head(r11, c_beneficence). body(r11, withhold_treatment; r11, condition_life_threatening).
weight(c_beneficence, 80).

% Treatment with side effects attacks non-maleficence
contrary(do_no_harm, c_no_harm).
head(r12, c_no_harm). body(r12, administer_treatment; r12, treatment_has_side_effects).
weight(c_no_harm, 65).

% Resource allocation attacks justice when scarce
contrary(act_justly, c_justice).
head(r13, c_justice). body(r13, administer_treatment; r13, resources_scarce).
weight(c_justice, 55).
`,

    cybersecurity: `%% Cybersecurity Access Control
%% Proper ABA modeling: Security POLICIES are assumptions
%% Security indicators are facts, access decisions are derived

% ========== ASSUMPTIONS: Security Policies (defeasible) ==========
assumption(require_strong_auth).
assumption(require_trusted_context).
assumption(deny_by_default).

weight(require_strong_auth, 95).
weight(require_trusted_context, 80).
weight(deny_by_default, 85).

% ========== FACTS: Security indicators and observations ==========
% Modeled as rules with empty bodies (always supported)
head(fact1, credentials_valid).
head(fact2, mfa_verified).
head(fact3, behavior_normal).
head(fact4, location_trusted).
head(fact5, device_recognized).
head(fact6, threat_intel_clean).

weight(credentials_valid, 85).
weight(mfa_verified, 95).
weight(behavior_normal, 70).
weight(location_trusted, 60).
weight(device_recognized, 65).
weight(threat_intel_clean, 80).

% ========== DERIVED: Authentication and access decisions ==========
% r1: strong_auth_satisfied <- credentials_valid, mfa_verified
head(r1, strong_auth_satisfied). body(r1, credentials_valid; r1, mfa_verified).
weight(strong_auth_satisfied, 90).

% r2: context_trusted <- location_trusted, device_recognized, behavior_normal
head(r2, context_trusted). body(r2, location_trusted; r2, device_recognized; r2, behavior_normal).
weight(context_trusted, 70).

% r3: grant_access <- strong_auth_satisfied, context_trusted, threat_intel_clean
head(r3, grant_access). body(r3, strong_auth_satisfied; r3, context_trusted; r3, threat_intel_clean).
weight(grant_access, 85).

% ========== CONTRARIES: Access decisions attack policies ==========
% Granting access without strong auth attacks the strong auth policy
contrary(require_strong_auth, c_strong_auth).
head(r10, c_strong_auth). body(r10, grant_access; r10, credentials_valid).
weight(c_strong_auth, 90).

% Granting access from untrusted context attacks the trusted context policy
contrary(require_trusted_context, c_trusted_context).
head(r11, c_trusted_context). body(r11, grant_access; r11, location_trusted).
weight(c_trusted_context, 75).

% Denying access attacks deny-by-default when no threats present
contrary(deny_by_default, c_deny_default).
head(r12, c_deny_default). body(r12, grant_access; r12, threat_intel_clean).
weight(c_deny_default, 60).
`,

    legal: `%% Legal Contract Dispute
%% Proper ABA modeling: Legal DOCTRINES are assumptions
%% Facts of the case are atoms, legal conclusions are derived

% ========== ASSUMPTIONS: Legal doctrines (defeasible) ==========
assumption(strict_liability_doctrine).
assumption(force_majeure_doctrine).
assumption(good_faith_doctrine).

weight(strict_liability_doctrine, 90).
weight(force_majeure_doctrine, 85).
weight(good_faith_doctrine, 80).

% ========== FACTS: Case facts and evidence ==========
% Modeled as rules with empty bodies (always supported)
head(fact1, contract_signed).
head(fact2, work_incomplete).
head(fact3, delay_documented).
head(fact4, weather_event_occurred).
head(fact5, clause_force_majeure_present).
head(fact6, defendant_notified_plaintiff).

weight(contract_signed, 95).
weight(work_incomplete, 90).
weight(delay_documented, 85).
weight(weather_event_occurred, 80).
weight(clause_force_majeure_present, 90).
weight(defendant_notified_plaintiff, 70).

% ========== DERIVED: Legal conclusions ==========
% r1: material_breach <- work_incomplete, delay_documented
head(r1, material_breach). body(r1, work_incomplete; r1, delay_documented).
weight(material_breach, 88).

% r2: force_majeure_applies <- clause_force_majeure_present, weather_event_occurred
head(r2, force_majeure_applies). body(r2, clause_force_majeure_present; r2, weather_event_occurred).
weight(force_majeure_applies, 85).

% r3: defendant_liable <- strict_liability_doctrine, material_breach, contract_signed
head(r3, defendant_liable). body(r3, strict_liability_doctrine; r3, material_breach; r3, contract_signed).
weight(defendant_liable, 90).

% r4: defendant_excused <- force_majeure_doctrine, force_majeure_applies
head(r4, defendant_excused). body(r4, force_majeure_doctrine; r4, force_majeure_applies).
weight(defendant_excused, 82).

% ========== CONTRARIES: Legal conclusions attack doctrines ==========
% Force majeure defense attacks strict liability
contrary(strict_liability_doctrine, c_strict_liability).
head(r10, c_strict_liability). body(r10, defendant_excused).
weight(c_strict_liability, 80).

% Finding liability attacks force majeure doctrine
contrary(force_majeure_doctrine, c_force_majeure).
head(r11, c_force_majeure). body(r11, defendant_liable).
weight(c_force_majeure, 78).

% Breach without notification attacks good faith
contrary(good_faith_doctrine, c_good_faith).
head(r12, c_good_faith). body(r12, material_breach; r12, defendant_notified_plaintiff).
weight(c_good_faith, 65).
`,

    scientific: `%% Scientific Hypothesis Evaluation
%% Proper ABA modeling: Competing THEORIES are assumptions
%% Observational data are facts, predictions are derived

% ========== ASSUMPTIONS: Scientific theories (defeasible) ==========
assumption(exoplanet_transit_theory).
assumption(stellar_activity_theory).
assumption(instrument_artifact_theory).

weight(exoplanet_transit_theory, 85).
weight(stellar_activity_theory, 75).
weight(instrument_artifact_theory, 60).

% ========== FACTS: Observational data ==========
% Modeled as rules with empty bodies (always supported)
head(fact1, periodic_dimming_observed).
head(fact2, period_stable).
head(fact3, transit_depth_consistent).
head(fact4, multi_wavelength_confirmed).
head(fact5, telescope_calibrated).
head(fact6, other_stars_stable).
head(fact7, stellar_rotation_period_known).

weight(periodic_dimming_observed, 95).
weight(period_stable, 90).
weight(transit_depth_consistent, 85).
weight(multi_wavelength_confirmed, 88).
weight(telescope_calibrated, 92).
weight(other_stars_stable, 87).
weight(stellar_rotation_period_known, 80).

% ========== DERIVED: Predictions from theories ==========
% r1: planet_transit_predicted <- exoplanet_transit_theory, periodic_dimming_observed, period_stable
head(r1, planet_transit_predicted). body(r1, exoplanet_transit_theory; r1, periodic_dimming_observed; r1, period_stable).
weight(planet_transit_predicted, 85).

% r2: stellar_spot_predicted <- stellar_activity_theory, periodic_dimming_observed, stellar_rotation_period_known
head(r2, stellar_spot_predicted). body(r2, stellar_activity_theory; r2, periodic_dimming_observed; r2, stellar_rotation_period_known).
weight(stellar_spot_predicted, 72).

% r3: discovery_confirmed <- planet_transit_predicted, multi_wavelength_confirmed, telescope_calibrated
head(r3, discovery_confirmed). body(r3, planet_transit_predicted; r3, multi_wavelength_confirmed; r3, telescope_calibrated).
weight(discovery_confirmed, 90).

% ========== CONTRARIES: Evidence attacks competing theories ==========
% Multi-wavelength confirmation attacks stellar activity theory
contrary(stellar_activity_theory, c_stellar_activity).
head(r10, c_stellar_activity). body(r10, multi_wavelength_confirmed; r10, other_stars_stable).
weight(c_stellar_activity, 80).

% Stellar rotation correlation attacks exoplanet theory
contrary(exoplanet_transit_theory, c_exoplanet).
head(r11, c_exoplanet). body(r11, stellar_spot_predicted; r11, stellar_rotation_period_known).
weight(c_exoplanet, 75).

% Telescope stability attacks instrument artifact theory
contrary(instrument_artifact_theory, c_artifact).
head(r12, c_artifact). body(r12, telescope_calibrated; r12, other_stars_stable).
weight(c_artifact, 85).
`,

    investment: `%% Investment Portfolio Allocation
%% Proper ABA modeling: Investment STRATEGIES are assumptions
%% Market indicators are facts, allocation decisions are derived

% ========== ASSUMPTIONS: Investment strategies (defeasible) ==========
assumption(growth_strategy).
assumption(conservative_strategy).
assumption(balanced_strategy).

weight(growth_strategy, 80).
weight(conservative_strategy, 75).
weight(balanced_strategy, 85).

% ========== FACTS: Market indicators and conditions ==========
% Modeled as rules with empty bodies (always supported)
head(fact1, equity_bull_trend).
head(fact2, low_interest_rates).
head(fact3, inflation_rising).
head(fact4, recession_risk_low).
head(fact5, client_long_term_horizon).
head(fact6, client_risk_tolerant).

weight(equity_bull_trend, 75).
weight(low_interest_rates, 85).
weight(inflation_rising, 70).
weight(recession_risk_low, 65).
weight(client_long_term_horizon, 90).
weight(client_risk_tolerant, 80).

% ========== DERIVED: Portfolio allocation decisions ==========
% r1: allocate_equities_high <- growth_strategy, equity_bull_trend, client_risk_tolerant
head(r1, allocate_equities_high). body(r1, growth_strategy; r1, equity_bull_trend; r1, client_risk_tolerant).
weight(allocate_equities_high, 78).

% r2: allocate_bonds_high <- conservative_strategy, inflation_rising
head(r2, allocate_bonds_high). body(r2, conservative_strategy; r2, inflation_rising).
weight(allocate_bonds_high, 70).

% r3: diversified_allocation <- balanced_strategy, client_long_term_horizon
head(r3, diversified_allocation). body(r3, balanced_strategy; r3, client_long_term_horizon).
weight(diversified_allocation, 82).

% ========== CONTRARIES: Allocation decisions attack strategies ==========
% High equity allocation during inflation attacks conservative strategy
contrary(conservative_strategy, c_conservative).
head(r10, c_conservative). body(r10, allocate_equities_high; r10, inflation_rising).
weight(c_conservative, 72).

% High bond allocation in bull market attacks growth strategy
contrary(growth_strategy, c_growth).
head(r11, c_growth). body(r11, allocate_bonds_high; r11, equity_bull_trend).
weight(c_growth, 68).

% Non-diversified allocation attacks balanced strategy
contrary(balanced_strategy, c_balanced).
head(r12, c_balanced). body(r12, allocate_equities_high; r12, client_long_term_horizon).
weight(c_balanced, 65).
`,

    network: `%% Network Troubleshooting
%% Proper ABA modeling: Diagnostic HYPOTHESES are assumptions
%% Network observations are facts, diagnoses are derived

% ========== ASSUMPTIONS: Diagnostic hypotheses (defeasible) ==========
assumption(layer1_fault_hypothesis).
assumption(layer2_fault_hypothesis).
assumption(configuration_error_hypothesis).

weight(layer1_fault_hypothesis, 85).
weight(layer2_fault_hypothesis, 80).
weight(configuration_error_hypothesis, 75).

% ========== FACTS: Network observations and test results ==========
% Modeled as rules with empty bodies (always supported)
head(fact1, packet_loss_observed).
head(fact2, interface_errors_detected).
head(fact3, switch_ports_up).
head(fact4, specific_subnet_affected).
head(fact5, firewall_logs_normal).
head(fact6, recent_config_change).
head(fact7, cables_recently_moved).

weight(packet_loss_observed, 90).
weight(interface_errors_detected, 95).
weight(switch_ports_up, 88).
weight(specific_subnet_affected, 85).
weight(firewall_logs_normal, 80).
weight(recent_config_change, 92).
weight(cables_recently_moved, 87).

% ========== DERIVED: Diagnostic conclusions ==========
% r1: physical_layer_problem <- layer1_fault_hypothesis, interface_errors_detected, cables_recently_moved
head(r1, physical_layer_problem). body(r1, layer1_fault_hypothesis; r1, interface_errors_detected; r1, cables_recently_moved).
weight(physical_layer_problem, 88).

% r2: switching_problem <- layer2_fault_hypothesis, specific_subnet_affected, switch_ports_up
head(r2, switching_problem). body(r2, layer2_fault_hypothesis; r2, specific_subnet_affected; r2, switch_ports_up).
weight(switching_problem, 82).

% r3: config_problem <- configuration_error_hypothesis, recent_config_change, specific_subnet_affected
head(r3, config_problem). body(r3, configuration_error_hypothesis; r3, recent_config_change; r3, specific_subnet_affected).
weight(config_problem, 85).

% ========== CONTRARIES: Diagnoses attack competing hypotheses ==========
% Configuration problem attacks layer1 hypothesis
contrary(layer1_fault_hypothesis, c_layer1).
head(r10, c_layer1). body(r10, config_problem; r10, recent_config_change).
weight(c_layer1, 78).

% Physical layer problem attacks configuration hypothesis
contrary(configuration_error_hypothesis, c_config).
head(r11, c_config). body(r11, physical_layer_problem; r11, interface_errors_detected).
weight(c_config, 80).

% Switching problem attacks layer1 hypothesis when ports are up
contrary(layer1_fault_hypothesis, c_layer1_alt).
head(r12, c_layer1_alt). body(r12, switching_problem; r12, switch_ports_up).
weight(c_layer1_alt, 75).
`
};

// Make examples available globally
window.WABAExamples = examples;
