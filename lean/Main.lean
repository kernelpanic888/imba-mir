import Lean
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

open Lean

namespace Imba.Cli

private def jsonObject (fields : List (String × Json)) : Json :=
  Json.mkObj fields

private def success (fields : List (String × Json)) : Json :=
  jsonObject (("ok", toJson true) :: fields)

private def failure (message : String) : Json :=
  jsonObject [
    ("ok", toJson false),
    ("error", toJson message)
  ]

private def parseRank (text : String) : Option Imba.Rank := text.toNat?

private def parsePlane : String → Option Imba.Plane
  | "XY" | "xy" => some .xy
  | "XZ" | "xz" => some .xz
  | "XW" | "xw" => some .xw
  | "YZ" | "yz" => some .yz
  | "YW" | "yw" => some .yw
  | "ZW" | "zw" => some .zw
  | _ => none

private def parseDefenseMethod : String → Option Imba.DefenseMethod
  | "THROW" | "throw" => some .throw
  | "ANCHOR" | "anchor" => some .anchor
  | "RIFT" | "rift" => some .rift
  | _ => none

private def parseBalanceRecoveryMethod : String → Option Imba.BalanceRecoveryMethod
  | "ANCHOR" | "anchor" => some .anchor
  | "REWIND" | "rewind" => some .rewind
  | "SHADOW" | "shadow" => some .shadow
  | _ => none

private def parseCombatActor : String → Option Imba.CombatActor
  | "PLAYER" | "player" => some .player
  | "NATURE" | "nature" => some .nature
  | "WORLD" | "world" => some .world
  | _ => none

private def parseCombatKind : String → Option Imba.CombatKind
  | "ATTACK" | "attack" => some .attack
  | "REACTION" | "reaction" => some .reaction
  | _ => none

private def parseCompensationForm : String → Option Imba.CompensationForm
  | "REGENERATION" | "regeneration" => some .regeneration
  | "BARRIER" | "barrier" => some .barrier
  | "REDISTRIBUTION" | "redistribution" => some .redistribution
  | "SCAR" | "scar" => some .scar
  | "OVERLOAD" | "overload" => some .overload
  | _ => none

private def parseProgressProtocol : String → Option Imba.ProgressProtocol
  | "FORECAST" | "forecast" => some .forecast
  | "REFRACTION" | "refraction" => some .refraction
  | _ => none

private def parseSpellSource : String → Option Imba.SpellSource
  | "WILL" | "will" => some .will
  | "SHADOW" | "shadow" => some .shadow
  | "MEMORY" | "memory" => some .memory
  | "SPARK" | "spark" => some .spark
  | _ => none

private def parseSpellIntent : String → Option Imba.SpellIntent
  | "RELEASE" | "release" => some .release
  | "REVEAL" | "reveal" => some .reveal
  | "BIND" | "bind" => some .bind
  | "INVERT" | "invert" => some .invert
  | _ => none

private def parseSpellPath : String → Option Imba.SpellPath
  | "ROAD" | "road" => some .road
  | "ECHO" | "echo" => some .echo
  | "RIFT" | "rift" => some .rift
  | "ORBIT" | "orbit" => some .orbit
  | _ => none

private def parseSpellForm : String → Option Imba.SpellForm
  | "DORMANT" | "dormant" => some .dormant
  | "BLADE" | "blade" => some .blade
  | "VEIL" | "veil" => some .veil
  | "PRISM" | "prism" => some .prism
  | _ => none

private def beatsReason (result : Bool) : String :=
  if result then
    "attacker rank is strictly greater than defender rank"
  else
    "attacker rank is not strictly greater than defender rank"

private def emit (value : Json) (exitCode : UInt32 := 0) : IO UInt32 := do
  IO.println value.compress
  pure exitCode

private def invalidNatural (label : String) : IO UInt32 :=
  emit (failure (label ++ " must be a natural number")) 2

private def wrongArity (usage : String) : IO UInt32 :=
  emit (failure ("wrong number of arguments; usage: " ++ usage)) 2

private def runName (rankText : String) : IO UInt32 :=
  match parseRank rankText with
  | none => invalidNatural "rank"
  | some rank =>
      emit (success [
        ("op", toJson "name"),
        ("rank", toJson rank),
        ("name", toJson (Imba.name rank))
      ])

private def runBeats (attackerText defenderText : String) : IO UInt32 :=
  match parseRank attackerText with
  | none => invalidNatural "attacker"
  | some attacker =>
      match parseRank defenderText with
      | none => invalidNatural "defender"
      | some defender =>
          let result := Imba.beatsBool attacker defender
          emit (success [
            ("op", toJson "beats"),
            ("attacker", toJson attacker),
            ("defender", toJson defender),
            ("result", toJson result),
            ("reason", toJson (beatsReason result))
          ])

private def runFuse (leftText rightText : String) : IO UInt32 :=
  match parseRank leftText with
  | none => invalidNatural "left"
  | some left =>
      match parseRank rightText with
      | none => invalidNatural "right"
      | some right =>
          match Imba.fuse left right with
          | none =>
              emit (success [
                ("op", toJson "fuse"),
                ("left", toJson left),
                ("right", toJson right),
                ("allowed", toJson false),
                ("rank", Json.null),
                ("name", Json.null),
                ("reason", toJson "fusion requires equal ranks")
              ])
          | some result =>
              emit (success [
                ("op", toJson "fuse"),
                ("left", toJson left),
                ("right", toJson right),
                ("allowed", toJson true),
                ("rank", toJson result),
                ("name", toJson (Imba.name result)),
                ("reason", toJson "equal ranks fuse into their stronger successor")
              ])

private def runPromote (rankText deltaText : String) : IO UInt32 :=
  match parseRank rankText with
  | none => invalidNatural "rank"
  | some rank =>
      match parseRank deltaText with
      | none => invalidNatural "delta"
      | some delta =>
          let result := Imba.promote rank delta
          emit (success [
            ("op", toJson "promote"),
            ("rank", toJson rank),
            ("delta", toJson delta),
            ("result", toJson result),
            ("name", toJson (Imba.name result))
          ])

