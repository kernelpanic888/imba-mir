import Std.Tactic

/-!
# Human spell construction

The onboarding spell is deliberately small: three readable choices compose a
typed candidate, while Lean alone decides APPEND, APPEND WITH COST, or HOLD.
The same file also records the interface-morphism core of an admitted Nadimba
step so presentation code never owns the transition law.
-/

namespace Imba

structure InterfaceMorphism
    (A B : Type)
    (I : A -> B -> Prop)
    (RA : A -> A -> Prop)
    (RB : B -> B -> Prop) where
  toFun : A -> B
  admissible : forall x, I x (toFun x)
  preserves : forall {x y}, RA x y -> RB (toFun x) (toFun y)

structure SpellState where
  identity : Nat
  rank : Nat
  certificate : Nat
  deriving Repr, DecidableEq

def nadimbaStep (state : SpellState) : SpellState :=
  { state with rank := state.rank + 1, certificate := state.certificate + 1 }

def NadimbaInterface (before after : SpellState) : Prop :=
  after.identity = before.identity /\
  after.rank = before.rank + 1 /\
  after.certificate = before.certificate + 1

def sameIdentity (left right : SpellState) : Prop :=
  left.identity = right.identity

def nadimbaMorphism : InterfaceMorphism
    SpellState SpellState NadimbaInterface sameIdentity sameIdentity where
  toFun := nadimbaStep
  admissible := by
    intro state
    simp [NadimbaInterface, nadimbaStep]
  preserves := by
    intro x y h
    simpa [sameIdentity, nadimbaStep] using h

theorem nadimba_preserves_identity (state : SpellState) :
    (nadimbaStep state).identity = state.identity := by
  rfl

theorem nadimba_extends_certificate (state : SpellState) :
    (nadimbaStep state).certificate = state.certificate + 1 := by
  rfl

structure SpellScore where
  force : Nat
  coherence : Nat
  resonance : Nat
  deriving Repr, DecidableEq

def SpellScore.add (left right : SpellScore) : SpellScore :=
  { force := left.force + right.force
    coherence := left.coherence + right.coherence
    resonance := left.resonance + right.resonance }

inductive SpellSource where
  | will
  | shadow
  | memory
  | spark
  deriving Repr, DecidableEq, BEq

inductive SpellIntent where
  | release
  | reveal
  | bind
  | invert
  deriving Repr, DecidableEq, BEq

inductive SpellPath where
  | road
  | echo
  | rift
  | orbit
  deriving Repr, DecidableEq, BEq

inductive SpellForm where
  | dormant
  | blade
  | veil
  | prism
  deriving Repr, DecidableEq, BEq

def SpellSource.label : SpellSource -> String
  | .will => "WILL"
  | .shadow => "SHADOW"
  | .memory => "MEMORY"
  | .spark => "SPARK"

def SpellSource.phrase : SpellSource -> String
  | .will => "Собери волю"
  | .shadow => "Извлеки тень"
  | .memory => "Вспомни прежнюю форму"
  | .spark => "Высеки живую искру"

def SpellIntent.label : SpellIntent -> String
  | .release => "RELEASE"
  | .reveal => "REVEAL"
  | .bind => "BIND"
  | .invert => "INVERT"

def SpellIntent.phrase : SpellIntent -> String
  | .release => "ослабь заклятие"
  | .reveal => "раскрой его закон"
  | .bind => "свяжи разрыв"
  | .invert => "обрати давление"

def SpellPath.label : SpellPath -> String
  | .road => "ROAD"
  | .echo => "ECHO"
  | .rift => "RIFT"
  | .orbit => "ORBIT"

def SpellPath.phrase : SpellPath -> String
  | .road => "проведи зелёной дорогой"
  | .echo => "верни изумрудным эхом"
  | .rift => "рассеки через разлом"
  | .orbit => "замкни по живой орбите"

def SpellForm.label : SpellForm -> String
  | .dormant => "DORMANT"
  | .blade => "BLADE"
  | .veil => "VEIL"
  | .prism => "PRISM"

def SpellForm.phrase : SpellForm -> String
  | .dormant => "без внешней формы"
  | .blade => "собери изумрудным лезвием"
  | .veil => "укрой теневым покровом"
  | .prism => "преломи живой призмой"

