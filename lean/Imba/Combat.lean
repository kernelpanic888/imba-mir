import Std.Tactic

/-!
# Imba: certified combat continuity

Every attack or reaction is a candidate continuation of one observed combat
head.  Admission requires the next epoch and the exact current parent.  A
failed candidate leaves the head unchanged (`HOLD`).  This is a game protocol
model, not a cryptographic signature or a real-world security claim.
-/

namespace Imba

inductive CombatActor where
  | player | nature | world
  deriving Repr, DecidableEq, BEq

def CombatActor.label : CombatActor → String
  | .player => "PLAYER"
  | .nature => "NATURE"
  | .world => "WORLD"

def CombatActor.code : CombatActor → Nat
  | .player => 1
  | .nature => 2
  | .world => 3

inductive CombatKind where
  | attack | reaction
  deriving Repr, DecidableEq, BEq

def CombatKind.label : CombatKind → String
  | .attack => "ATTACK"
  | .reaction => "REACTION"

def CombatKind.code : CombatKind → Nat
  | .attack => 1
  | .reaction => 2

/-- Local successor check: next epoch and exact observed parent are mandatory. -/
def combatAdmissible (currentEpoch currentHead candidateEpoch parentHead : Nat) : Bool :=
  candidateEpoch == currentEpoch + 1 && parentHead == currentHead

/-- Deterministic game commitment.  It is deliberately not called a hash. -/
def combatCommitment (identity candidateEpoch parentHead : Nat)
    (actor : CombatActor) (kind : CombatKind) (payload : Nat) : Nat :=
  (parentHead + 1) * 131 + identity * 17 + candidateEpoch * 31 +
    actor.code * 13 + kind.code * 7 + payload * 19

def admittedEpoch (currentEpoch candidateEpoch parentHead currentHead : Nat) : Nat :=
  if combatAdmissible currentEpoch currentHead candidateEpoch parentHead then
    candidateEpoch
  else currentEpoch

def admittedHead (identity currentEpoch currentHead candidateEpoch parentHead : Nat)
    (actor : CombatActor) (kind : CombatKind) (payload : Nat) : Nat :=
  if combatAdmissible currentEpoch currentHead candidateEpoch parentHead then
    combatCommitment identity candidateEpoch parentHead actor kind payload
  else currentHead

theorem combat_admissible_iff (currentEpoch currentHead candidateEpoch parentHead : Nat) :
    combatAdmissible currentEpoch currentHead candidateEpoch parentHead = true ↔
      candidateEpoch = currentEpoch + 1 ∧ parentHead = currentHead := by
  simp [combatAdmissible]

theorem admitted_combat_strictly_advances {currentEpoch currentHead candidateEpoch parentHead : Nat}
    (h : combatAdmissible currentEpoch currentHead candidateEpoch parentHead = true) :
    currentEpoch < candidateEpoch := by
  rw [combat_admissible_iff] at h
  omega

theorem rollback_rejected {currentEpoch candidateEpoch : Nat}
    (currentHead parentHead : Nat) (h : candidateEpoch ≤ currentEpoch) :
    combatAdmissible currentEpoch currentHead candidateEpoch parentHead = false := by
  simp [combatAdmissible]
  omega

theorem wrong_parent_rejected (currentEpoch currentHead parentHead : Nat)
    (h : parentHead ≠ currentHead) :
    combatAdmissible currentEpoch currentHead (currentEpoch + 1) parentHead = false := by
  simp [combatAdmissible, h]

/-- A reaction built on the observed attack head is always a direct candidate. -/
theorem direct_reaction_admitted (attackEpoch attackHead : Nat) :
    combatAdmissible attackEpoch attackHead (attackEpoch + 1) attackHead = true := by
  simp [combatAdmissible]

theorem rejected_transition_holds_head (identity currentEpoch currentHead candidateEpoch parentHead : Nat)
    (actor : CombatActor) (kind : CombatKind) (payload : Nat)
    (h : combatAdmissible currentEpoch currentHead candidateEpoch parentHead = false) :
    admittedHead identity currentEpoch currentHead candidateEpoch parentHead actor kind payload =
      currentHead := by
  simp [admittedHead, h]

end Imba