private def defenseFields (method : Imba.DefenseMethod) (seed cycle interruptedRank : Nat) :
    List (String × Json) :=
  let roll := Imba.defenseRoll method seed cycle interruptedRank
  [
    ("method", toJson method.label),
    ("seed", toJson seed),
    ("cycle", toJson cycle),
    ("interruptedRank", toJson interruptedRank),
    ("impact", toJson (Imba.natureImpact interruptedRank roll)),
    ("x", toJson roll.x),
    ("y", toJson roll.y),
    ("z", toJson roll.z),
    ("w", toJson roll.w),
    ("xy", toJson (Imba.planePower roll .xy)),
    ("xz", toJson (Imba.planePower roll .xz)),
    ("xw", toJson (Imba.planePower roll .xw)),
    ("yz", toJson (Imba.planePower roll .yz)),
    ("yw", toJson (Imba.planePower roll .yw)),
    ("zw", toJson (Imba.planePower roll .zw))
  ]

private def runDefenseRoll (seedText cycleText rankText methodText : String) : IO UInt32 :=
  match parseRank seedText with
  | none => invalidNatural "seed"
  | some seed =>
      match parseRank cycleText with
      | none => invalidNatural "cycle"
      | some cycle =>
          match parseRank rankText with
          | none => invalidNatural "interrupted rank"
          | some interruptedRank =>
              match parseDefenseMethod methodText with
              | none => emit (failure "method must be THROW, ANCHOR, or RIFT") 2
              | some method =>
                  emit (success (
                    ("op", toJson "defense-roll") ::
                    defenseFields method seed cycle interruptedRank))

private def runDefenseResolve (seedText cycleText rankText planeText methodText : String) :
    IO UInt32 :=
  match parseRank seedText with
  | none => invalidNatural "seed"
  | some seed =>
      match parseRank cycleText with
      | none => invalidNatural "cycle"
      | some cycle =>
          match parseRank rankText with
          | none => invalidNatural "interrupted rank"
          | some interruptedRank =>
              match parseDefenseMethod methodText, parsePlane planeText with
              | none, _ => emit (failure "method must be THROW, ANCHOR, or RIFT") 2
              | _, none => emit (failure "plane must be XY, XZ, XW, YZ, YW, or ZW") 2
              | some method, some plane =>
                  let roll := Imba.defenseRoll method seed cycle interruptedRank
                  let damage := Imba.residualDamage interruptedRank roll plane
                  emit (success (
                    ("op", toJson "defense-resolve") ::
                    defenseFields method seed cycle interruptedRank ++ [
                      ("plane", toJson plane.label),
                      ("planePower", toJson (Imba.planePower roll plane)),
                      ("complementPlane", toJson plane.complement.label),
                      ("complementPower", toJson (Imba.complementPower roll plane)),
                      ("absorbed", toJson (Imba.absorbedDamage interruptedRank roll plane)),
                      ("damage", toJson damage),
                      ("fullyBlocked", toJson (damage == 0)),
                      ("reason", toJson "selected geometry preserves Nature's impulse; chosen plane absorbs its axes; interrupted rank crosses the complementary plane")
                    ]))

private def runDefenseMastery (maskText methodText ravenLifeText worldLifeText : String) :
    IO UInt32 :=
  match parseRank maskText with
  | none => invalidNatural "defense mastery mask"
  | some mask =>
      match parseDefenseMethod methodText with
      | none => emit (failure "method must be THROW, ANCHOR, or RIFT") 2
      | some method =>
          match parseRank ravenLifeText with
          | none => invalidNatural "raven life"
          | some ravenLife =>
              match parseRank worldLifeText with
              | none => invalidNatural "world life"
              | some worldLife =>
                  let result := Imba.recordDefenseMethod mask method
                  let balance := Imba.lifeBalance ravenLife worldLife
                  emit (success [
                    ("op", toJson "defense-mastery"),
                    ("previousMask", toJson (mask % 8)),
                    ("method", toJson method.label),
                    ("masteryMask", toJson result),
                    ("throwSeen", toJson (Imba.defenseMethodSeen result .throw)),
                    ("anchorSeen", toJson (Imba.defenseMethodSeen result .anchor)),
                    ("riftSeen", toJson (Imba.defenseMethodSeen result .rift)),
                    ("mastered", toJson (Imba.defenseMasteryComplete result)),
                    ("ravenLife", toJson ravenLife),
                    ("worldLife", toJson worldLife),
                    ("balance", toJson balance),
                    ("balanceHeld", toJson (decide (65 ≤ balance))),
                    ("finaleAllowed", toJson (Imba.chapterTwoFinaleAllowed result ravenLife worldLife)),
                    ("status", toJson (if Imba.chapterTwoFinaleAllowed result ravenLife worldLife then
                      "KEEPER_OF_BALANCE" else "LEARNING_GEOMETRIES"))
                  ])

private def runBalanceRecovery (methodText ravenLifeText worldLifeText : String) :
    IO UInt32 :=
  match parseBalanceRecoveryMethod methodText with
  | none => emit (failure "method must be ANCHOR, REWIND, or SHADOW") 2
  | some method =>
      match parseRank ravenLifeText with
      | none => invalidNatural "raven life"
      | some ravenLife =>
          match parseRank worldLifeText with
          | none => invalidNatural "world life"
          | some worldLife =>
              let answer := Imba.recoverBalance method ravenLife worldLife
              emit (success [
                ("op", toJson "balance-recover"),
                ("method", toJson method.label),
                ("ravenLifeBefore", toJson answer.ravenLifeBefore),
                ("worldLifeBefore", toJson answer.worldLifeBefore),
                ("ravenLifeAfter", toJson answer.ravenLifeAfter),
                ("worldLifeAfter", toJson answer.worldLifeAfter),
                ("balanceBefore", toJson answer.balanceBefore),
                ("balanceAfter", toJson answer.balanceAfter),
                ("playerHealing", toJson answer.playerHealing),
                ("worldHealing", toJson answer.worldHealing),
                ("tensionCost", toJson answer.tensionCost),
                ("shadowCost", toJson answer.shadowCost),
                ("restored", toJson answer.restored),
                ("reason", toJson "the lower living side moves toward the higher one; the declared method cost remains as consequence")
              ])