def sourceScore : SpellSource -> SpellScore
  | .will => { force := 2, coherence := 1, resonance := 0 }
  | .shadow => { force := 1, coherence := 2, resonance := 1 }
  | .memory => { force := 0, coherence := 2, resonance := 2 }
  | .spark => { force := 3, coherence := 0, resonance := 1 }

def intentScore : SpellIntent -> SpellScore
  | .release => { force := 2, coherence := 0, resonance := 1 }
  | .reveal => { force := 1, coherence := 2, resonance := 0 }
  | .bind => { force := 1, coherence := 2, resonance := 1 }
  | .invert => { force := 2, coherence := 1, resonance := 1 }

def pathScore : SpellPath -> SpellScore
  | .road => { force := 1, coherence := 1, resonance := 2 }
  | .echo => { force := 2, coherence := 1, resonance := 0 }
  | .rift => { force := 3, coherence := 0, resonance := 1 }
  | .orbit => { force := 0, coherence := 2, resonance := 2 }

def formScore : SpellForm -> SpellScore
  | .dormant => { force := 0, coherence := 0, resonance := 0 }
  | .blade => { force := 2, coherence := 0, resonance := 1 }
  | .veil => { force := 0, coherence := 2, resonance := 1 }
  | .prism => { force := 1, coherence := 1, resonance := 2 }

inductive SpellSynergy where
  | none
  | edgeway
  | umbra
  | revelation
  | remembrance
  | nova
  | riftblade
  deriving Repr, DecidableEq, BEq

def spellSynergy (source : SpellSource) (intent : SpellIntent)
    (path : SpellPath) (form : SpellForm) : SpellSynergy :=
  if form == .dormant then .none
  else if form == .veil && source == .memory && path == .echo then .remembrance
  else if form == .prism && source == .spark && path == .orbit then .nova
  else if form == .blade && intent == .invert && path == .rift then .riftblade
  else if form == .blade && path == .road then .edgeway
  else if form == .veil && source == .shadow then .umbra
  else if intent == .reveal && path == .echo then .revelation
  else .none

def SpellSynergy.label : SpellSynergy -> String
  | .none => "NONE"
  | .edgeway => "EDGEWAY"
  | .umbra => "UMBRA"
  | .revelation => "REVELATION"
  | .remembrance => "REMEMBRANCE"
  | .nova => "NOVA"
  | .riftblade => "RIFTBLADE"

def SpellSynergy.title : SpellSynergy -> String
  | .none => "Нет синергии"
  | .edgeway => "Лезвие дороги"
  | .umbra => "Сцепление с Тенью"
  | .revelation => "Эхо откровения"
  | .remembrance => "Память покрова"
  | .nova => "Изумрудная нова"
  | .riftblade => "Лезвие разлома"

def synergyScore : SpellSynergy -> SpellScore
  | .none => { force := 0, coherence := 0, resonance := 0 }
  | .edgeway => { force := 1, coherence := 1, resonance := 1 }
  | .umbra => { force := 1, coherence := 1, resonance := 1 }
  | .revelation => { force := 0, coherence := 1, resonance := 2 }
  | .remembrance => { force := 0, coherence := 2, resonance := 2 }
  | .nova => { force := 2, coherence := 0, resonance := 2 }
  | .riftblade => { force := 2, coherence := 1, resonance := 0 }

def metaAmplify (tier : Nat) (score : SpellScore) : SpellScore :=
  if tier == 0 then score else score.add score

def spellScore (source : SpellSource) (intent : SpellIntent)
    (path : SpellPath) (form : SpellForm) (metaTier : Nat) : SpellScore :=
  let synergy := spellSynergy source intent path form
  (sourceScore source).add
    ((intentScore intent).add
      ((pathScore path).add ((formScore form).add
        (metaAmplify metaTier (synergyScore synergy)))))

inductive SpellPressure where
  | force
  | coherence
  | resonance
  deriving Repr, DecidableEq, BEq

def SpellPressure.label : SpellPressure -> String
  | .force => "FORCE"
  | .coherence => "COHERENCE"
  | .resonance => "RESONANCE"

structure SpellLaw where
  forceNeed : Nat
  coherenceNeed : Nat
  resonanceNeed : Nat
  pressure : SpellPressure
  complexity : Nat
  formRequired : Bool
  synergyRequired : Bool
  metaTier : Nat
  lexiconVariant : Nat
  deriving Repr, DecidableEq

