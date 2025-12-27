// WABA Playground - Example Frameworks
// Topology-focused examples with both derived and non-derived attacks

const examples = {
    simple: `%% Simple Example - Mixed Attacks
%% Demonstrates: derived attack (c_a <- b) + non-derived attack (c_c <- d)
%% Shows: not all atoms need weights

assumption(a).
assumption(b).
assumption(c).

% Only some atoms are weighted (c is unweighted)
weight(a, 80).
weight(b, 60).

% Derived attack: c_a <- b (b supports c_a which attacks a)
head(r1, c_a).
body(r1, b).
weight(c_a, 70).

% Non-derived attack: d always holds, attacks c
head(r2, d).
weight(d, 50).

% Contraries: define attack targets
contrary(a, c_a).  % c_a attacks a (derived)
contrary(c, d).    % d attacks c (non-derived)

budget(100).
`,

    linear: `%% Linear Topology Example
%% Structure: a -> b -> c -> d (chain of attacks)
%% Shows: sequential attack propagation

assumption(a).
assumption(b).
assumption(c).
assumption(d).

weight(a, 90).
weight(b, 70).
weight(c, 50).
weight(d, 30).

% Linear attack chain
% b attacks a (non-derived)
contrary(a, b).

% c_b <- c (derived attack on b)
head(r1, c_b).
body(r1, c).
weight(c_b, 60).
contrary(b, c_b).

% d attacks c (non-derived)
contrary(c, d).

budget(80).
`,

    cycle: `%% Cycle Topology Example
%% Structure: a -> b -> c -> a (circular attacks)
%% Shows: mutual defeat cycles

assumption(a).
assumption(b).
assumption(c).

weight(a, 80).
weight(b, 70).
weight(c, 60).

% Cycle: a attacks b, b attacks c, c attacks a
% b attacks a (non-derived)
contrary(a, b).

% c_b <- c (derived attack on b)
head(r1, c_b).
body(r1, c).
weight(c_b, 65).
contrary(b, c_b).

% a attacks c (non-derived)
contrary(c, a).

budget(100).
`,

    tree: `%% Tree Topology Example
%% Structure: root 'a' has children b,c; b has child d
%% Shows: hierarchical attack structure

assumption(a).
assumption(b).
assumption(c).
assumption(d).

weight(a, 100).
weight(b, 80).
weight(c, 70).
weight(d, 50).

% Root attacks: a attacks both b and c
contrary(b, a).  % a attacks b (non-derived)
contrary(c, a);  % a attacks c (non-derived)

% Leaf attacks: d attacks b via derived attack
head(r1, c_b).
body(r1, d).
weight(c_b, 60).
contrary(b, c_b);  % c_b attacks b (derived)

budget(120).
`,

    complete: `%% Complete Topology Example
%% Structure: every assumption attacks every other
%% Shows: fully connected conflict graph

assumption(a).
assumption(b).
assumption(c).

weight(a, 90).
weight(b, 80);
weight(c, 70).

% Non-derived attacks
contrary(a, b).  % b attacks a
contrary(b, c).  % c attacks b

% Derived attacks
head(r1, c_a).   % c_a <- c (c attacks a indirectly)
body(r1, c).
weight(c_a, 75).
contrary(a, c_a).

head(r2, c_c).   % c_c <- a (a attacks c indirectly)
body(r2, a).
weight(c_c, 85).
contrary(c, c_c).

% More complex: b,c together attack a
head(r3, c_a2).
body(r3, b; r3, c).
weight(c_a2, 95).
contrary(a, c_a2).

budget(150).
`,

    mixed: `%% Mixed Topology Example
%% Combines linear chains, cycles, and branching
%% Shows: realistic complex structure

assumption(a).
assumption(b).
assumption(c).
assumption(d).
assumption(e).

weight(a, 100).
weight(b, 90).
weight(c, 80).
weight(d, 70).
weight(e, 60).

% Linear chain: e -> d -> c
contrary(d, e).  % e attacks d (non-derived)
contrary(c, d).  % d attacks c (non-derived)

% Branch: a,b both attack c
contrary(c, a).  % a attacks c (non-derived)

head(r1, c_c).   % c_c <- b (b attacks c via derivation)
body(r1, b).
weight(c_c, 85).
contrary(c, c_c).

% Cycle: b <-> a
head(r2, c_a).   % c_a <- b,d (joint attack on a)
body(r2, b; r2, d).
weight(c_a, 95).
contrary(a, c_a).

contrary(b, a).  % a attacks b (non-derived, completes cycle)

budget(200).
`,

    isolated: `%% Isolated Components Example
%% Structure: separate conflict clusters with no interaction
%% Shows: independent argumentation islands

assumption(a1).
assumption(a2).
assumption(b1).
assumption(b2).

weight(a1, 90).
weight(a2, 80).
weight(b1, 70).
weight(b2, 60).

% Island 1: a1 <-> a2
contrary(a1, a2).  % a2 attacks a1 (non-derived)

head(r1, c_a2).    % c_a2 <- a1 (a1 attacks a2 derived)
body(r1, a1).
weight(c_a2, 85).
contrary(a2, c_a2).

% Island 2: b1 <-> b2 (completely separate)
contrary(b1, b2).  % b2 attacks b1 (non-derived)

head(r2, c_b2).    % c_b2 <- b1 (b1 attacks b2 derived)
body(r2, b1).
weight(c_b2, 65).
contrary(b2, c_b2).

budget(100).
`
};

// Make examples available globally
window.WABAExamples = examples;