private def runFirstStrike (ticksText tensionText reflectionText usedText : String) : IO UInt32 :=
  match parseRank ticksText with
  | none => invalidNatural "confirmed ticks"
  | some ticks =>
      match parseRank tensionText with
      | none => invalidNatural "previous tension"
      | some tension =>
          match parseRank reflectionText with
          | none => invalidNatural "reflection"
          | some reflection =>
              match parseRank usedText with
              | none => invalidNatural "already used"
              | some used =>
                  if used > 1 then
                    emit (failure "already used must be 0 or 1") 2
                  else
                    let alreadyUsed := used == 1
                    let allowed := Imba.firstStrikeAllowed ticks tension alreadyUsed
                    let capacity := Imba.initiativeCapacity ticks tension reflection alreadyUsed
                    emit (success [
                      ("op", toJson "first-strike"),
                      ("confirmedTicks", toJson ticks),
                      ("previousTension", toJson tension),
                      ("reflection", toJson reflection),
                      ("alreadyUsed", toJson alreadyUsed),
                      ("allowed", toJson allowed),
                      ("capacity", toJson capacity),
                      ("reason", toJson (if allowed then
                        "confirmed ticks open a bounded capacity to restore the lower life toward balance"
                      else
                        "initiative needs ticks, previous-session tension, and an unused contact"))
                    ])

private def runLivingAdmit (xText yText zText wText ticksText damageText planeText : String) : IO UInt32 :=
  match parseRank xText, parseRank yText, parseRank zText, parseRank wText,
      parseRank ticksText, parseRank damageText, parsePlane planeText with
  | some x, some y, some z, some w, some ticks, some damage, some plane =>
      let before : Imba.AxisMemory := { x := x, y := y, z := z, w := w }
      let after := Imba.rememberSession before plane ticks damage
      emit (success [
        ("op", toJson "living-admit"),
        ("x", toJson after.x), ("y", toJson after.y),
        ("z", toJson after.z), ("w", toJson after.w),
        ("charge", toJson (Imba.sessionTension ticks damage)),
        ("total", toJson after.total),
        ("reflection", toJson (Imba.reflectionDepth after)),
        ("complementPlane", toJson plane.complement.label),
        ("prefixGuard", toJson true),
        ("reason", toJson "session memory admitted; identity and certified prefix are preserved")
      ])
  | _, _, _, _, _, _, _ => emit (failure "living-admit expects naturals and a valid plane") 2

private def runCertificateAdmit (identityText certificateText currentText nextText : String) : IO UInt32 :=
  match parseRank identityText, parseRank certificateText,
      parseRank currentText, parseRank nextText with
  | some identity, some certificate, some current, some next =>
      let admitted := next == Imba.promote current 1
      emit (success [
        ("op", toJson "certificate-admit"),
        ("identity", toJson identity),
        ("certificate", toJson (if admitted then certificate + 1 else certificate)),
        ("rank", toJson next),
        ("admitted", toJson admitted),
        ("prefixGuard", toJson admitted),
        ("reason", toJson (if admitted then
          "one tick extends the certified prefix without rewriting it"
        else "candidate is not the next Imba rank"))
      ])
  | _, _, _, _ => emit (failure "certificate-admit expects natural numbers") 2

private def runTickStage (ticksText rankText certificateText : String) : IO UInt32 :=
  match parseRank ticksText, parseRank rankText, parseRank certificateText with
  | some ticks, some rank, some certificate =>
      emit (success [
        ("op", toJson "tick-stage"),
        ("currentTicks", toJson ticks),
        ("pendingTick", toJson (Imba.stagedTick ticks)),
        ("currentRank", toJson rank),
        ("heldRank", toJson rank),
        ("certificate", toJson certificate),
        ("heldCertificate", toJson certificate),
        ("transitioned", toJson false),
        ("reason", toJson "Lean staged exactly one pending tick; rank and certificate are held until confirmation")
      ])
  | _, _, _ => emit (failure "tick-stage expects natural numbers") 2

private def runCombatAdmit (identityText currentEpochText currentHeadText candidateEpochText
    parentHeadText actorText kindText payloadText : String) : IO UInt32 :=
  match parseRank identityText, parseRank currentEpochText, parseRank currentHeadText,
      parseRank candidateEpochText, parseRank parentHeadText, parseCombatActor actorText,
      parseCombatKind kindText, parseRank payloadText with
  | some identity, some currentEpoch, some currentHead, some candidateEpoch,
      some parentHead, some actor, some kind, some payload =>
      let admitted := Imba.combatAdmissible currentEpoch currentHead candidateEpoch parentHead
      let proposedHead := Imba.combatCommitment identity candidateEpoch parentHead actor kind payload
      let resultEpoch := Imba.admittedEpoch currentEpoch candidateEpoch parentHead currentHead
      let resultHead := Imba.admittedHead identity currentEpoch currentHead candidateEpoch parentHead
        actor kind payload
      emit (success [
        ("op", toJson "combat-admit"),
        ("identity", toJson identity),
        ("currentEpoch", toJson currentEpoch),
        ("currentHead", toJson currentHead),
        ("candidateEpoch", toJson candidateEpoch),
        ("parentHead", toJson parentHead),
        ("actor", toJson actor.label),
        ("kind", toJson kind.label),
        ("payload", toJson payload),
        ("proposedHead", toJson proposedHead),
        ("admitted", toJson admitted),
        ("resultEpoch", toJson resultEpoch),
        ("resultHead", toJson resultHead),
        ("verdict", toJson (if admitted then "APPEND" else "HOLD")),
        ("reason", toJson (if admitted then
          "candidate is the direct certified continuation of the observed combat head"
        else "rollback or parent mismatch rejected; combat head held unchanged"))
      ])
  | _, _, _, _, _, _, _, _ =>
      emit (failure "combat-admit expects naturals plus PLAYER|NATURE|WORLD and ATTACK|REACTION") 2