def spellLaw (identity cycle pendingTick rank certificate masteryMarks : Nat) : SpellLaw :=
  let advanced := 4 <= certificate
  let synergic := 8 <= certificate
  let metaTier := if 3 <= masteryMarks then 1 else 0
  { forceNeed := if synergic then 6 else if advanced then 5 else 4
    coherenceNeed := if synergic then 5 else if advanced then 4 else 3
    resonanceNeed := if synergic then 4 else if advanced then 3 else 2
    pressure := match (identity + cycle * 3 + pendingTick * 5 + rank * 7 + certificate) % 3 with
      | 0 => .force
      | 1 => .coherence
      | _ => .resonance
    complexity := if synergic then 3 else if advanced then 2 else 1
    formRequired := advanced
    synergyRequired := synergic
    metaTier := metaTier
    lexiconVariant := (identity + cycle * 3 + pendingTick * 5 + rank * 7 + certificate) % 4 }

def sourceIndex : SpellSource -> Nat
  | .will => 0
  | .shadow => 1
  | .memory => 2
  | .spark => 3

def intentIndex : SpellIntent -> Nat
  | .release => 0
  | .reveal => 1
  | .bind => 2
  | .invert => 3

def pathIndex : SpellPath -> Nat
  | .road => 0
  | .echo => 1
  | .rift => 2
  | .orbit => 3

def spellTermsAllowed (law : SpellLaw) (source : SpellSource)
    (intent : SpellIntent) (path : SpellPath) : Bool :=
  sourceIndex source != law.lexiconVariant % 4 &&
  intentIndex intent != (law.lexiconVariant + 1) % 4 &&
  pathIndex path != (law.lexiconVariant + 2) % 4

inductive SpellOutcome where
  | append
  | appendWithCost
  | hold
  deriving Repr, DecidableEq, BEq

def SpellOutcome.label : SpellOutcome -> String
  | .append => "APPEND"
  | .appendWithCost => "APPEND_WITH_COST"
  | .hold => "HOLD"

def deficit (need actual : Nat) : Nat := need - actual

def spellDeficit (law : SpellLaw) (score : SpellScore) : Nat :=
  deficit law.forceNeed score.force +
  deficit law.coherenceNeed score.coherence +
  deficit law.resonanceNeed score.resonance

def judgeSpell (law : SpellLaw) (source : SpellSource) (intent : SpellIntent)
    (path : SpellPath) (form : SpellForm) (synergy : SpellSynergy)
    (score : SpellScore) : SpellOutcome :=
  if !spellTermsAllowed law source intent path then
    .hold
  else if law.formRequired != (form != .dormant) then
    .hold
  else if law.synergyRequired && synergy == .none then
    .hold
  else if law.forceNeed <= score.force &&
      law.coherenceNeed <= score.coherence &&
      law.resonanceNeed <= score.resonance then
    .append
  else if spellDeficit law score == 1 then
    .appendWithCost
  else
    .hold

def spellCost (outcome : SpellOutcome) : Nat :=
  if outcome == .appendWithCost then 1 else 0

/-! ## Lean-owned reconstruction route

The guide may explain a route, but it never invents one in presentation code.
Lean searches the complete finite formula space, prefers the smallest number
of changed runes, and then prefers the lower declared tension consequence.
-/

structure SpellFormula where
  source : SpellSource
  intent : SpellIntent
  path : SpellPath
  form : SpellForm
  deriving Repr, DecidableEq, BEq

def SpellFormula.synergy (formula : SpellFormula) : SpellSynergy :=
  spellSynergy formula.source formula.intent formula.path formula.form

def SpellFormula.score (law : SpellLaw) (formula : SpellFormula) : SpellScore :=
  spellScore formula.source formula.intent formula.path formula.form law.metaTier

def SpellFormula.outcome (law : SpellLaw) (formula : SpellFormula) : SpellOutcome :=
  judgeSpell law formula.source formula.intent formula.path formula.form
    formula.synergy (formula.score law)

def spellFormulaDistance (left right : SpellFormula) : Nat :=
  (if left.source == right.source then 0 else 1) +
  (if left.intent == right.intent then 0 else 1) +
  (if left.path == right.path then 0 else 1) +
  (if left.form == right.form then 0 else 1)

