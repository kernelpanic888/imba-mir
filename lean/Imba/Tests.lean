import Imba.Core
import Imba.BalanceCrisis
import Imba.Combat
import Imba.Defense
import Imba.Initiative
import Imba.Journey
import Imba.Living
import Imba.Progression
import Imba.Shadow
import Imba.Spell
import Imba.WorldLife
import Std.Tactic

example : Imba.stagedTick 4 = 5 := rfl
example : (Imba.stagedTick 4, 7).2 = 7 := rfl

namespace Imba.Tests

example (state : SpellState) :
    (nadimbaStep state).identity = state.identity :=
  nadimba_preserves_identity state

example (state : SpellState) :
    (nadimbaStep state).certificate = state.certificate + 1 :=
  nadimba_extends_certificate state

example (certificate : Nat) :
    min (roadBricks certificate) castleDistance + curseRemaining certificate = castleDistance :=
  road_and_curse_complete certificate

example : roadBricks 99 = 99 := by native_decide

example : firstChapterDistance ≤ castleDistance :=
  firstChapter_before_castle

example : worldTruthKnown 3 = false := by native_decide
example : worldTruthKnown 4 = true := by native_decide
example : ravenForm 4 = .worldMagus := by native_decide

example : combatAdmissible 4 900 5 900 = true := by decide
example : combatAdmissible 4 900 4 900 = false := by decide
example : combatAdmissible 4 900 5 901 = false := by decide
example (epoch head : Nat) : combatAdmissible epoch head (epoch + 1) head = true :=
  direct_reaction_admitted epoch head
example (current candidate head parent : Nat) (h : candidate ≤ current) :
    combatAdmissible current head candidate parent = false :=
  rollback_rejected head parent h

example : name 0 = "non-imba" := by decide
example : name 1 = "imba" := by decide
example : name 2 = "super-imba" := by decide
example : name 3 = "super-meta-imba" := by decide
example : name 6 = "super-meta-nano-quasi-ultra-imba" := by decide
example : name 7 = "super-meta-nano-quasi-ultra-tier-6-imba" := by decide

example : beatsBool 2 1 = true := by decide
example : beatsBool 1 2 = false := by decide
example : beatsBool 2 2 = false := by decide

example : fuse 4 4 = some 5 := by decide
example : fuse 4 3 = none := by decide
example : promote 4 2 = 6 := by decide

example : (rollDefense 20260813 1 3).x = 4 := by decide
example : planePower (rollDefense 20260813 1 3) .xy = 9 := by decide
example : residualDamage 3 (rollDefense 20260813 1 3) .xy = 10 := by decide
example (seed cycle rank : Nat) (plane : Plane) :
    residualDamage rank (rollDefense seed cycle rank) plane ≠ 0 :=
  full_block_impossible seed cycle rank plane
example (rank : Nat) (roll : AxisRoll) (plane : Plane) :
    absorbedDamage rank roll plane + residualDamage rank roll plane =
      natureImpact rank roll := defense_conserves_impact rank roll plane
example (method : DefenseMethod) (seed cycle rank : Nat) :
    rollTotal (defenseRoll method seed cycle rank) =
      rollTotal (rollDefense seed cycle rank) :=
  defenseRoll_preserves_total method seed cycle rank
example (method : DefenseMethod) (seed cycle rank : Nat) (plane : Plane) :
    residualDamage rank (defenseRoll method seed cycle rank) plane ≠ 0 :=
  full_block_impossible_for_method method seed cycle rank plane
example : recordDefenseMethod (recordDefenseMethod (recordDefenseMethod 0 .throw) .anchor) .rift = 7 := by decide
example : defenseMasteryComplete 7 = true := by decide
example : lifeBalance 100 100 = 100 := by decide
example : lifeBalance 70 100 = 55 := by decide
example : chapterTwoFinaleAllowed 7 100 100 = true := by decide
example : chapterTwoFinaleAllowed 3 100 100 = false := by decide
example : (recoverBalance .anchor 33 100).ravenLifeAfter = 90 := by decide
example : (recoverBalance .rewind 33 100).balanceAfter = 73 := by decide
example : (recoverBalance .shadow 33 100).restored = true := by decide
example (method : BalanceRecoveryMethod) (ravenLife worldLife : Nat) :
    ravenLife ≤ (recoverBalance method ravenLife worldLife).ravenLifeAfter ∧
      worldLife ≤ (recoverBalance method ravenLife worldLife).worldLifeAfter :=
  recoverBalance_does_not_harm method ravenLife worldLife