private def runTensionCarry (previousText ticksText damageText : String) : IO UInt32 :=
  match parseRank previousText with
  | none => invalidNatural "previous tension"
  | some previous =>
      match parseRank ticksText with
      | none => invalidNatural "confirmed ticks"
      | some ticks =>
          match parseRank damageText with
          | none => invalidNatural "nature damage"
          | some damage =>
              let gained := Imba.sessionTension ticks damage
              emit (success [
                ("op", toJson "tension-carry"),
                ("previousTension", toJson previous),
                ("confirmedTicks", toJson ticks),
                ("natureDamage", toJson damage),
                ("gained", toJson gained),
                ("result", toJson (Imba.carryTension previous ticks damage)),
                ("reason", toJson "every finished session adds ticks + nature damage + one base tension")
              ])

private def runWorldReact (identityText cycleText epochText lifeText maxLifeText
    reserveText loadText shieldText damageText : String) : IO UInt32 :=
  match parseRank identityText, parseRank cycleText, parseRank epochText,
      parseRank lifeText, parseRank maxLifeText, parseRank reserveText,
      parseRank loadText, parseRank shieldText, parseRank damageText with
  | some identity, some cycle, some epoch, some life, some maxLife,
      some reserve, some load, some shield, some damage =>
      let before : Imba.WorldVitals := {
        life := life, maxLife := maxLife, reserve := reserve,
        load := load, shield := shield
      }
      let answer := Imba.resolveWorldHit identity cycle epoch damage before
      emit (success [
        ("op", toJson "world-react"),
        ("identity", toJson identity),
        ("cycle", toJson cycle),
        ("epoch", toJson epoch),
        ("eventClass", toJson answer.eventClass),
        ("form", toJson answer.form.label),
        ("title", toJson answer.form.title),
        ("power", toJson answer.power),
        ("rawDamage", toJson answer.rawDamage),
        ("absorbed", toJson answer.absorbed),
        ("directDamage", toJson answer.directDamage),
        ("healing", toJson answer.healing),
        ("playerHealing", toJson 0),
        ("reserveCost", toJson answer.reserveCost),
        ("backlash", toJson answer.backlash),
        ("beforeLife", toJson answer.before.life),
        ("beforeMaxLife", toJson answer.before.maxLife),
        ("beforeReserve", toJson answer.before.reserve),
        ("beforeLoad", toJson answer.before.load),
        ("beforeShield", toJson answer.before.shield),
        ("life", toJson answer.after.life),
        ("maxLife", toJson answer.after.maxLife),
        ("reserve", toJson answer.after.reserve),
        ("load", toJson answer.after.load),
        ("shield", toJson answer.after.shield),
        ("reason", toJson "damage crossed the current shield; one seeded compensatory form stabilized the living World at an explicit cost")
      ])
  | _, _, _, _, _, _, _, _, _ =>
      emit (failure "world-react expects nine natural numbers") 2

private def runWorldBalance (identityText cycleText epochText lifeText maxLifeText
    reserveText loadText shieldText capacityText playerDamageText : String) : IO UInt32 :=
  match parseRank identityText, parseRank cycleText, parseRank epochText,
      parseRank lifeText, parseRank maxLifeText, parseRank reserveText,
      parseRank loadText, parseRank shieldText, parseRank capacityText,
      parseRank playerDamageText with
  | some identity, some cycle, some epoch, some life, some maxLife,
      some reserve, some load, some shield, some capacity, some playerDamage =>
      let before : Imba.WorldVitals := {
        life := life, maxLife := maxLife, reserve := reserve,
        load := load, shield := shield
      }
      let balance := Imba.resolveBalanceContact capacity playerDamage before
      let answer := balance.world
      emit (success [
        ("op", toJson "world-balance"),
        ("identity", toJson identity),
        ("cycle", toJson cycle),
        ("epoch", toJson epoch),
        ("eventClass", toJson answer.eventClass),
        ("form", toJson answer.form.label),
        ("title", toJson "Балансирующий отклик"),
        ("power", toJson answer.power),
        ("capacity", toJson balance.capacity),
        ("rawDamage", toJson answer.rawDamage),
        ("absorbed", toJson answer.absorbed),
        ("directDamage", toJson answer.directDamage),
        ("healing", toJson answer.healing),
        ("playerDamageBefore", toJson balance.playerDamageBefore),
        ("playerLifeBefore", toJson balance.playerLifeBefore),
        ("playerHealing", toJson balance.playerHealing),
        ("playerDamageAfter", toJson balance.playerDamageAfter),
        ("playerLifeAfter", toJson balance.playerLifeAfter),
        ("reserveCost", toJson answer.reserveCost),
        ("backlash", toJson answer.backlash),
        ("beforeLife", toJson answer.before.life),
        ("beforeMaxLife", toJson answer.before.maxLife),
        ("beforeReserve", toJson answer.before.reserve),
        ("beforeLoad", toJson answer.before.load),
        ("beforeShield", toJson answer.before.shield),
        ("life", toJson answer.after.life),
        ("maxLife", toJson answer.after.maxLife),
        ("reserve", toJson answer.after.reserve),
        ("load", toJson answer.after.load),
        ("shield", toJson answer.after.shield),
        ("reason", toJson "initiative restores only the lower life toward the higher; neither side loses life")
      ])
  | _, _, _, _, _, _, _, _, _, _ =>
      emit (failure "world-balance expects ten natural numbers") 2

