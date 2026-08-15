import Init.Data.List.Lemmas
import Std.Tactic

/-!
# Imba: the Shadow and its three-piece cut

The full stack is real game state, but observation exposes only its newest
three pieces.  Older active pieces remain behind an opaque Shadow boundary.
Pieces manifest by a pure creation act and may later return.  The observer
receives an ordered activation relic for a crossing, never the Shadow source.
-/

namespace Imba

/-- The World can expose at most the last three pieces of its full line. -/
def visibleCutDepth : Nat := 3

def hiddenDepth (line : List α) : Nat := line.length - visibleCutDepth

def shadowPrefix (line : List α) : List α := line.take (hiddenDepth line)

def visibleCut (line : List α) : List α := line.drop (hiddenDepth line)

/-- Shadow and visible cut reconstruct the unmodified full line. -/
theorem shadow_cut_reconstructs (line : List α) :
    shadowPrefix line ++ visibleCut line = line := by
  exact List.take_append_drop (hiddenDepth line) line

/-- Observation can never reveal more than three pieces. -/
theorem visibleCut_at_most_three (line : List α) :
    (visibleCut line).length ≤ visibleCutDepth := by
  simp [visibleCut, hiddenDepth, visibleCutDepth]
  omega

/-- Internal ledger.  Shadow inhabitants themselves stay opaque. -/
structure ShadowLedger where
  manifested : Nat := 0
  returned : Nat := 0
  relicOrder : Nat := 0
  deriving Repr, DecidableEq

/-- Pure creation manifests one new piece without consuming another piece. -/
def pureCreation (ledger : ShadowLedger) : ShadowLedger :=
  { ledger with
      manifested := ledger.manifested + 1
      relicOrder := ledger.relicOrder + 1 }

/-- A finite collection of pieces can leave the World for the Shadow. -/
def returnToShadow (ledger : ShadowLedger) (amount : Nat) : ShadowLedger :=
  { ledger with
      returned := ledger.returned + amount
      relicOrder := ledger.relicOrder + 1 }

theorem pure_creation_adds_one (ledger : ShadowLedger) :
    (pureCreation ledger).manifested = ledger.manifested + 1 := rfl

theorem pure_creation_preserves_returns (ledger : ShadowLedger) :
    (pureCreation ledger).returned = ledger.returned := rfl

theorem return_to_shadow_adds_amount (ledger : ShadowLedger) (amount : Nat) :
    (returnToShadow ledger amount).returned = ledger.returned + amount := rfl

/-- Every admitted boundary interaction advances the in-domain relic order. -/
theorem pure_creation_leaves_next_relic (ledger : ShadowLedger) :
    (pureCreation ledger).relicOrder = ledger.relicOrder + 1 := rfl

theorem return_leaves_next_relic (ledger : ShadowLedger) (amount : Nat) :
    (returnToShadow ledger amount).relicOrder = ledger.relicOrder + 1 := rfl

end Imba
