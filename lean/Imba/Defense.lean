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

/-- Three player attitudes toward the same certified Nature impulse. -/
inductive DefenseMethod where
  | throw
  | anchor
  | rift
  deriving Repr, DecidableEq, BEq

def DefenseMethod.label : DefenseMethod → String
  | .throw => "THROW"
  | .anchor => "ANCHOR"
  | .rift => "RIFT"

def DefenseMethod.bit : DefenseMethod → Nat
  | .throw => 1
  | .anchor => 2
  | .rift => 4

def defenseMethodSeen (mask : Nat) : DefenseMethod → Bool
  | .throw => mask % 2 = 1
  | .anchor => (mask / 2) % 2 = 1
  | .rift => (mask / 4) % 2 = 1

/-- Chapter-II mastery is horizontal: each geometry contributes one bit once. -/
def recordDefenseMethod (mask : Nat) (method : DefenseMethod) : Nat :=
  let normalized := mask % 8
  if defenseMethodSeen normalized method then normalized
  else normalized + method.bit

def defenseMasteryComplete (mask : Nat) : Bool := mask % 8 = 7

/-- A life-balance criterion shared with the public scene. -/
def lifeBalance (ravenLife worldLife : Nat) : Nat :=
  let lower := min ravenLife worldLife
  let distance := max ravenLife worldLife - lower
  lower - distance / 2

def chapterTwoFinaleAllowed (masteryMask ravenLife worldLife : Nat) : Bool :=
  defenseMasteryComplete masteryMask &&
    decide (0 < ravenLife) && decide (0 < worldLife) &&
    decide (65 ≤ lifeBalance ravenLife worldLife)

theorem chapterTwoFinale_keeps_both_lives (masteryMask ravenLife worldLife : Nat)
    (h : chapterTwoFinaleAllowed masteryMask ravenLife worldLife = true) :
    0 < ravenLife ∧ 0 < worldLife := by
  simp [chapterTwoFinaleAllowed] at h
  exact ⟨h.1.1.2, h.1.2⟩

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

/-- Split a pair as evenly as possible without changing its sum. -/
def anchorLow (a b : Nat) : Nat := (a + b) / 2

def anchorHigh (a b : Nat) : Nat := a + b - anchorLow a b

/-- Anchor exchanges variance for a stable, nearly symmetric geometry. -/
def anchorRoll (roll : AxisRoll) : AxisRoll :=
  {
    x := anchorLow roll.x roll.y
    y := anchorHigh roll.x roll.y
    z := anchorLow roll.z roll.w
    w := anchorHigh roll.z roll.w
  }

/-- A rift concentrates each of two hidden pairs into one coordinate. -/
def riftRoll (roll : AxisRoll) : AxisRoll :=
  if (roll.x + roll.y + roll.z + roll.w) % 3 = 0 then
    { x := 1, y := roll.x + roll.y - 1, z := 1, w := roll.z + roll.w - 1 }
  else if (roll.x + roll.y + roll.z + roll.w) % 3 = 1 then
    { x := 1, y := 1, z := roll.x + roll.z - 1, w := roll.y + roll.w - 1 }
  else
    { x := 1, y := 1, z := roll.y + roll.z - 1, w := roll.x + roll.w - 1 }

def applyDefenseMethod : DefenseMethod → AxisRoll → AxisRoll
  | .throw => id
  | .anchor => anchorRoll
  | .rift => riftRoll

/-- Authoritative geometry for the selected defense attitude. -/
def defenseRoll (method : DefenseMethod) (seed cycle interruptedRank : Nat) : AxisRoll :=
  applyDefenseMethod method (rollDefense seed cycle interruptedRank)

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

theorem anchorRoll_preserves_total (roll : AxisRoll) :
    rollTotal (anchorRoll roll) = rollTotal roll := by
  simp [anchorRoll, rollTotal, anchorLow, anchorHigh]
  have hxy : (roll.x + roll.y) / 2 ≤ roll.x + roll.y := Nat.div_le_self _ _
  have hzw : (roll.z + roll.w) / 2 ≤ roll.z + roll.w := Nat.div_le_self _ _
  omega