private def runProgressObserve (discoveryText protocolText marksText formText : String) : IO UInt32 :=
  match parseRank discoveryText, parseRank protocolText, parseRank marksText,
      parseCompensationForm formText with
  | some discoveryMask, some protocolMask, some marks, some form =>
      let answer := Imba.observeProgress discoveryMask protocolMask marks form
      emit (success [
        ("op", toJson "progress-observe"),
        ("form", toJson form.label),
        ("discoveryMask", toJson answer.discoveryMask),
        ("protocolMask", toJson answer.protocolMask),
        ("masteryMarks", toJson answer.masteryMarks),
        ("newDiscovery", toJson answer.newDiscovery),
        ("pendingChoice", toJson answer.pendingChoice),
        ("reason", toJson (if answer.newDiscovery then
          "a previously unseen compensatory form extended the Chronicle"
        else "the known form was observed again without duplicating its discovery reward"))
      ])
  | _, _, _, _ => emit (failure "progress-observe expects three naturals and a compensation form") 2

private def runProgressUnlock (discoveryText protocolText marksText choiceText : String) : IO UInt32 :=
  match parseRank discoveryText, parseRank protocolText, parseRank marksText,
      parseProgressProtocol choiceText with
  | some discoveryMask, some protocolMask, some marks, some protocol =>
      let answer := Imba.unlockProtocol discoveryMask protocolMask marks protocol
      emit (success [
        ("op", toJson "progress-unlock"),
        ("protocol", toJson protocol.label),
        ("protocolTitle", toJson protocol.title),
        ("discoveryMask", toJson answer.discoveryMask),
        ("protocolMask", toJson answer.protocolMask),
        ("masteryMarks", toJson answer.masteryMarks),
        ("allowed", toJson answer.allowed),
        ("pendingChoice", toJson answer.pendingChoice),
        ("reason", toJson (if answer.allowed then
          "the first Chronicle discovery admitted one horizontal information protocol"
        else "protocol choice requires a discovery and an empty protocol slot"))
      ])
  | _, _, _, _ => emit (failure "progress-unlock expects three naturals and FORECAST|REFRACTION") 2

private def spellLawFields (identity cycle pendingTick rank certificate masteryMarks : Nat) :
    List (String × Json) :=
  let law := Imba.spellLaw identity cycle pendingTick rank certificate masteryMarks
  let will := Imba.sourceScore .will
  let shadow := Imba.sourceScore .shadow
  let memory := Imba.sourceScore .memory
  let spark := Imba.sourceScore .spark
  let release := Imba.intentScore .release
  let reveal := Imba.intentScore .reveal
  let bind := Imba.intentScore .bind
  let invert := Imba.intentScore .invert
  let road := Imba.pathScore .road
  let echo := Imba.pathScore .echo
  let rift := Imba.pathScore .rift
  let orbit := Imba.pathScore .orbit
  let blade := Imba.formScore .blade
  let veil := Imba.formScore .veil
  let prism := Imba.formScore .prism
  let edgeway := Imba.synergyScore .edgeway
  let umbra := Imba.synergyScore .umbra
  let revelation := Imba.synergyScore .revelation
  let remembrance := Imba.synergyScore .remembrance
  let nova := Imba.synergyScore .nova
  let riftblade := Imba.synergyScore .riftblade
  [
    ("identity", toJson identity),
    ("cycle", toJson cycle),
    ("pendingTick", toJson pendingTick),
    ("rank", toJson rank),
    ("certificate", toJson certificate),
    ("masteryMarks", toJson masteryMarks),
    ("forceNeed", toJson law.forceNeed),
    ("coherenceNeed", toJson law.coherenceNeed),
    ("resonanceNeed", toJson law.resonanceNeed),
    ("pressure", toJson law.pressure.label),
    ("complexity", toJson law.complexity),
    ("formRequired", toJson law.formRequired),
    ("synergyRequired", toJson law.synergyRequired),
    ("metaTier", toJson law.metaTier),
    ("lexiconVariant", toJson law.lexiconVariant),
    ("willPhrase", toJson Imba.SpellSource.will.phrase),
    ("willForce", toJson will.force),
    ("willCoherence", toJson will.coherence),
    ("willResonance", toJson will.resonance),
    ("shadowPhrase", toJson Imba.SpellSource.shadow.phrase),
    ("shadowForce", toJson shadow.force),
    ("shadowCoherence", toJson shadow.coherence),
    ("shadowResonance", toJson shadow.resonance),
    ("memoryPhrase", toJson Imba.SpellSource.memory.phrase),
    ("memoryForce", toJson memory.force),
    ("memoryCoherence", toJson memory.coherence),
    ("memoryResonance", toJson memory.resonance),
    ("sparkPhrase", toJson Imba.SpellSource.spark.phrase),
    ("sparkForce", toJson spark.force),
    ("sparkCoherence", toJson spark.coherence),
    ("sparkResonance", toJson spark.resonance),
    ("releasePhrase", toJson Imba.SpellIntent.release.phrase),
    ("releaseForce", toJson release.force),
    ("releaseCoherence", toJson release.coherence),
    ("releaseResonance", toJson release.resonance),
    ("revealPhrase", toJson Imba.SpellIntent.reveal.phrase),
    ("revealForce", toJson reveal.force),
    ("revealCoherence", toJson reveal.coherence),
    ("revealResonance", toJson reveal.resonance),
    ("bindPhrase", toJson Imba.SpellIntent.bind.phrase),
    ("bindForce", toJson bind.force),
    ("bindCoherence", toJson bind.coherence),
    ("bindResonance", toJson bind.resonance),
    ("invertPhrase", toJson Imba.SpellIntent.invert.phrase),
    ("invertForce", toJson invert.force),
    ("invertCoherence", toJson invert.coherence),
    ("invertResonance", toJson invert.resonance),
    ("roadPhrase", toJson Imba.SpellPath.road.phrase),
    ("roadForce", toJson road.force),
    ("roadCoherence", toJson road.coherence),
    ("roadResonance", toJson road.resonance),
    ("echoPhrase", toJson Imba.SpellPath.echo.phrase),
    ("echoForce", toJson echo.force),
    ("echoCoherence", toJson echo.coherence),
    ("echoResonance", toJson echo.resonance),
    ("riftPhrase", toJson Imba.SpellPath.rift.phrase),
    ("riftForce", toJson rift.force),
    ("riftCoherence", toJson rift.coherence),
    ("riftResonance", toJson rift.resonance),
    ("orbitPhrase", toJson Imba.SpellPath.orbit.phrase),
    ("orbitForce", toJson orbit.force),
    ("orbitCoherence", toJson orbit.coherence),
    ("orbitResonance", toJson orbit.resonance),
    ("bladePhrase", toJson Imba.SpellForm.blade.phrase),
    ("bladeForce", toJson blade.force),
    ("bladeCoherence", toJson blade.coherence),
    ("bladeResonance", toJson blade.resonance),
    ("veilPhrase", toJson Imba.SpellForm.veil.phrase),
    ("veilForce", toJson veil.force),
    ("veilCoherence", toJson veil.coherence),
    ("veilResonance", toJson veil.resonance),
    ("prismPhrase", toJson Imba.SpellForm.prism.phrase),
    ("prismForce", toJson prism.force),
    ("prismCoherence", toJson prism.coherence),
    ("prismResonance", toJson prism.resonance),
    ("edgewayTitle", toJson Imba.SpellSynergy.edgeway.title),
    ("edgewayForce", toJson edgeway.force),
    ("edgewayCoherence", toJson edgeway.coherence),
    ("edgewayResonance", toJson edgeway.resonance),
    ("umbraTitle", toJson Imba.SpellSynergy.umbra.title),
    ("umbraForce", toJson umbra.force),
    ("umbraCoherence", toJson umbra.coherence),
    ("umbraResonance", toJson umbra.resonance),
    ("revelationTitle", toJson Imba.SpellSynergy.revelation.title),
    ("revelationForce", toJson revelation.force),
    ("revelationCoherence", toJson revelation.coherence),
    ("revelationResonance", toJson revelation.resonance),
    ("remembranceTitle", toJson Imba.SpellSynergy.remembrance.title),
    ("remembranceForce", toJson remembrance.force),
    ("remembranceCoherence", toJson remembrance.coherence),
    ("remembranceResonance", toJson remembrance.resonance),
    ("novaTitle", toJson Imba.SpellSynergy.nova.title),
    ("novaForce", toJson nova.force),
    ("novaCoherence", toJson nova.coherence),
    ("novaResonance", toJson nova.resonance),
    ("riftbladeTitle", toJson Imba.SpellSynergy.riftblade.title),
    ("riftbladeForce", toJson riftblade.force),
    ("riftbladeCoherence", toJson riftblade.coherence),
    ("riftbladeResonance", toJson riftblade.resonance)
  ]

