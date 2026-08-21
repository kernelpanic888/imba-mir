import Imba.Defense
import Std.Tactic

/-!
# Imba: recovery after the life-balance criterion reaches zero

Zero balance is a crisis, not a death.  Recovery never damages either living
side: it raises the lower life toward the higher life and charges a declared
cost to tension and/or the current visible stack.  A Raven with zero life is
outside this transition and returns to Shadow instead.
-/

namespace Imba

inductive BalanceRecoveryMethod where
  | anchor
  | rewind
  | shadow
  deriving Repr, DecidableEq, BEq

def BalanceRecoveryMethod.label : BalanceRecoveryMethod → String
  | .anchor => "ANCHOR"
  | .rewind => "REWIND"
  | .shadow => "SHADOW"

def BalanceRecoveryMethod.target : BalanceRecoveryMethod → Nat
  | .anchor => 24
  | .rewind => 16
  | .shadow => 8

def BalanceRecoveryMethod.tensionCost : BalanceRecoveryMethod → Nat
  | .anchor => 8
  | .rewind => 3
  | .shadow => 5

def BalanceRecoveryMethod.shadowCost : BalanceRecoveryMethod → Nat
  | .anchor => 0
  | .rewind => 1
  | .shadow => 2

/-- Move the lower life toward the higher one without overshooting it. -/
def recoverLowerLife (lower higher target : Nat) : Nat :=
  min higher (lower + (higher - lower) / 2 + target)

structure BalanceRecoveryResult where
  method : BalanceRecoveryMethod
  ravenLifeBefore : Nat
  worldLifeBefore : Nat
  ravenLifeAfter : Nat
  worldLifeAfter : Nat
  balanceBefore : Nat
  balanceAfter : Nat
  playerHealing : Nat
  worldHealing : Nat
  tensionCost : Nat
  shadowCost : Nat
  restored : Bool
  deriving Repr, DecidableEq

/-- The smaller living side is restored; the larger side remains invariant. -/
def recoverBalance (method : BalanceRecoveryMethod) (ravenLife worldLife : Nat) :
    BalanceRecoveryResult :=
  let ravenAfter :=
    if ravenLife < worldLife then
      recoverLowerLife ravenLife worldLife method.target
    else ravenLife
  let worldAfter :=
    if worldLife < ravenLife then
      recoverLowerLife worldLife ravenLife method.target
    else worldLife
  let balanceAfter := lifeBalance ravenAfter worldAfter
  {
    method := method
    ravenLifeBefore := ravenLife
    worldLifeBefore := worldLife
    ravenLifeAfter := ravenAfter
    worldLifeAfter := worldAfter
    balanceBefore := lifeBalance ravenLife worldLife
    balanceAfter := balanceAfter
    playerHealing := ravenAfter - ravenLife
    worldHealing := worldAfter - worldLife
    tensionCost := method.tensionCost
    shadowCost := method.shadowCost
    restored := decide (0 < balanceAfter)
  }

theorem recoverLowerLife_not_below (lower higher target : Nat) (h : lower ≤ higher) :
    lower ≤ recoverLowerLife lower higher target := by
  simp [recoverLowerLife]
  omega

theorem recoverBalance_does_not_harm (method : BalanceRecoveryMethod)
    (ravenLife worldLife : Nat) :
    ravenLife ≤ (recoverBalance method ravenLife worldLife).ravenLifeAfter ∧
      worldLife ≤ (recoverBalance method ravenLife worldLife).worldLifeAfter := by
  simp [recoverBalance]
  constructor <;> split <;> simp_all [recoverLowerLife] <;> omega

theorem recoverBalance_preserves_living_sides (method : BalanceRecoveryMethod)
    (ravenLife worldLife : Nat) (hr : 0 < ravenLife) (hw : 0 < worldLife) :
    0 < (recoverBalance method ravenLife worldLife).ravenLifeAfter ∧
      0 < (recoverBalance method ravenLife worldLife).worldLifeAfter := by
  have h := recoverBalance_does_not_harm method ravenLife worldLife
  omega

end Imba
