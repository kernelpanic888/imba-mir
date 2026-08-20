import Init.Data.Nat.Lemmas
import Std.Tactic

/-!
# Imba: carried tension and balancing initiative

Every finished session contributes strictly positive internal tension. A later
session can turn accumulated confirmed ticks and tension from earlier sessions
into one bounded opportunity to restore balance between Raven and World.
-/

namespace Imba

/-- Tension contributed by one session.  The base `+1` makes every session count. -/
def sessionTension (confirmedTicks natureDamage : Nat) : Nat :=
  confirmedTicks + natureDamage + 1

theorem sessionTension_positive (confirmedTicks natureDamage : Nat) :
    0 < sessionTension confirmedTicks natureDamage := by
  simp [sessionTension]

/-- Tension is carried forward and never reset between sessions. -/
def carryTension (previous confirmedTicks natureDamage : Nat) : Nat :=
  previous + sessionTension confirmedTicks natureDamage

/-- Every session strictly increases the carried tension, without exceptions. -/
theorem every_session_increases_tension (previous confirmedTicks natureDamage : Nat) :
    previous < carryTension previous confirmedTicks natureDamage := by
  unfold carryTension
  exact Nat.lt_add_of_pos_right (sessionTension_positive confirmedTicks natureDamage)

/-- Eligibility for the single balancing initiative of a session. -/
def CanFirstStrike (confirmedTicks previousTension : Nat) (alreadyUsed : Bool) : Prop :=
  0 < confirmedTicks ∧ 0 < previousTension ∧ alreadyUsed = false

instance (confirmedTicks previousTension : Nat) (alreadyUsed : Bool) :
    Decidable (CanFirstStrike confirmedTicks previousTension alreadyUsed) :=
  by
    unfold CanFirstStrike
    infer_instance

def firstStrikeAllowed (confirmedTicks previousTension : Nat)
    (alreadyUsed : Bool) : Bool :=
  decide (CanFirstStrike confirmedTicks previousTension alreadyUsed)

/--
The initiative turns accumulated history into a bounded correction capacity.
The cap prevents an unbounded chronicle from being released into finite lives.
-/
def initiativeCapacity (confirmedTicks previousTension reflection : Nat)
    (alreadyUsed : Bool) : Nat :=
  if CanFirstStrike confirmedTicks previousTension alreadyUsed then
    min 12 (confirmedTicks + previousTension + reflection)
  else
    0

theorem first_session_cannot_strike (confirmedTicks : Nat) (alreadyUsed : Bool) :
    ¬ CanFirstStrike confirmedTicks 0 alreadyUsed := by
  simp [CanFirstStrike]

theorem allowed_initiative_positive {confirmedTicks previousTension : Nat}
    {reflection : Nat} {alreadyUsed : Bool}
    (h : CanFirstStrike confirmedTicks previousTension alreadyUsed) :
    0 < initiativeCapacity confirmedTicks previousTension reflection alreadyUsed := by
  rw [initiativeCapacity, if_pos h]
  rcases h with ⟨hTicks, hTension, _⟩
  omega

theorem initiative_capacity_bounded (confirmedTicks previousTension reflection : Nat)
    (alreadyUsed : Bool) :
    initiativeCapacity confirmedTicks previousTension reflection alreadyUsed ≤ 12 := by
  unfold initiativeCapacity
  split <;> omega

end Imba