private def runSpellLaw (identityText cycleText tickText rankText certificateText marksText : String) :
    IO UInt32 :=
  match parseRank identityText, parseRank cycleText, parseRank tickText,
      parseRank rankText, parseRank certificateText, parseRank marksText with
  | some identity, some cycle, some pendingTick, some rank, some certificate, some masteryMarks =>
      emit (success (("op", toJson "spell-law") ::
        spellLawFields identity cycle pendingTick rank certificate masteryMarks))
  | _, _, _, _, _, _ => emit (failure "spell-law expects six naturals") 2

private def runSpellCast (identityText cycleText tickText rankText certificateText
    marksText sourceText intentText pathText formText : String) : IO UInt32 :=
  match parseRank identityText, parseRank cycleText, parseRank tickText,
      parseRank rankText, parseRank certificateText, parseRank marksText,
      parseSpellSource sourceText, parseSpellIntent intentText,
      parseSpellPath pathText, parseSpellForm formText with
  | some identity, some cycle, some pendingTick, some rank, some certificate,
      some masteryMarks, some source, some intent, some path, some form =>
      let law := Imba.spellLaw identity cycle pendingTick rank certificate masteryMarks
      let synergy := Imba.spellSynergy source intent path form
      let baseSynergy := Imba.synergyScore synergy
      let score := Imba.spellScore source intent path form law.metaTier
      let outcome := Imba.judgeSpell law source intent path form synergy score
      let admitted := outcome != .hold
      emit (success (
        ("op", toJson "spell-cast") ::
        spellLawFields identity cycle pendingTick rank certificate masteryMarks ++ [
          ("source", toJson source.label),
          ("sourcePhrase", toJson source.phrase),
          ("intent", toJson intent.label),
          ("intentPhrase", toJson intent.phrase),
          ("path", toJson path.label),
          ("pathPhrase", toJson path.phrase),
          ("form", toJson form.label),
          ("formPhrase", toJson form.phrase),
          ("synergy", toJson synergy.label),
          ("synergyTitle", toJson synergy.title),
          ("synergyForce", toJson baseSynergy.force),
          ("synergyCoherence", toJson baseSynergy.coherence),
          ("synergyResonance", toJson baseSynergy.resonance),
          ("force", toJson score.force),
          ("coherence", toJson score.coherence),
          ("resonance", toJson score.resonance),
          ("forceOk", toJson (decide (law.forceNeed <= score.force))),
          ("coherenceOk", toJson (decide (law.coherenceNeed <= score.coherence))),
          ("resonanceOk", toJson (decide (law.resonanceNeed <= score.resonance))),
          ("outcome", toJson outcome.label),
          ("admitted", toJson admitted),
          ("cost", toJson (Imba.spellCost outcome)),
          ("preservesIdentity", toJson admitted),
          ("extendsCertificate", toJson admitted),
          ("reason", toJson (match outcome with
            | .append => "the interface morphism satisfies goal, budget, and preserved identity"
            | .appendWithCost => "the interface morphism is admissible with one declared tension cost"
            | .hold => "the candidate misses more than one required invariant; authoritative state is held"))
        ]))
  | _, _, _, _, _, _, _, _, _, _ =>
      emit (failure "spell-cast expects six naturals and a typed SOURCE INTENT PATH FORM") 2