def allSpellSources : List SpellSource := [.will, .shadow, .memory, .spark]
def allSpellIntents : List SpellIntent := [.release, .reveal, .bind, .invert]
def allSpellPaths : List SpellPath := [.road, .echo, .rift, .orbit]
def allSpellForms : List SpellForm := [.dormant, .blade, .veil, .prism]

def allSpellFormulas : List SpellFormula :=
  allSpellSources.flatMap fun source =>
    allSpellIntents.flatMap fun intent =>
      allSpellPaths.flatMap fun path =>
        allSpellForms.map fun form => { source, intent, path, form }

def repairTargetBetter (law : SpellLaw) (current candidate incumbent : SpellFormula) : Bool :=
  let candidateDistance := spellFormulaDistance current candidate
  let incumbentDistance := spellFormulaDistance current incumbent
  let candidateCost := spellCost (candidate.outcome law)
  let incumbentCost := spellCost (incumbent.outcome law)
  if candidateDistance < incumbentDistance then true
  else if incumbentDistance < candidateDistance then false
  else candidateCost < incumbentCost

def bestRepairTarget (law : SpellLaw) (current : SpellFormula) : Option SpellFormula :=
  let admitted := allSpellFormulas.filter fun candidate => candidate.outcome law != .hold
  admitted.foldl (fun best candidate =>
    match best with
    | none => some candidate
    | some incumbent =>
        if repairTargetBetter law current candidate incumbent then some candidate else best
  ) (none : Option SpellFormula)

structure SpellRepairPlan where
  current : SpellFormula
  target : SpellFormula
  replacements : Nat
  targetSynergy : SpellSynergy
  targetScore : SpellScore
  targetOutcome : SpellOutcome
  tensionCost : Nat
  deriving Repr, DecidableEq

def spellRepairPlan (law : SpellLaw) (current : SpellFormula) : Option SpellRepairPlan :=
  (bestRepairTarget law current).map fun target =>
    let outcome := target.outcome law
    { current
      target
      replacements := spellFormulaDistance current target
      targetSynergy := target.synergy
      targetScore := target.score law
      targetOutcome := outcome
      tensionCost := spellCost outcome }

theorem append_has_no_tension_consequence : spellCost .append = 0 := by decide

theorem appendWithCost_has_one_tension_consequence :
    spellCost .appendWithCost = 1 := by decide

theorem held_formula_has_no_state_transition_cost : spellCost .hold = 0 := by decide

example : judgeSpell (spellLaw 1 1 1 1 0 0) .shadow .release .echo .dormant .none
    (spellScore .shadow .release .echo .dormant 0) = .append := by native_decide

example : judgeSpell (spellLaw 2 1 1 1 0 0) .will .release .road .dormant .none
    (spellScore .will .release .road .dormant 0) = .appendWithCost := by native_decide

example : judgeSpell (spellLaw 2 1 1 1 0 0) .will .release .echo .dormant .none
    (spellScore .will .release .echo .dormant 0) = .hold := by native_decide

example : judgeSpell (spellLaw 2 1 5 5 4 0) .will .reveal .road .blade .edgeway
    (spellScore .will .reveal .road .blade 0) = .append := by native_decide

example : judgeSpell (spellLaw 1 1 5 5 4 0) .shadow .release .road .dormant .none
    (spellScore .shadow .release .road .dormant 0) = .hold := by native_decide

example : spellSynergy .shadow .release .echo .veil = .umbra := by native_decide

example : judgeSpell (spellLaw 2 1 9 9 8 3) .will .reveal .echo .blade .revelation
    (spellScore .will .reveal .echo .blade 1) = .append := by native_decide

example : spellSynergy .memory .release .echo .veil = .remembrance := by native_decide

example : spellSynergy .spark .bind .orbit .prism = .nova := by native_decide

example : spellSynergy .will .invert .rift .blade = .riftblade := by native_decide

example :
    let law := spellLaw 20260813 1 2 9 8 0
    let current : SpellFormula := ⟨.memory, .release, .echo, .veil⟩
    (spellRepairPlan law current).map (fun plan =>
      (plan.replacements, plan.target.source, plan.target.intent, plan.targetSynergy,
        plan.targetOutcome, plan.tensionCost)) =
      some (2, .spark, .reveal, .revelation, .append, 0) := by
  native_decide

end Imba
