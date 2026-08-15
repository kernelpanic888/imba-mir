import Imba.WorldLife
import Std.Tactic

/-!
# Imba: Chronicle progression

The Chronicle records which compensatory forms of the living World the player
has actually observed.  A repeated observation never pays a second discovery
mark.  The first discovery opens one horizontal protocol choice; the choice
reveals information, but does not increase damage or remove risk.
-/

namespace Imba

inductive ProgressProtocol where
  | forecast
  | refraction
  deriving Repr, DecidableEq, BEq

def ProgressProtocol.label : ProgressProtocol -> String
  | .forecast => "FORECAST"
  | .refraction => "REFRACTION"

def ProgressProtocol.title : ProgressProtocol -> String
  | .forecast => "Предвестник"
  | .refraction => "Преломление"

def ProgressProtocol.bit : ProgressProtocol -> Nat
  | .forecast => 1
  | .refraction => 2

def CompensationForm.discoveryBit : CompensationForm -> Nat
  | .regeneration => 1
  | .barrier => 2
  | .redistribution => 4
  | .scar => 8
  | .overload => 16

def discoverySeen (mask : Nat) (form : CompensationForm) : Bool :=
  (mask / form.discoveryBit) % 2 == 1

structure ProgressOutcome where
  discoveryMask : Nat
  protocolMask : Nat
  masteryMarks : Nat
  newDiscovery : Bool
  pendingChoice : Bool
  deriving Repr, DecidableEq

def observeProgress (discoveryMask protocolMask masteryMarks : Nat)
    (form : CompensationForm) : ProgressOutcome :=
  let fresh := !discoverySeen discoveryMask form
  let nextMask := if fresh then discoveryMask + form.discoveryBit else discoveryMask
  let nextMarks := if fresh then masteryMarks + 1 else masteryMarks
  { discoveryMask := nextMask
    protocolMask := protocolMask
    masteryMarks := nextMarks
    newDiscovery := fresh
    pendingChoice := protocolMask == 0 && nextMarks > 0 }

theorem observation_never_rewrites_chronicle (mask protocols marks : Nat)
    (form : CompensationForm) :
    mask <= (observeProgress mask protocols marks form).discoveryMask := by
  simp [observeProgress]
  split <;> omega

theorem repeated_observation_has_no_reward (mask protocols marks : Nat)
    (form : CompensationForm) (seen : discoverySeen mask form = true) :
    (observeProgress mask protocols marks form).masteryMarks = marks := by
  simp [observeProgress, seen]

structure ProtocolOutcome where
  discoveryMask : Nat
  protocolMask : Nat
  masteryMarks : Nat
  protocol : ProgressProtocol
  allowed : Bool
  pendingChoice : Bool
  deriving Repr, DecidableEq

def unlockProtocol (discoveryMask protocolMask masteryMarks : Nat)
    (protocol : ProgressProtocol) : ProtocolOutcome :=
  let allowed := discoveryMask > 0 && protocolMask == 0
  { discoveryMask := discoveryMask
    protocolMask := if allowed then protocol.bit else protocolMask
    masteryMarks := masteryMarks
    protocol := protocol
    allowed := allowed
    pendingChoice := if allowed then false else protocolMask == 0 && masteryMarks > 0 }

theorem protocol_unlock_preserves_chronicle (discoveries protocols marks : Nat)
    (protocol : ProgressProtocol) :
    (unlockProtocol discoveries protocols marks protocol).discoveryMask = discoveries := by
  rfl

theorem protocol_unlock_preserves_marks (discoveries protocols marks : Nat)
    (protocol : ProgressProtocol) :
    (unlockProtocol discoveries protocols marks protocol).masteryMarks = marks := by
  rfl

end Imba
