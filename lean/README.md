# Imba Lean core

This package is the sole authority for ranks, strength comparison, fusion,
promotion, rank names, multi-axis defense against Nature, initiative, the
living-state invariants, the Shadow projection, and combat continuity. It targets Lean `v4.30.0`
and uses only Lean/Std.

Build and run from this directory:

```sh
lake build
lake exe imba-core -- ping
lake exe imba-core -- name 6
lake exe imba-core -- beats 6 5
lake exe imba-core -- fuse 5 5
lake exe imba-core -- promote 5 2
lake exe imba-core -- defense-roll 20260813 1 5
lake exe imba-core -- defense-resolve 20260813 1 5 XY
lake exe imba-core -- defense-roll 20260813 1 5 ANCHOR
lake exe imba-core -- defense-resolve 20260813 1 5 XY RIFT
lake exe imba-core -- defense-mastery 3 RIFT 100 100
lake exe imba-core -- first-strike 3 8 2 0
lake exe imba-core -- tension-carry 8 3 2
lake exe imba-core -- living-admit 0 0 0 0 3 2 XY
lake exe imba-core -- certificate-admit 20260813 4 5 6
lake exe imba-core -- tick-stage 4 5 4
lake exe imba-core -- combat-admit 20260813 0 0 1 0 PLAYER ATTACK 21
lake exe imba-core -- spell-repair 20260813 1 2 9 8 0 MEMORY RELEASE ECHO VEIL
```

Every invocation writes exactly one JSON object to stdout. Invalid input writes
a JSON error and returns exit status `2`. A rejected fusion is a valid domain
answer (`ok=true`, `allowed=false`) and returns exit status `0`.

`tick-stage` is the Lean-backed first half of the manual gate. It calculates
`pendingTick = confirmedTicks + 1` while theorems certify that rank and
certificate remain held until the separate confirmation.

`spell-repair` is the authoritative recovery contract for a held formula. Lean
enumerates the finite `4⁴` formula space, keeps admitted targets only, and
chooses first by the smallest number of rune replacements and then by the
smallest declared tension cost. It returns the complete per-slot route,
resulting `F/C/R`, synergy, verdict, and consequence; no road step, rank, or
certificate changes while the player is only applying the proposed route.

Defense starts with a deterministic four-axis d6 throw `(X,Y,Z,W)`. Chapter II
can preserve that certified total through `THROW`, balanced `ANCHOR`, or
concentrated `RIFT` geometry. The player chooses
one of the six coordinate planes `XY`, `XZ`, `XW`, `YZ`, `YW`, or `ZW`. Lean
computes the absorbed axes and the complementary open plane. Residual damage
is `interrupted rank + complementary-plane power`. The theorem
`defense_conserves_impact` proves that absorbed and residual parts equal the
whole impact; `full_block_impossible` proves that residual damage is nonzero.

`defense-mastery` records the three Chapter II geometries as a Lean-owned
bitmask. The finale certificate is admitted only after `THROW`, `ANCHOR`, and
`RIFT` have all been witnessed, both lives remain nonzero, and the shared
balance criterion is at least `65`. The theorem
`chapterTwoFinale_keeps_both_lives` proves that an admitted finale cannot
coincide with either life reaching zero.

Every finished session adds `confirmed ticks + Nature damage + 1` to internal
tension, so even a zero-tick session increases it. In a later session, at least
one confirmed tick plus nonzero carried tension enables one first strike. Lean
is authoritative for both eligibility and damage. Four-axis session memory
adds reflective depth to that damage.

The living-state layer adapts the architecture of
[DL-04 / Living Model in a Virtual Domain](https://chertogi-razuma-research.kernelpanic888.chatgpt.site/readers/digital-life-living-model/):
identity remains fixed, every admitted tick extends a certified prefix, a
Nature-rejected tick is not admitted, and each finished session bends memory
along the complementary plane. This is a game-state model, not a claim of
consciousness or literal life.

`Imba.Shadow` adapts the boundary discipline of
[AR-01 / Activation Relic: Shadow Boundary](https://chertogi-razuma-research.kernelpanic888.chatgpt.site/readers/activation-relic-shadow-boundary/).
It defines pure creation and return ledgers, an ordered in-domain relic, and the
observable last-three cut. `shadow_cut_reconstructs` proves that the opaque
prefix and visible cut reconstruct the full line; `visibleCut_at_most_three`
proves that observation never exposes more than three pieces. The relic-order
theorems prove that every admitted crossing leaves exactly the next internal
record; they do not claim direct observation of the Shadow source.

`Imba.Combat` adapts
[CR-01 / Certified Continuity Protocol Candidate](https://chertogi-razuma-research.kernelpanic888.chatgpt.site/readers/certified-continuity-protocol/)
to attacks and reactions. `combatAdmissible` requires the next epoch and the
exact observed parent head. Lean proves strict epoch growth, rollback rejection,
wrong-parent rejection, direct-reaction admission, and `HOLD` semantics for a
rejected candidate. Its numeric commitment is an auditable game identifier,
not a cryptographic hash, signature, or security proof.

The generated name chain begins with `super`, `meta`, `nano`, `quasi`, and
`ultra`. It then continues without a built-in maximum using `tier-6`,
`tier-7`, and so on. The numeric rank remains authoritative.