example : sessionTension 0 0 = 1 := by decide
example : carryTension 7 0 0 = 8 := by decide
example : firstStrikeAllowed 2 5 false = true := by decide
example : initiativeCapacity 2 5 3 false = 10 := by decide
example : initiativeCapacity 20 50 30 false = 12 := by decide
example : firstStrikeAllowed 2 5 true = false := by decide
example (previous ticks damage : Nat) :
    previous < carryTension previous ticks damage :=
  every_session_increases_tension previous ticks damage

example : reflectionDepth (rememberSession {} .xy 1 2) = 4 := by decide
example (memory : AxisMemory) (plane : Plane) (ticks damage : Nat) :
    memory.total < (rememberSession memory plane ticks damage).total :=
  every_session_grows_memory memory plane ticks damage
example (state : LivingState) (rank : Nat) :
    (admitTick state rank).identity = state.identity :=
  admitTick_preserves_identity state rank
example (state : LivingState) (rank : Nat) :
    CertifiedPrefix state.certificate (admitTick state rank).certificate :=
  admitTick_preserves_prefix state rank

example : visibleCut ([1, 2, 3, 4, 5] : List Nat) = [3, 4, 5] := by decide
example : shadowPrefix ([1, 2, 3, 4, 5] : List Nat) = [1, 2] := by decide
example (line : List Nat) : shadowPrefix line ++ visibleCut line = line :=
  shadow_cut_reconstructs line
example (line : List Nat) : (visibleCut line).length ≤ 3 :=
  visibleCut_at_most_three line
example (ledger : ShadowLedger) :
    (pureCreation ledger).manifested = ledger.manifested + 1 :=
  pure_creation_adds_one ledger
example (ledger : ShadowLedger) :
    (pureCreation ledger).relicOrder = ledger.relicOrder + 1 :=
  pure_creation_leaves_next_relic ledger
example (ledger : ShadowLedger) (amount : Nat) :
    (returnToShadow ledger amount).relicOrder = ledger.relicOrder + 1 :=
  return_leaves_next_relic ledger amount

example : worldEventPower 20260813 2 4 21 = 3 := by decide
example : (resolveWorldHit 20260813 2 4 21 {}).eventClass = "COMPENSATION" := by decide
example : (resolveWorldHit 20260813 2 4 21 {}).directDamage = 21 := by decide
example (identity cycle epoch damage : Nat) (vitals : WorldVitals) :
    (resolveWorldHit identity cycle epoch damage vitals).after.life ≤
      (resolveWorldHit identity cycle epoch damage vitals).after.maxLife :=
  resolved_life_bounded identity cycle epoch damage vitals
example (identity cycle epoch damage : Nat) (vitals : WorldVitals) :
    (resolveWorldHit identity cycle epoch damage vitals).directDamage ≤ damage :=
  shield_never_amplifies_direct_damage identity cycle epoch damage vitals

example : (resolveBalanceContact 12 0 {}).playerHealing = 0 := by decide
example :
    (resolveBalanceContact 12 30 { life := 90 }).playerHealing = 12 := by decide
example :
    (resolveBalanceContact 12 0 { life := 70 }).worldHealing = 12 := by decide
example (capacity playerDamage : Nat) (vitals : WorldVitals) :
    (resolveBalanceContact capacity playerDamage vitals).world.directDamage = 0 ∧
      (resolveBalanceContact capacity playerDamage vitals).world.backlash = 0 :=
  balance_contact_has_no_damage capacity playerDamage vitals

example : (observeProgress 0 0 0 .barrier).discoveryMask = 2 := by decide
example : (observeProgress 0 0 0 .barrier).masteryMarks = 1 := by decide
example : (observeProgress 2 0 1 .barrier).masteryMarks = 1 := by decide
example : (observeProgress 2 0 1 .barrier).pendingChoice = true := by decide
example : (unlockProtocol 2 0 1 .forecast).protocolMask = 1 := by decide
example : (unlockProtocol 2 1 1 .refraction).allowed = false := by decide
example (mask protocols marks : Nat) (form : CompensationForm) :
    mask ≤ (observeProgress mask protocols marks form).discoveryMask :=
  observation_never_rewrites_chronicle mask protocols marks form
example (mask protocols marks : Nat) (protocol : ProgressProtocol) :
    (unlockProtocol mask protocols marks protocol).masteryMarks = marks :=
  protocol_unlock_preserves_marks mask protocols marks protocol

example (rank : Rank) : ¬ Beats rank rank := beats_irreflexive rank
example (rank : Rank) : Beats (rank + 1) rank := no_maximum rank
example : ¬ ∃ maximum : Rank, ∀ candidate : Rank, ¬ Beats candidate maximum :=
  no_absolute_maximum

end Imba.Tests