private def runSpellRepair (identityText cycleText tickText rankText certificateText
    marksText sourceText intentText pathText formText : String) : IO UInt32 :=
  match parseRank identityText, parseRank cycleText, parseRank tickText,
      parseRank rankText, parseRank certificateText, parseRank marksText,
      parseSpellSource sourceText, parseSpellIntent intentText,
      parseSpellPath pathText, parseSpellForm formText with
  | some identity, some cycle, some pendingTick, some rank, some certificate,
      some masteryMarks, some source, some intent, some path, some form =>
      let law := Imba.spellLaw identity cycle pendingTick rank certificate masteryMarks
      let current : Imba.SpellFormula := { source, intent, path, form }
      match Imba.spellRepairPlan law current with
      | none => emit (failure "no admitted reconstruction exists inside the current spell interface") 2
      | some plan =>
          emit (success [
            ("op", toJson "spell-repair"),
            ("identity", toJson identity),
            ("cycle", toJson cycle),
            ("pendingTick", toJson pendingTick),
            ("rank", toJson rank),
            ("certificate", toJson certificate),
            ("masteryMarks", toJson masteryMarks),
            ("currentSource", toJson source.label),
            ("currentIntent", toJson intent.label),
            ("currentPath", toJson path.label),
            ("currentForm", toJson form.label),
            ("targetSource", toJson plan.target.source.label),
            ("targetSourcePhrase", toJson plan.target.source.phrase),
            ("targetIntent", toJson plan.target.intent.label),
            ("targetIntentPhrase", toJson plan.target.intent.phrase),
            ("targetPath", toJson plan.target.path.label),
            ("targetPathPhrase", toJson plan.target.path.phrase),
            ("targetForm", toJson plan.target.form.label),
            ("targetFormPhrase", toJson plan.target.form.phrase),
            ("targetSynergy", toJson plan.targetSynergy.label),
            ("targetSynergyTitle", toJson plan.targetSynergy.title),
            ("targetForce", toJson plan.targetScore.force),
            ("targetCoherence", toJson plan.targetScore.coherence),
            ("targetResonance", toJson plan.targetScore.resonance),
            ("targetOutcome", toJson plan.targetOutcome.label),
            ("replacements", toJson plan.replacements),
            ("tensionCost", toJson plan.tensionCost),
            ("changeSource", toJson (source != plan.target.source)),
            ("changeIntent", toJson (intent != plan.target.intent)),
            ("changePath", toJson (path != plan.target.path)),
            ("changeForm", toJson (form != plan.target.form)),
            ("consequence", toJson (if plan.tensionCost = 0 then
              "route step: formula draft only; target confirmation: rank +1; certificate +1; tension unchanged"
              else "route step: formula draft only; target confirmation: rank +1; certificate +1; tension +1")),
            ("reason", toJson "Lean exhaustively searched the finite rune interface; minimum replacements win, then minimum declared tension")
          ])
  | _, _, _, _, _, _, _, _, _, _ =>
      emit (failure "spell-repair expects six naturals and a typed SOURCE INTENT PATH FORM") 2

private def runJourney (identityText certificateText : String) : IO UInt32 :=
  match parseRank identityText, parseRank certificateText with
  | some identity, some certificate =>
      let bricks := Imba.roadBricks certificate
      let trouble := Imba.troubleAt identity bricks
      emit (success [
        ("op", toJson "journey"),
        ("identity", toJson identity),
        ("certificate", toJson certificate),
        ("roadBricks", toJson bricks),
        ("castleDistance", toJson Imba.castleDistance),
        ("curseRemaining", toJson (Imba.curseRemaining certificate)),
        ("chapter", toJson (Imba.journeyChapter bricks)),
        ("castleReached", toJson (decide (Imba.castleDistance <= bricks))),
        ("firstChapterDistance", toJson Imba.firstChapterDistance),
        ("worldTruthKnown", toJson (Imba.worldTruthKnown bricks)),
        ("ravenForm", toJson (Imba.ravenForm bricks).label),
        ("ravenFormTitle", toJson (Imba.ravenForm bricks).title),
        ("chapterConflict", toJson (Imba.chapterConflict bricks)),
        ("revelation", toJson Imba.worldRevelation),
        ("troubleActive", toJson trouble.isSome),
        ("trouble", toJson (trouble.map Imba.WizardTrouble.label |>.getD "NONE")),
        ("troubleTitle", toJson (trouble.map Imba.WizardTrouble.title |>.getD "Замок наблюдает")),
        ("troubleCopy", toJson (trouble.map Imba.WizardTrouble.copy |>.getD
          "Заклятие ещё цело. Первый доказанный переход превратит его фрагмент в дорогу.")),
        ("troublePower", toJson (Imba.troublePower identity bricks)),
        ("reason", toJson "road steps are the unbounded monotone Lean certificate; castle distance is only a story threshold")
      ])
  | _, _ => emit (failure "journey expects identity and certificate naturals") 2

