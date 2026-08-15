import Init.Data.Nat.Lemmas
import Std.Tactic

/-!
# Imba: carried tension and first strike

Every finished session contributes strictly positive internal tension.  A later
session can turn accumulated confirmed ticks and tension from earlier sessions
into one first strike against the World.
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

/-- Eligibility for the single first strike of a session. -/
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

/-- The first strike combines this session's tick pressure with carried tension. -/
def firstStrikeDamage (confirmedTicks previousTension reflection : Nat)
    (alreadyUsed : Bool) : Nat :=
  if CanFirstStrike confirmedTicks previousTension alreadyUsed then
    confirmedTicks + previousTension + reflection
  else
    0

theorem first_session_cannot_strike (confirmedTicks : Nat) (alreadyUsed : Bool) :
    ¬ CanFirstStrike confirmedTicks 0 alreadyUsed := by
  simp [CanFirstStrike]

theorem allowed_first_strike_positive {confirmedTicks previousTension : Nat}
    {reflection : Nat} {alreadyUsed : Bool}
    (h : CanFirstStrike confirmedTicks previousTension alreadyUsed) :
    0 < firstStrikeDamage confirmedTicks previousTension reflection alreadyUsed := by
  rw [firstStrikeDamage, if_pos h]
  rcases h with ⟨hTicks, hTension, _⟩
  omega

end Imba
