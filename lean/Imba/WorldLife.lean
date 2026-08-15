import Std.Tactic

/-!
# Imba: living World and compensatory response

The World is a finite living opponent.  A received hit first crosses the
current shield and then produces exactly one compensation event.  The event
class is stable while its form is selected deterministically from the World
identity and combat coordinates.  Short-term stabilization consumes reserve
or accumulates allostatic load; exhausted or chronically loaded Worlds can
overload instead of recovering.

This is an executable game model inspired by biological compensation.  It is
not a claim that the numerical state is a physical organism.
-/

namespace Imba

structure WorldVitals where
  maxLife : Nat := 100
  life : Nat := 100
  reserve : Nat := 30
  load : Nat := 0
  shield : Nat := 0
  deriving Repr, DecidableEq

def WorldVitals.normalize (v : WorldVitals) : WorldVitals :=
  { v with life := min v.life v.maxLife }

theorem normalized_life_bounded (v : WorldVitals) :
    v.normalize.life ≤ v.normalize.maxLife := by
  exact Nat.min_le_right v.life v.maxLife

inductive CompensationForm where
  | regeneration
  | barrier
  | redistribution
  | scar
  | overload
  deriving Repr, DecidableEq, BEq

def CompensationForm.label : CompensationForm → String
  | .regeneration => "REGENERATION"
  | .barrier => "BARRIER"
  | .redistribution => "REDISTRIBUTION"
  | .scar => "SCAR"
  | .overload => "OVERLOAD"

def CompensationForm.title : CompensationForm → String
  | .regeneration => "Регенеративный всплеск"
  | .barrier => "Адаптивный барьер"
  | .redistribution => "Перераспределение потока"
  | .scar => "Рубцовая броня"
  | .overload => "Аллостатическая перегрузка"

def worldEventPower (identity cycle epoch rawDamage : Nat) : Nat :=
  (identity * 17 + cycle * 31 + epoch * 13 + rawDamage * 7) % 6 + 1

theorem worldEventPower_positive (identity cycle epoch rawDamage : Nat) :
    0 < worldEventPower identity cycle epoch rawDamage := by
  simp [worldEventPower]

def compensationForm (identity cycle epoch rawDamage : Nat)
    (v : WorldVitals) : CompensationForm :=
  if 18 ≤ v.load || v.reserve == 0 then .overload
  else
    match (identity + cycle * 7 + epoch * 11 + rawDamage * 3) % 4 with
    | 0 => .regeneration
    | 1 => .barrier
    | 2 => .redistribution
    | _ => .scar

structure CompensationOutcome where
  eventClass : String
  form : CompensationForm
  power : Nat
  rawDamage : Nat
  absorbed : Nat
  directDamage : Nat
  healing : Nat
  reserveCost : Nat
  backlash : Nat
  before : WorldVitals
  after : WorldVitals
  deriving Repr, DecidableEq

private def candidateVitals (form : CompensationForm) (power : Nat)
    (before : WorldVitals) (baseLife remainingShield : Nat) :
    WorldVitals × Nat × Nat × Nat :=
  match form with
  | .regeneration =>
      let cost := min before.reserve power
      let healing := min (before.maxLife - baseLife) (power + cost)
      ({ before with
          life := baseLife + healing
          reserve := before.reserve - cost
          load := before.load + 2
          shield := remainingShield }, healing, cost, 0)
  | .barrier =>
      let cost := min before.reserve power
      ({ before with
          life := baseLife
          reserve := before.reserve - cost
          load := before.load + 1
          shield := remainingShield + power + 2 }, 0, cost, 0)
  | .redistribution =>
      ({ before with
          life := baseLife
          reserve := min 30 (before.reserve + power * 2)
          load := before.load + 1
          shield := remainingShield + power / 2 }, 0, 0, 0)
  | .scar =>
      let cost := min before.reserve (power + 1)
      let nextMax := before.maxLife - 1
      ({ maxLife := nextMax
         life := min baseLife nextMax
         reserve := before.reserve - cost
         load := before.load + 3
         shield := remainingShield + power * 2 }, 0, cost, 0)
  | .overload =>
      let backlash := power + before.load / 6
      ({ before with
          life := baseLife - backlash
          load := before.load + power
          shield := remainingShield }, 0, 0, backlash)

def resolveWorldHit (identity cycle epoch rawDamage : Nat)
    (before : WorldVitals) : CompensationOutcome :=
  let power := worldEventPower identity cycle epoch rawDamage
  let form := compensationForm identity cycle epoch rawDamage before
  let absorbed := min rawDamage before.shield
  let directDamage := rawDamage - absorbed
  let baseLife := before.life - directDamage
  let remainingShield := before.shield - absorbed
  let candidate := candidateVitals form power before baseLife remainingShield
  { eventClass := "COMPENSATION"
    form := form
    power := power
    rawDamage := rawDamage
    absorbed := absorbed
    directDamage := directDamage
    healing := candidate.2.1
    reserveCost := candidate.2.2.1
    backlash := candidate.2.2.2
    before := before
    after := candidate.1.normalize }

theorem resolved_life_bounded (identity cycle epoch rawDamage : Nat)
    (before : WorldVitals) :
    (resolveWorldHit identity cycle epoch rawDamage before).after.life ≤
      (resolveWorldHit identity cycle epoch rawDamage before).after.maxLife := by
  simp [resolveWorldHit]
  exact normalized_life_bounded _

theorem shield_never_amplifies_direct_damage (identity cycle epoch rawDamage : Nat)
    (before : WorldVitals) :
    (resolveWorldHit identity cycle epoch rawDamage before).directDamage ≤ rawDamage := by
  simp [resolveWorldHit]

end Imba
