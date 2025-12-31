// WABA Playground - Example Frameworks
// Topology-focused examples with both derived and non-derived attacks
// CRITICAL: contrary is a FUNCTION - each assumption has exactly ONE contrary

export const examples = {
    simple: `%% Simple Example - Mixed Attacks
%% Demonstrates: derived attack (c_a <- b) + non-derived attack (c directly)
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

% Non-derived attack: c_c always holds and attacks c
head(r2, c_c).
weight(c_c, 50).

% Contraries: each assumption has exactly ONE contrary
contrary(a, c_a).   % c_a is the contrary of a (derived)
contrary(b, c_c).   % c_c is the contrary of b (non-derived)
contrary(c, c_c).   % c_c is the contrary of c (non-derived)

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

% Linear attack chain: each assumption attacks the next
% Non-derived: c_a always holds, attacks a (start of chain)
head(r1, c_a).
weight(c_a, 80).

% Derived: c_b <- a (a attacks b)
head(r2, c_b).
body(r2, a).
weight(c_b, 85).

% Derived: c_c <- b (b attacks c)
head(r3, c_c).
body(r3, b).
weight(c_c, 65).

% Derived: c_d <- c (c attacks d)
head(r4, c_d).
body(r4, c).
weight(c_d, 45).

% Contraries: each assumption has exactly ONE contrary
contrary(a, c_a).   % chain start: c_a attacks a
contrary(b, c_b).   % chain: a attacks b
contrary(c, c_c).   % chain: b attacks c
contrary(d, c_d).   % chain: c attacks d

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

% Cycle of attacks
% c_a <- c (c attacks a via derivation)
head(r1, c_a).
body(r1, c).
weight(c_a, 75).

% c_b <- a (a attacks b via derivation)
head(r2, c_b).
body(r2, a).
weight(c_b, 85).

% c_c <- b (b attacks c via derivation)
head(r3, c_c).
body(r3, b).
weight(c_c, 65).

% Contraries: each assumption has exactly ONE contrary
contrary(a, c_a).   % cycle: c -> a
contrary(b, c_b).   % cycle: a -> b
contrary(c, c_c).   % cycle: b -> c

budget(100).
`,

    tree: `%% Tree Topology Example
%% Structure: root 'a' branches to b,c; b branches to d
%% Shows: hierarchical attack structure

assumption(a).
assumption(b).
assumption(c).
assumption(d).

weight(a, 100).
weight(b, 80).
weight(c, 70).
weight(d, 50).

% Root level: c_a attacks root
head(r1, c_a).
weight(c_a, 90).

% Branch 1: c_b <- a (a attacks b, derived)
head(r2, c_b).
body(r2, a).
weight(c_b, 85).

% Branch 2: c_c <- a (a attacks c, derived)
head(r3, c_c).
body(r3, a).
weight(c_c, 75).

% Leaf: c_d <- b (b attacks d, derived)
head(r4, c_d).
body(r4, b).
weight(c_d, 60).

% Contraries: each assumption has exactly ONE contrary
contrary(a, c_a).   % root is attacked
contrary(b, c_b).   % a attacks b
contrary(c, c_c).   % a attacks c
contrary(d, c_d).   % b attacks d

budget(120).
`,

    complete: `%% Complete Topology Example
%% Structure: mutual attacks between all assumptions
%% Shows: fully connected conflict graph

assumption(a).
assumption(b).
assumption(c).

weight(a, 90).
weight(b, 80);
weight(c, 70).

% Complete graph: everyone attacks everyone else
% c_a <- b,c (both b and c attack a jointly)
head(r1, c_a).
body(r1, b; r1, c).
weight(c_a, 95).

% c_b <- a,c (both a and c attack b jointly)
head(r2, c_b).
body(r2, a; r2, c).
weight(c_b, 90).

% c_c <- a,b (both a and b attack c jointly)
head(r3, c_c).
body(r3, a; r3, b).
weight(c_c, 85).

% Contraries: each assumption has exactly ONE contrary
contrary(a, c_a).   % b,c jointly attack a
contrary(b, c_b).   % a,c jointly attack b
contrary(c, c_c).   % a,b jointly attack c

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

% Linear segment: e -> d -> c
% c_e <- (always holds)
head(r1, c_e).
weight(c_e, 55).

% c_d <- e (e attacks d)
head(r2, c_d).
body(r2, e).
weight(c_d, 65).

% c_c <- d (d attacks c)
head(r3, c_c).
body(r3, d).
weight(c_c, 75).

% Branching: both a and b attack c
% Already covered by c_c above

% Cycle segment: a <-> b
% c_a <- b,d (joint attack from b and d)
head(r4, c_a).
body(r4, b; r4, d).
weight(c_a, 95).

% c_b <- a (a attacks b)
head(r5, c_b).
body(r5, a).
weight(c_b, 85).

% Contraries: each assumption has exactly ONE contrary
contrary(a, c_a).   % b,d attack a
contrary(b, c_b).   % a attacks b
contrary(c, c_c).   % d attacks c
contrary(d, c_d).   % e attacks d
contrary(e, c_e).   % always attacked

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
% c_a1 <- a2 (a2 attacks a1, derived)
head(r1, c_a1).
body(r1, a2).
weight(c_a1, 85).

% c_a2 <- a1 (a1 attacks a2, derived)
head(r2, c_a2).
body(r2, a1).
weight(c_a2, 82).

% Island 2: b1 <-> b2 (completely separate)
% c_b1 <- b2 (b2 attacks b1, derived)
head(r3, c_b1).
body(r3, b2).
weight(c_b1, 65).

% c_b2 <- b1 (b1 attacks b2, derived)
head(r4, c_b2).
body(r4, b1).
weight(c_b2, 62).

% Contraries: each assumption has exactly ONE contrary
contrary(a1, c_a1).   % island 1: a2 attacks a1
contrary(a2, c_a2).   % island 1: a1 attacks a2
contrary(b1, c_b1).   % island 2: b2 attacks b1
contrary(b2, c_b2).   % island 2: b1 attacks b2

budget(100).
`
};

// Make examples available globally
window.WABAExamples = examples;