def run (args : List String) : IO UInt32 :=
  match args with
  | ["ping"] =>
      emit (success [
        ("op", toJson "ping"),
        ("version", toJson "0.1")
      ])
  | ["name", rank] => runName rank
  | "name" :: _ => wrongArity "imba-core name <rank>"
  | ["beats", attacker, defender] => runBeats attacker defender
  | "beats" :: _ => wrongArity "imba-core beats <attacker> <defender>"
  | ["fuse", left, right] => runFuse left right
  | "fuse" :: _ => wrongArity "imba-core fuse <left> <right>"
  | ["promote", rank, delta] => runPromote rank delta
  | "promote" :: _ => wrongArity "imba-core promote <rank> <delta>"
  | ["defense-roll", seed, cycle, rank] => runDefenseRoll seed cycle rank "THROW"
  | ["defense-roll", seed, cycle, rank, method] => runDefenseRoll seed cycle rank method
  | "defense-roll" :: _ => wrongArity "imba-core defense-roll <seed> <cycle> <interrupted-rank> [THROW|ANCHOR|RIFT]"
  | ["defense-resolve", seed, cycle, rank, plane] =>
      runDefenseResolve seed cycle rank plane "THROW"
  | ["defense-resolve", seed, cycle, rank, plane, method] =>
      runDefenseResolve seed cycle rank plane method
  | "defense-resolve" :: _ => wrongArity
      "imba-core defense-resolve <seed> <cycle> <interrupted-rank> <plane> [THROW|ANCHOR|RIFT]"
  | ["defense-mastery", mask, method, ravenLife, worldLife] =>
      runDefenseMastery mask method ravenLife worldLife
  | "defense-mastery" :: _ => wrongArity
      "imba-core defense-mastery <mask> <THROW|ANCHOR|RIFT> <raven-life> <world-life>"
  | ["balance-recover", method, ravenLife, worldLife] =>
      runBalanceRecovery method ravenLife worldLife
  | "balance-recover" :: _ => wrongArity
      "imba-core balance-recover <ANCHOR|REWIND|SHADOW> <raven-life> <world-life>"
  | ["first-strike", ticks, tension, reflection, used] =>
      runFirstStrike ticks tension reflection used
  | "first-strike" :: _ => wrongArity
      "imba-core first-strike <confirmed-ticks> <previous-tension> <reflection> <already-used:0|1>"
  | ["tension-carry", previous, ticks, damage] =>
      runTensionCarry previous ticks damage
  | "tension-carry" :: _ => wrongArity
      "imba-core tension-carry <previous-tension> <confirmed-ticks> <nature-damage>"
  | ["living-admit", x, y, z, w, ticks, damage, plane] =>
      runLivingAdmit x y z w ticks damage plane
  | "living-admit" :: _ => wrongArity
      "imba-core living-admit <x> <y> <z> <w> <ticks> <damage> <plane>"
  | ["certificate-admit", identity, certificate, current, next] =>
      runCertificateAdmit identity certificate current next
  | "certificate-admit" :: _ => wrongArity
      "imba-core certificate-admit <identity> <certificate> <current-rank> <next-rank>"
  | ["tick-stage", ticks, rank, certificate] =>
      runTickStage ticks rank certificate
  | "tick-stage" :: _ => wrongArity
      "imba-core tick-stage <confirmed-ticks> <current-rank> <certificate>"
  | ["combat-admit", identity, currentEpoch, currentHead, candidateEpoch,
      parentHead, actor, kind, payload] =>
      runCombatAdmit identity currentEpoch currentHead candidateEpoch parentHead actor kind payload
  | "combat-admit" :: _ => wrongArity
      "imba-core combat-admit <identity> <current-epoch> <current-head> <candidate-epoch> <parent-head> <actor> <kind> <payload>"
  | ["world-react", identity, cycle, epoch, life, maxLife, reserve, load, shield, damage] =>
      runWorldReact identity cycle epoch life maxLife reserve load shield damage
  | "world-react" :: _ => wrongArity
      "imba-core world-react <identity> <cycle> <epoch> <life> <max-life> <reserve> <load> <shield> <damage>"
  | ["world-balance", identity, cycle, epoch, life, maxLife, reserve, load, shield,
      capacity, playerDamage] =>
      runWorldBalance identity cycle epoch life maxLife reserve load shield capacity playerDamage
  | "world-balance" :: _ => wrongArity
      "imba-core world-balance <identity> <cycle> <epoch> <life> <max-life> <reserve> <load> <shield> <capacity> <player-damage>"
  | ["progress-observe", discoveries, protocols, marks, form] =>
      runProgressObserve discoveries protocols marks form
  | "progress-observe" :: _ => wrongArity
      "imba-core progress-observe <discovery-mask> <protocol-mask> <mastery-marks> <form>"
  | ["progress-unlock", discoveries, protocols, marks, choice] =>
      runProgressUnlock discoveries protocols marks choice
  | "progress-unlock" :: _ => wrongArity
      "imba-core progress-unlock <discovery-mask> <protocol-mask> <mastery-marks> <FORECAST|REFRACTION>"
  | ["spell-law", identity, cycle, pendingTick, rank, certificate, marks] =>
      runSpellLaw identity cycle pendingTick rank certificate marks
  | "spell-law" :: _ => wrongArity
      "imba-core spell-law <identity> <cycle> <pending-tick> <rank> <certificate> <mastery-marks>"
  | ["spell-cast", identity, cycle, pendingTick, rank, certificate, marks, source, intent, path, form] =>
      runSpellCast identity cycle pendingTick rank certificate marks source intent path form
  | "spell-cast" :: _ => wrongArity
      "imba-core spell-cast <identity> <cycle> <pending-tick> <rank> <certificate> <mastery-marks> <SOURCE> <INTENT> <PATH> <FORM>"
  | ["spell-repair", identity, cycle, pendingTick, rank, certificate, marks, source, intent, path, form] =>
      runSpellRepair identity cycle pendingTick rank certificate marks source intent path form
  | "spell-repair" :: _ => wrongArity
      "imba-core spell-repair <identity> <cycle> <pending-tick> <rank> <certificate> <mastery-marks> <SOURCE> <INTENT> <PATH> <FORM>"
  | ["journey", identity, certificate] => runJourney identity certificate
  | "journey" :: _ => wrongArity "imba-core journey <identity> <certificate>"
  | [] => emit (failure "missing command") 2
  | command :: _ => emit (failure ("unknown command: " ++ command)) 2

end Imba.Cli

def main (args : List String) : IO UInt32 :=
  Imba.Cli.run args
