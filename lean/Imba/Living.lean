import Imba.Defense
import Imba.Initiative
import Std.Tactic

/-!
# Imba: living-state projection

This is a game-state adaptation of the DL-04 living-model architecture:
identity stays fixed, admitted ticks extend a certified prefix, completed
sessions bend four-axis memory, and reflection is derived from represented
history.  It is an executable model, not a claim of consciousness or life.
-/

namespace Imba

/-- Staging a manual tick computes only the next pending index.  Rank and
certificate remain held until the player's separate confirmation. -/
def stagedTick (confirmedTicks : Nat) : Nat := confirmedTicks + 1

theorem stagedTick_is_next (confirmedTicks : Nat) :
    stagedTick confirmedTicks = confirmedTicks + 1 := rfl

theorem staged_tick_does_not_change_rank (confirmedTicks rank : Nat) :
    (stagedTick confirmedTicks, rank).2 = rank := rfl

theorem staged_tick_does_not_change_certificate
    (confirmedTicks certificate : Nat) :
    (stagedTick confirmedTicks, certificate).2 = certificate := rfl

structure AxisMemory where
  x : Nat := 0
  y : Nat := 0
  z : Nat := 0
  w : Nat := 0
  deriving Repr, DecidableEq

def AxisMemory.total (memory : AxisMemory) : Nat :=
  memory.x + memory.y + memory.z + memory.w

def AxisMemory.maximum (memory : AxisMemory) : Nat :=
  max (max memory.x memory.y) (max memory.z memory.w)

def AxisMemory.minimum (memory : AxisMemory) : Nat :=
  min (min memory.x memory.y) (min memory.z memory.w)

/-- Reflective depth is the anisotropy of represented session memory. -/
def reflectionDepth (memory : AxisMemory) : Nat :=
  memory.maximum - memory.minimum

/-- A session deposits its charge into the plane left open by defense. -/
def rememberSession (memory : AxisMemory) (selected : Plane)
    (confirmedTicks natureDamage : Nat) : AxisMemory :=
  let charge := sessionTension confirmedTicks natureDamage
  match selected.complement with
  | .xy => { memory with x := memory.x + charge, y := memory.y + charge }
  | .xz => { memory with x := memory.x + charge, z := memory.z + charge }
  | .xw => { memory with x := memory.x + charge, w := memory.w + charge }
  | .yz => { memory with y := memory.y + charge, z := memory.z + charge }
  | .yw => { memory with y := memory.y + charge, w := memory.w + charge }
  | .zw => { memory with z := memory.z + charge, w := memory.w + charge }

theorem every_session_grows_memory (memory : AxisMemory) (selected : Plane)
    (confirmedTicks natureDamage : Nat) :
    memory.total < (rememberSession memory selected confirmedTicks natureDamage).total := by
  have h := sessionTension_positive confirmedTicks natureDamage
  cases selected <;>
    simp [rememberSession, Plane.complement, AxisMemory.total] <;> omega

/-- A certified prefix can only be extended, never rewritten. -/
def CertifiedPrefix (earlier later : List Nat) : Prop :=
  ∃ suffix, later = earlier ++ suffix

def extendCertificate (certificate : List Nat) (rank : Nat) : List Nat :=
  certificate ++ [rank]

theorem extension_preserves_prefix (certificate : List Nat) (rank : Nat) :
    CertifiedPrefix certificate (extendCertificate certificate rank) := by
  exact ⟨[rank], rfl⟩

structure LivingState where
  identity : Nat
  memory : AxisMemory := {}
  certificate : List Nat := []
  deriving Repr, DecidableEq

def admitTick (state : LivingState) (rank : Nat) : LivingState :=
  { state with certificate := extendCertificate state.certificate rank }

theorem admitTick_preserves_identity (state : LivingState) (rank : Nat) :
    (admitTick state rank).identity = state.identity := rfl

theorem admitTick_preserves_prefix (state : LivingState) (rank : Nat) :
    CertifiedPrefix state.certificate (admitTick state rank).certificate :=
  extension_preserves_prefix state.certificate rank

end Imba