theorem riftRoll_preserves_total (roll : AxisRoll)
    (hx : 0 < roll.x) (hy : 0 < roll.y) (hz : 0 < roll.z) (hw : 0 < roll.w) :
    rollTotal (riftRoll roll) = rollTotal roll := by
  by_cases h0 : (roll.x + roll.y + roll.z + roll.w) % 3 = 0
  · simp [riftRoll, h0, rollTotal]
    omega
  · by_cases h1 : (roll.x + roll.y + roll.z + roll.w) % 3 = 1
    · simp [riftRoll, h1, rollTotal]
      omega
    · simp [riftRoll, h0, h1, rollTotal]
      omega

theorem defenseRoll_preserves_total (method : DefenseMethod)
    (seed cycle interruptedRank : Nat) :
    rollTotal (defenseRoll method seed cycle interruptedRank) =
      rollTotal (rollDefense seed cycle interruptedRank) := by
  cases method with
  | throw => rfl
  | anchor => exact anchorRoll_preserves_total _
  | rift =>
      apply riftRoll_preserves_total
      all_goals simp [rollDefense, axisFace]

theorem anchorRoll_axes_positive (roll : AxisRoll)
    (hx : 0 < roll.x) (hy : 0 < roll.y) (hz : 0 < roll.z) (hw : 0 < roll.w) :
    0 < (anchorRoll roll).x ∧ 0 < (anchorRoll roll).y ∧
      0 < (anchorRoll roll).z ∧ 0 < (anchorRoll roll).w := by
  simp [anchorRoll, anchorLow, anchorHigh]
  omega

theorem riftRoll_axes_positive (roll : AxisRoll)
    (hx : 0 < roll.x) (hy : 0 < roll.y) (hz : 0 < roll.z) (hw : 0 < roll.w) :
    0 < (riftRoll roll).x ∧ 0 < (riftRoll roll).y ∧
      0 < (riftRoll roll).z ∧ 0 < (riftRoll roll).w := by
  by_cases h0 : (roll.x + roll.y + roll.z + roll.w) % 3 = 0
  · simp [riftRoll, h0]
    omega
  · by_cases h1 : (roll.x + roll.y + roll.z + roll.w) % 3 = 1
    · simp [riftRoll, h1]
      omega
    · simp [riftRoll, h0, h1]
      omega

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

theorem defenseRoll_axes_positive (method : DefenseMethod) (seed cycle interruptedRank : Nat) :
    0 < (defenseRoll method seed cycle interruptedRank).x ∧
    0 < (defenseRoll method seed cycle interruptedRank).y ∧
    0 < (defenseRoll method seed cycle interruptedRank).z ∧
    0 < (defenseRoll method seed cycle interruptedRank).w := by
  have hx := axisFace_positive seed cycle interruptedRank 0
  have hy := axisFace_positive seed cycle interruptedRank 1
  have hz := axisFace_positive seed cycle interruptedRank 2
  have hw := axisFace_positive seed cycle interruptedRank 3
  cases method with
  | throw => simpa [defenseRoll, applyDefenseMethod, rollDefense] using And.intro hx (And.intro hy (And.intro hz hw))
  | anchor =>
      exact anchorRoll_axes_positive _ hx hy hz hw
  | rift =>
      exact riftRoll_axes_positive _ hx hy hz hw

/-- No defense attitude can erase Nature completely. -/
theorem full_block_impossible_for_method (method : DefenseMethod)
    (seed cycle interruptedRank : Nat) (plane : Plane) :
    residualDamage interruptedRank (defenseRoll method seed cycle interruptedRank) plane ≠ 0 := by
  have h := defenseRoll_axes_positive method seed cycle interruptedRank
  rcases h with ⟨hx, hy, hz, hw⟩
  cases plane <;>
    simp [residualDamage, complementPower, Plane.complement, planePower] <;> omega

end Imba
