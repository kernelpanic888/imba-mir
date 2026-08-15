import Init.Data.Nat.Lemmas

/-!
# Imba: authoritative strength kernel

The rank is the source of truth. Names are only a presentation, and no dice,
board, or shell rule is allowed to redefine `Beats`.
-/

namespace Imba

/-- An Imba strength is an unbounded natural rank. -/
abbrev Rank := Nat

/-- `attacker` beats `defender` exactly when its rank is strictly greater. -/
def Beats (attacker defender : Rank) : Prop := defender < attacker

/-- Executable decision procedure corresponding to `Beats`. -/
def beatsBool (attacker defender : Rank) : Bool := decide (defender < attacker)

theorem beatsBool_eq_true_iff (attacker defender : Rank) :
    beatsBool attacker defender = true ↔ Beats attacker defender := by
  simp [beatsBool, Beats]

theorem beats_irreflexive (rank : Rank) : ¬ Beats rank rank := by
  exact Nat.lt_irrefl rank

theorem beats_asymmetric {a b : Rank} (hab : Beats a b) : ¬ Beats b a := by
  exact Nat.lt_asymm hab

theorem beats_transitive {a b c : Rank} (hab : Beats a b) (hbc : Beats b c) :
    Beats a c := by
  exact Nat.lt_trans hbc hab

theorem equal_ranks_do_not_beat {a b : Rank} (h : a = b) :
    ¬ Beats a b ∧ ¬ Beats b a := by
  subst b
  exact ⟨Nat.lt_irrefl a, Nat.lt_irrefl a⟩

/-- Different ranks determine exactly one direction of victory. -/
theorem different_ranks_exactly_one {a b : Rank} (h : a ≠ b) :
    (Beats a b ∧ ¬ Beats b a) ∨ (Beats b a ∧ ¬ Beats a b) := by
  rcases Nat.lt_or_gt_of_ne h with hab | hba
  · exact Or.inr ⟨hab, Nat.lt_asymm hab⟩
  · exact Or.inl ⟨hba, Nat.lt_asymm hba⟩

/-- Every rank has a strictly stronger successor. -/
theorem no_maximum (rank : Rank) : Beats (rank + 1) rank := by
  exact Nat.lt_succ_self rank

/-- Equivalently, there is no globally unbeatable natural rank. -/
theorem no_absolute_maximum :
    ¬ ∃ maximum : Rank, ∀ candidate : Rank, ¬ Beats candidate maximum := by
  intro h
  cases h with
  | intro maximum hMaximum =>
      exact hMaximum (maximum + 1) (no_maximum maximum)

/-- Equal ranks fuse into their common successor; unequal ranks cannot fuse. -/
def fuse (left right : Rank) : Option Rank :=
  if left = right then some (left + 1) else none

@[simp] theorem fuse_equal (rank : Rank) : fuse rank rank = some (rank + 1) := by
  simp [fuse]

theorem fuse_unequal {left right : Rank} (h : left ≠ right) :
    fuse left right = none := by
  simp [fuse, h]

/-- A successful fusion is stronger than both of its inputs. -/
theorem fuse_stronger {left right result : Rank}
    (h : fuse left right = some result) :
    Beats result left ∧ Beats result right := by
  unfold fuse at h
  split at h
  case isTrue heq =>
    subst right
    simp only [Option.some.injEq] at h
    subst result
    exact ⟨no_maximum left, no_maximum left⟩
  case isFalse _ =>
    simp at h

/-- Promotion is a pre-combat state transition, never a special combat rule. -/
def promote (rank delta : Rank) : Rank := rank + delta

@[simp] theorem promote_zero (rank : Rank) : promote rank 0 = rank := by
  simp [promote]

theorem promote_monotone (rank delta : Rank) : rank ≤ promote rank delta := by
  exact Nat.le_add_right rank delta

theorem promote_positive_stronger (rank delta : Rank) (h : 0 < delta) :
    Beats (promote rank delta) rank := by
  exact Nat.lt_add_of_pos_right h

/--
Prefix number `0` starts the hand-authored chain. Later prefixes are generated
recursively, so the display grammar never imposes a maximum rank.
-/
def tierPrefix : Nat → String
  | 0 => "super"
  | 1 => "meta"
  | 2 => "nano"
  | 3 => "quasi"
  | 4 => "ultra"
  | n => "tier-" ++ toString (n + 1)

/-- The first `count` tier prefixes, joined left-to-right with hyphens. -/
def tierPrefixChain : Nat → String
  | 0 => ""
  | count + 1 =>
      let previous := tierPrefixChain count
      let current := tierPrefix count
      if previous.isEmpty then current else previous ++ "-" ++ current

/-- Canonical, total presentation for every natural rank. -/
def name : Rank → String
  | 0 => "non-imba"
  | 1 => "imba"
  | rank + 2 => tierPrefixChain (rank + 1) ++ "-imba"

end Imba
