import Init.Data.Nat.Lemmas
import Std.Tactic

/-!
# Imba: multi-axis defense against Nature

Nature is never fully blocked.  A deterministic four-axis die supplies one
coordinate on each of `X`, `Y`, `Z`, and `W`.  The player chooses a two-axis
subspace plane; its coordinate sum is absorbed, while the complementary two
axes remain open.  The interrupted rank passes through that open plane, so a
full block is impossible.
-/

namespace Imba

/-- The six coordinate planes inside the four-axis defense space. -/
inductive Plane where
  | xy | xz | xw | yz | yw | zw
  deriving Repr, DecidableEq, BEq

def Plane.label : Plane → String
  | .xy => "XY"
  | .xz => "XZ"
  | .xw => "XW"
  | .yz => "YZ"
  | .yw => "YW"
  | .zw => "ZW"

def Plane.all : List Plane := [.xy, .xz, .xw, .yz, .yw, .zw]

/-- The two axes left open by a selected defense plane. -/
def Plane.complement : Plane → Plane
  | .xy => .zw
  | .xz => .yw
  | .xw => .yz
  | .yz => .xw
  | .yw => .xz
  | .zw => .xy

@[simp] theorem Plane.complement_involutive (plane : Plane) :
    plane.complement.complement = plane := by
  cases plane <;> decide

/-- One throw of a four-axis die.  Every coordinate is a conventional d6 face. -/
structure AxisRoll where
  x : Nat
  y : Nat
  z : Nat
  w : Nat
  deriving Repr, DecidableEq

/-- A reproducible d6 coordinate derived from the world and interruption data. -/
def axisFace (seed cycle interruptedRank salt : Nat) : Nat :=
  ((seed * 1664525 + cycle * 1013904223 + interruptedRank * 69069 +
    salt * 362437) % 6) + 1

theorem axisFace_positive (seed cycle interruptedRank salt : Nat) :
    0 < axisFace seed cycle interruptedRank salt := by
  simp [axisFace]

theorem axisFace_at_most_six (seed cycle interruptedRank salt : Nat) :
    axisFace seed cycle interruptedRank salt ≤ 6 := by
  unfold axisFace
  have h := Nat.mod_lt
    (seed * 1664525 + cycle * 1013904223 + interruptedRank * 69069 +
      salt * 362437) (by decide : 0 < 6)
  omega

/-- The authoritative multi-axis throw for one interruption. -/
def rollDefense (seed cycle interruptedRank : Nat) : AxisRoll :=
  {
    x := axisFace seed cycle interruptedRank 0
    y := axisFace seed cycle interruptedRank 1
    z := axisFace seed cycle interruptedRank 2
    w := axisFace seed cycle interruptedRank 3
  }

/-- Projection strength of the roll onto the selected two-axis subspace. -/
def planePower (roll : AxisRoll) : Plane → Nat
  | .xy => roll.x + roll.y
  | .xz => roll.x + roll.z
  | .xw => roll.x + roll.w
  | .yz => roll.y + roll.z
  | .yw => roll.y + roll.w
  | .zw => roll.z + roll.w

def complementPower (roll : AxisRoll) (plane : Plane) : Nat :=
  planePower roll plane.complement

def rollTotal (roll : AxisRoll) : Nat := roll.x + roll.y + roll.z + roll.w

/-- Nature's raw impact grows with the interrupted Imba rank. -/
def natureImpact (interruptedRank : Nat) (roll : AxisRoll) : Nat :=
  interruptedRank + rollTotal roll

/-- Damage remaining after projecting the defense onto a chosen plane. -/
def residualDamage (interruptedRank : Nat) (roll : AxisRoll) (plane : Plane) : Nat :=
  interruptedRank + complementPower roll plane

/-- The part of Nature's impact absorbed by the chosen plane. -/
def absorbedDamage (_interruptedRank : Nat) (roll : AxisRoll) (plane : Plane) : Nat :=
  planePower roll plane

/-- A complete block is impossible for every rank, throw, and plane. -/
theorem defense_conserves_impact (interruptedRank : Nat) (roll : AxisRoll)
    (plane : Plane) :
    absorbedDamage interruptedRank roll plane + residualDamage interruptedRank roll plane =
      natureImpact interruptedRank roll := by
  cases plane <;> simp [absorbedDamage, residualDamage, natureImpact,
    complementPower, Plane.complement, planePower, rollTotal] <;> omega

theorem full_block_impossible (seed cycle interruptedRank : Nat) (plane : Plane) :
    residualDamage interruptedRank (rollDefense seed cycle interruptedRank) plane ≠ 0 := by
  cases plane <;>
    simp [residualDamage, complementPower, Plane.complement, planePower,
      rollDefense, axisFace]

end Imba
