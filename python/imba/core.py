"""Typed subprocess boundary to ``imba-core``.

No strength or rank-transition rule belongs in this module.  It validates and
transports answers supplied by the Lean executable.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
import os
import shlex
import subprocess
from typing import Any, Mapping, Sequence


class CoreError(RuntimeError):
    """Base class for failures at the Lean process boundary."""


class CoreExecutionError(CoreError):
    """The core deliberately rejected a request or could not be started."""


class CoreProtocolError(CoreError):
    """The core returned data that does not satisfy protocol 0.1."""


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


@dataclass(frozen=True)
class FuseAnswer:
    allowed: bool
    rank: int | None
    name: str | None
    reason: str


@dataclass(frozen=True)
class DefenseRoll:
    seed: int
    cycle: int
    interrupted_rank: int
    impact: int
    axes: dict[str, int]
    planes: dict[str, int]


@dataclass(frozen=True)
class DefenseAnswer:
    roll: DefenseRoll
    plane: str
    plane_power: int
    complement_plane: str
    complement_power: int
    absorbed: int
    damage: int
    fully_blocked: bool
    reason: str


@dataclass(frozen=True)
class FirstStrikeAnswer:
    allowed: bool
    confirmed_ticks: int
    previous_tension: int
    reflection: int
    already_used: bool
    capacity: int
    reason: str


@dataclass(frozen=True)
class TensionAnswer:
    previous_tension: int
    confirmed_ticks: int
    nature_damage: int
    gained: int
    result: int
    reason: str


@dataclass(frozen=True)
class LivingAnswer:
    memory: dict[str, int]
    charge: int
    total: int
    reflection: int
    complement_plane: str
    prefix_guard: bool
    reason: str


@dataclass(frozen=True)
class CertificateAnswer:
    identity: int
    certificate: int
    rank: int
    admitted: bool
    prefix_guard: bool
    reason: str


@dataclass(frozen=True)
class TickStageAnswer:
    current_ticks: int
    pending_tick: int
    current_rank: int
    held_rank: int
    certificate: int
    held_certificate: int
    transitioned: bool
    reason: str


@dataclass(frozen=True)
class CombatAnswer:
    identity: int
    current_epoch: int
    current_head: int
    candidate_epoch: int
    parent_head: int
    actor: str
    kind: str
    payload: int
    proposed_head: int
    admitted: bool
    result_epoch: int
    result_head: int
    verdict: str
    reason: str


@dataclass(frozen=True)
class WorldVitalsAnswer:
    life: int
    max_life: int
    reserve: int
    load: int
    shield: int


@dataclass(frozen=True)
class WorldCompensationAnswer:
    identity: int
    cycle: int
    epoch: int
    event_class: str
    form: str
    title: str
    power: int
    raw_damage: int
    absorbed: int
    direct_damage: int
    healing: int
    player_healing: int
    reserve_cost: int
    backlash: int
    before: WorldVitalsAnswer
    after: WorldVitalsAnswer
    reason: str


@dataclass(frozen=True)
class BalanceContactAnswer:
    capacity: int
    player_damage_before: int
    player_life_before: int
    player_healing: int
    player_damage_after: int
    player_life_after: int
    world: WorldCompensationAnswer


@dataclass(frozen=True)
class ProgressAnswer:
    form: str
    discovery_mask: int
    protocol_mask: int
    mastery_marks: int
    new_discovery: bool
    pending_choice: bool
    reason: str


@dataclass(frozen=True)
class ProtocolUnlockAnswer:
    protocol: str
    protocol_title: str
    discovery_mask: int
    protocol_mask: int
    mastery_marks: int
    allowed: bool
    pending_choice: bool
    reason: str


@dataclass(frozen=True)
class SpellTermAnswer:
    slot: str
    id: str
    phrase: str
    force: int
    coherence: int
    resonance: int


@dataclass(frozen=True)
class SpellSynergyAnswer:
    id: str
    title: str
    requires: tuple[tuple[str, str], ...]
    force: int
    coherence: int
    resonance: int


@dataclass(frozen=True)
class SpellLawAnswer:
    identity: int
    cycle: int
    pending_tick: int
    rank: int
    certificate: int
    mastery_marks: int
    force_need: int
    coherence_need: int
    resonance_need: int
    pressure: str
    complexity: int
    form_required: bool
    synergy_required: bool
    meta_tier: int
    lexicon_variant: int
    terms: tuple[SpellTermAnswer, ...]
    synergies: tuple[SpellSynergyAnswer, ...]


@dataclass(frozen=True)
class SpellCastAnswer:
    law: SpellLawAnswer
    source: str
    source_phrase: str
    intent: str
    intent_phrase: str
    path: str
    path_phrase: str
    form: str
    form_phrase: str
    synergy: str
    synergy_title: str
    synergy_force: int
    synergy_coherence: int
    synergy_resonance: int
    force: int
    coherence: int
    resonance: int
    force_ok: bool
    coherence_ok: bool
    resonance_ok: bool
    outcome: str
    admitted: bool
    cost: int
    preserves_identity: bool
    extends_certificate: bool
    reason: str


@dataclass(frozen=True)
class JourneyAnswer:
    identity: int
    certificate: int
    road_bricks: int
    castle_distance: int
    curse_remaining: int
    chapter: str
    castle_reached: bool
    first_chapter_distance: int
    world_truth_known: bool
    raven_form: str
    raven_form_title: str
    chapter_conflict: bool
    revelation: str
    trouble_active: bool
    trouble: str
    trouble_title: str
    trouble_copy: str
    trouble_power: int
    reason: str


class CoreClient:
    """Invoke a fresh authoritative core process for every query."""

    def __init__(
        self,
        command: str | Sequence[str] | None = None,
        *,
        timeout_seconds: float = 20.0,
    ) -> None:
        raw = command or os.environ.get("IMBA_CORE", "imba-core")
        self.command = tuple(shlex.split(raw) if isinstance(raw, str) else raw)
        self._names: dict[int, str] = {}
        if not self.command:
            raise ValueError("core command cannot be empty")
        if timeout_seconds <= 0:
            raise ValueError("core timeout must be positive")
        self.timeout_seconds = timeout_seconds

    def _call(self, operation: str, *args: int | str) -> Mapping[str, Any]:
        argv = [*self.command, operation, *(str(arg) for arg in args)]
        try:
            completed = subprocess.run(
                argv,
                text=True,
                encoding="utf-8",
                capture_output=True,
                check=False,
                timeout=self.timeout_seconds,
            )
        except subprocess.TimeoutExpired as exc:
            raise CoreExecutionError(
                f"Imba core did not answer within {self.timeout_seconds:g} seconds"
            ) from exc
        except OSError as exc:
            raise CoreExecutionError(f"cannot start Imba core: {exc}") from exc

        try:
            payload = json.loads(completed.stdout)
        except json.JSONDecodeError as exc:
            raise CoreProtocolError("core stdout is not exactly one JSON value") from exc
        if not isinstance(payload, dict) or type(payload.get("ok")) is not bool:
            raise CoreProtocolError("core response must be an object with boolean 'ok'")
        if completed.returncode == 0 and not payload["ok"]:
            raise CoreProtocolError("core returned ok=false with exit status 0")
        if completed.returncode != 0:
            if payload["ok"]:
                raise CoreProtocolError("core returned ok=true with nonzero exit status")
            error = payload.get("error")
            if not isinstance(error, str):
                raise CoreProtocolError("core error response has no string 'error'")
            raise CoreExecutionError(error)
        if payload.get("op") != operation:
            raise CoreProtocolError(f"expected operation {operation!r}")
        return payload

    @staticmethod
    def _field(payload: Mapping[str, Any], key: str, kind: type) -> Any:
        value = payload.get(key)
        valid = _is_int(value) if kind is int else type(value) is kind
        if not valid:
            raise CoreProtocolError(f"invalid or missing field {key!r}")
        return value

    def ping(self) -> str:
        payload = self._call("ping")
        return self._field(payload, "version", str)

    def name(self, rank: int) -> str:
        if rank in self._names:
            return self._names[rank]
        payload = self._call("name", rank)
        echoed = self._field(payload, "rank", int)
        if echoed != rank:
            raise CoreProtocolError("core echoed a different rank")
        name = self._field(payload, "name", str)
        self._names[rank] = name
        return name

    def compare(self, source_rank: int, target_rank: int) -> tuple[bool, str]:
        payload = self._call("beats", source_rank, target_rank)
        if self._field(payload, "attacker", int) != source_rank:
            raise CoreProtocolError("core echoed a different attacker rank")
        if self._field(payload, "defender", int) != target_rank:
            raise CoreProtocolError("core echoed a different defender rank")
        return (
            self._field(payload, "result", bool),
            self._field(payload, "reason", str),
        )

    def fuse(self, left: int, right: int) -> FuseAnswer:
        payload = self._call("fuse", left, right)
        if self._field(payload, "left", int) != left:
            raise CoreProtocolError("core echoed a different left rank")
        if self._field(payload, "right", int) != right:
            raise CoreProtocolError("core echoed a different right rank")
        allowed = self._field(payload, "allowed", bool)
        reason = self._field(payload, "reason", str)
        rank, name = payload.get("rank"), payload.get("name")
        if allowed:
            if not _is_int(rank) or not isinstance(name, str):
                raise CoreProtocolError("allowed fusion needs rank and name")
        elif rank is not None or name is not None:
            raise CoreProtocolError("denied fusion must have null rank and name")
        return FuseAnswer(allowed, rank, name, reason)

    def promote(self, rank: int, delta: int) -> tuple[int, str]:
        payload = self._call("promote", rank, delta)
        if self._field(payload, "rank", int) != rank:
            raise CoreProtocolError("core echoed a different rank")
        if self._field(payload, "delta", int) != delta:
            raise CoreProtocolError("core echoed a different delta")
        return (
            self._field(payload, "result", int),
            self._field(payload, "name", str),
        )

    def _parse_defense_roll(
        self,
        payload: Mapping[str, Any],
        seed: int,
        cycle: int,
        interrupted_rank: int,
    ) -> DefenseRoll:
        for key, expected in (
            ("seed", seed),
            ("cycle", cycle),
            ("interruptedRank", interrupted_rank),
        ):
            if self._field(payload, key, int) != expected:
                raise CoreProtocolError(f"core echoed a different {key}")
        axes = {key.upper(): self._field(payload, key, int) for key in ("x", "y", "z", "w")}
        planes = {key.upper(): self._field(payload, key, int) for key in ("xy", "xz", "xw", "yz", "yw", "zw")}
        if not all(1 <= value <= 6 for value in axes.values()):
            raise CoreProtocolError("defense axis is not a d6 face")
        return DefenseRoll(
            seed=seed,
            cycle=cycle,
            interrupted_rank=interrupted_rank,
            impact=self._field(payload, "impact", int),
            axes=axes,
            planes=planes,
        )

    def defense_roll(self, seed: int, cycle: int, interrupted_rank: int) -> DefenseRoll:
        payload = self._call("defense-roll", seed, cycle, interrupted_rank)
        return self._parse_defense_roll(payload, seed, cycle, interrupted_rank)

    def defense_resolve(
        self, seed: int, cycle: int, interrupted_rank: int, plane: str
    ) -> DefenseAnswer:
        payload = self._call("defense-resolve", seed, cycle, interrupted_rank, plane)
        roll = self._parse_defense_roll(payload, seed, cycle, interrupted_rank)
        echoed_plane = self._field(payload, "plane", str)
        if echoed_plane != plane.upper() or echoed_plane not in roll.planes:
            raise CoreProtocolError("core echoed a different defense plane")
        answer = DefenseAnswer(
            roll=roll,
            plane=echoed_plane,
            plane_power=self._field(payload, "planePower", int),
            complement_plane=self._field(payload, "complementPlane", str),
            complement_power=self._field(payload, "complementPower", int),
            absorbed=self._field(payload, "absorbed", int),
            damage=self._field(payload, "damage", int),
            fully_blocked=self._field(payload, "fullyBlocked", bool),
            reason=self._field(payload, "reason", str),
        )
        if answer.plane_power != roll.planes[echoed_plane]:
            raise CoreProtocolError("plane power disagrees with the rolled projection")
        if (
            answer.complement_plane not in roll.planes
            or answer.complement_power != roll.planes[answer.complement_plane]
            or answer.absorbed + answer.damage != roll.impact
        ):
            raise CoreProtocolError("defense projection violated impact conservation")
        if answer.damage < 1 or answer.fully_blocked:
            raise CoreProtocolError("core violated the no-full-block defense theorem")
        return answer

    def first_strike(
        self, confirmed_ticks: int, previous_tension: int, reflection: int,
        already_used: bool
    ) -> FirstStrikeAnswer:
        payload = self._call(
            "first-strike", confirmed_ticks, previous_tension, reflection,
            1 if already_used else 0
        )
        answer = FirstStrikeAnswer(
            allowed=self._field(payload, "allowed", bool),
            confirmed_ticks=self._field(payload, "confirmedTicks", int),
            previous_tension=self._field(payload, "previousTension", int),
            reflection=self._field(payload, "reflection", int),
            already_used=self._field(payload, "alreadyUsed", bool),
            capacity=self._field(payload, "capacity", int),
            reason=self._field(payload, "reason", str),
        )
        if (
            answer.confirmed_ticks != confirmed_ticks
            or answer.previous_tension != previous_tension
            or answer.reflection != reflection
            or answer.already_used != already_used
        ):
            raise CoreProtocolError("core echoed different first-strike inputs")
        if answer.allowed != (answer.capacity > 0) or answer.capacity > 12:
            raise CoreProtocolError("initiative permission disagrees with bounded capacity")
        return answer

    def living_admit(
        self, memory: Mapping[str, int], confirmed_ticks: int,
        nature_damage: int, plane: str
    ) -> LivingAnswer:
        payload = self._call(
            "living-admit",
            memory["X"], memory["Y"], memory["Z"], memory["W"],
            confirmed_ticks, nature_damage, plane,
        )
        answer = LivingAnswer(
            memory={key.upper(): self._field(payload, key, int) for key in ("x", "y", "z", "w")},
            charge=self._field(payload, "charge", int),
            total=self._field(payload, "total", int),
            reflection=self._field(payload, "reflection", int),
            complement_plane=self._field(payload, "complementPlane", str),
            prefix_guard=self._field(payload, "prefixGuard", bool),
            reason=self._field(payload, "reason", str),
        )
        if answer.total != sum(answer.memory.values()) or not answer.prefix_guard:
            raise CoreProtocolError("living memory violated its admitted-state contract")
        return answer

    def admit_tick(
        self, identity: int, certificate: int, current_rank: int, next_rank: int
    ) -> CertificateAnswer:
        payload = self._call(
            "certificate-admit", identity, certificate, current_rank, next_rank
        )
        answer = CertificateAnswer(
            identity=self._field(payload, "identity", int),
            certificate=self._field(payload, "certificate", int),
            rank=self._field(payload, "rank", int),
            admitted=self._field(payload, "admitted", bool),
            prefix_guard=self._field(payload, "prefixGuard", bool),
            reason=self._field(payload, "reason", str),
        )
        if answer.identity != identity or answer.rank != next_rank:
            raise CoreProtocolError("certificate core changed identity or rank")
        if answer.admitted and (
            not answer.prefix_guard or answer.certificate != certificate + 1
        ):
            raise CoreProtocolError("admitted tick did not extend the certified prefix")
        return answer

    def stage_tick(
        self, confirmed_ticks: int, current_rank: int, certificate: int
    ) -> TickStageAnswer:
        payload = self._call(
            "tick-stage", confirmed_ticks, current_rank, certificate
        )
        answer = TickStageAnswer(
            current_ticks=self._field(payload, "currentTicks", int),
            pending_tick=self._field(payload, "pendingTick", int),
            current_rank=self._field(payload, "currentRank", int),
            held_rank=self._field(payload, "heldRank", int),
            certificate=self._field(payload, "certificate", int),
            held_certificate=self._field(payload, "heldCertificate", int),
            transitioned=self._field(payload, "transitioned", bool),
            reason=self._field(payload, "reason", str),
        )
        if (
            answer.current_ticks != confirmed_ticks
            or answer.pending_tick != confirmed_ticks + 1
            or answer.current_rank != current_rank
            or answer.held_rank != current_rank
            or answer.certificate != certificate
            or answer.held_certificate != certificate
            or answer.transitioned
        ):
            raise CoreProtocolError("Lean tick stage violated manual-confirmation hold")
        return answer

    def combat_admit(
        self,
        identity: int,
        current_epoch: int,
        current_head: int,
        candidate_epoch: int,
        parent_head: int,
        actor: str,
        kind: str,
        payload_value: int,
    ) -> CombatAnswer:
        actor = actor.upper()
        kind = kind.upper()
        payload = self._call(
            "combat-admit",
            identity,
            current_epoch,
            current_head,
            candidate_epoch,
            parent_head,
            actor,
            kind,
            payload_value,
        )
        answer = CombatAnswer(
            identity=self._field(payload, "identity", int),
            current_epoch=self._field(payload, "currentEpoch", int),
            current_head=self._field(payload, "currentHead", int),
            candidate_epoch=self._field(payload, "candidateEpoch", int),
            parent_head=self._field(payload, "parentHead", int),
            actor=self._field(payload, "actor", str),
            kind=self._field(payload, "kind", str),
            payload=self._field(payload, "payload", int),
            proposed_head=self._field(payload, "proposedHead", int),
            admitted=self._field(payload, "admitted", bool),
            result_epoch=self._field(payload, "resultEpoch", int),
            result_head=self._field(payload, "resultHead", int),
            verdict=self._field(payload, "verdict", str),
            reason=self._field(payload, "reason", str),
        )
        expected = (
            identity,
            current_epoch,
            current_head,
            candidate_epoch,
            parent_head,
            actor,
            kind,
            payload_value,
        )
        observed = (
            answer.identity,
            answer.current_epoch,
            answer.current_head,
            answer.candidate_epoch,
            answer.parent_head,
            answer.actor,
            answer.kind,
            answer.payload,
        )
        if observed != expected:
            raise CoreProtocolError("core echoed different combat-continuity inputs")
        if answer.admitted:
            if (
                answer.verdict != "APPEND"
                or answer.result_epoch != candidate_epoch
                or answer.result_head != answer.proposed_head
            ):
                raise CoreProtocolError("admitted combat did not append its candidate")
        elif (
            answer.verdict != "HOLD"
            or answer.result_epoch != current_epoch
            or answer.result_head != current_head
        ):
            raise CoreProtocolError("rejected combat did not hold the observed head")
        return answer

    def combat_transition(
        self,
        identity: int,
        current_epoch: int,
        current_head: int,
        actor: str,
        kind: str,
        payload: int,
    ) -> CombatAnswer:
        answer = self.combat_admit(
            identity,
            current_epoch,
            current_head,
            current_epoch + 1,
            current_head,
            actor,
            kind,
            payload,
        )
        if not answer.admitted:
            raise CoreProtocolError("direct combat continuation was not admitted")
        return answer

    def carry_tension(
        self, previous_tension: int, confirmed_ticks: int, nature_damage: int
    ) -> TensionAnswer:
        payload = self._call(
            "tension-carry", previous_tension, confirmed_ticks, nature_damage
        )
        answer = TensionAnswer(
            previous_tension=self._field(payload, "previousTension", int),
            confirmed_ticks=self._field(payload, "confirmedTicks", int),
            nature_damage=self._field(payload, "natureDamage", int),
            gained=self._field(payload, "gained", int),
            result=self._field(payload, "result", int),
            reason=self._field(payload, "reason", str),
        )
        if (answer.previous_tension, answer.confirmed_ticks, answer.nature_damage) != (
            previous_tension, confirmed_ticks, nature_damage
        ):
            raise CoreProtocolError("core echoed different tension inputs")
        if answer.gained < 1 or answer.result <= previous_tension:
            raise CoreProtocolError("core violated strict tension growth")
        return answer

    def world_react(
        self,
        identity: int,
        cycle: int,
        epoch: int,
        vitals: WorldVitalsAnswer,
        raw_damage: int,
    ) -> WorldCompensationAnswer:
        payload = self._call(
            "world-react", identity, cycle, epoch, vitals.life, vitals.max_life,
            vitals.reserve, vitals.load, vitals.shield, raw_damage,
        )
        before = WorldVitalsAnswer(
            life=self._field(payload, "beforeLife", int),
            max_life=self._field(payload, "beforeMaxLife", int),
            reserve=self._field(payload, "beforeReserve", int),
            load=self._field(payload, "beforeLoad", int),
            shield=self._field(payload, "beforeShield", int),
        )
        after = WorldVitalsAnswer(
            life=self._field(payload, "life", int),
            max_life=self._field(payload, "maxLife", int),
            reserve=self._field(payload, "reserve", int),
            load=self._field(payload, "load", int),
            shield=self._field(payload, "shield", int),
        )
        answer = WorldCompensationAnswer(
            identity=self._field(payload, "identity", int),
            cycle=self._field(payload, "cycle", int),
            epoch=self._field(payload, "epoch", int),
            event_class=self._field(payload, "eventClass", str),
            form=self._field(payload, "form", str),
            title=self._field(payload, "title", str),
            power=self._field(payload, "power", int),
            raw_damage=self._field(payload, "rawDamage", int),
            absorbed=self._field(payload, "absorbed", int),
            direct_damage=self._field(payload, "directDamage", int),
            healing=self._field(payload, "healing", int),
            player_healing=self._field(payload, "playerHealing", int),
            reserve_cost=self._field(payload, "reserveCost", int),
            backlash=self._field(payload, "backlash", int),
            before=before,
            after=after,
            reason=self._field(payload, "reason", str),
        )
        if (answer.identity, answer.cycle, answer.epoch, answer.before, answer.raw_damage) != (
            identity, cycle, epoch, vitals, raw_damage
        ):
            raise CoreProtocolError("core echoed different living-World inputs")
        if answer.event_class != "COMPENSATION" or answer.form not in {
            "REGENERATION", "BARRIER", "REDISTRIBUTION", "SCAR", "OVERLOAD"
        }:
            raise CoreProtocolError("core returned an unknown compensation form")
        if answer.absorbed + answer.direct_damage != raw_damage:
            raise CoreProtocolError("World shield did not conserve incoming damage")
        if answer.after.life > answer.after.max_life:
            raise CoreProtocolError("World life exceeds its proven maximum")
        return answer

    def world_balance(
        self,
        identity: int,
        cycle: int,
        epoch: int,
        vitals: WorldVitalsAnswer,
        capacity: int,
        player_damage: int,
    ) -> BalanceContactAnswer:
        payload = self._call(
            "world-balance", identity, cycle, epoch, vitals.life, vitals.max_life,
            vitals.reserve, vitals.load, vitals.shield, capacity, player_damage,
        )
        before = WorldVitalsAnswer(
            life=self._field(payload, "beforeLife", int),
            max_life=self._field(payload, "beforeMaxLife", int),
            reserve=self._field(payload, "beforeReserve", int),
            load=self._field(payload, "beforeLoad", int),
            shield=self._field(payload, "beforeShield", int),
        )
        after = WorldVitalsAnswer(
            life=self._field(payload, "life", int),
            max_life=self._field(payload, "maxLife", int),
            reserve=self._field(payload, "reserve", int),
            load=self._field(payload, "load", int),
            shield=self._field(payload, "shield", int),
        )
        world = WorldCompensationAnswer(
            identity=self._field(payload, "identity", int),
            cycle=self._field(payload, "cycle", int),
            epoch=self._field(payload, "epoch", int),
            event_class=self._field(payload, "eventClass", str),
            form=self._field(payload, "form", str),
            title=self._field(payload, "title", str),
            power=self._field(payload, "power", int),
            raw_damage=self._field(payload, "rawDamage", int),
            absorbed=self._field(payload, "absorbed", int),
            direct_damage=self._field(payload, "directDamage", int),
            healing=self._field(payload, "healing", int),
            player_healing=self._field(payload, "playerHealing", int),
            reserve_cost=self._field(payload, "reserveCost", int),
            backlash=self._field(payload, "backlash", int),
            before=before,
            after=after,
            reason=self._field(payload, "reason", str),
        )
        answer = BalanceContactAnswer(
            capacity=self._field(payload, "capacity", int),
            player_damage_before=self._field(payload, "playerDamageBefore", int),
            player_life_before=self._field(payload, "playerLifeBefore", int),
            player_healing=self._field(payload, "playerHealing", int),
            player_damage_after=self._field(payload, "playerDamageAfter", int),
            player_life_after=self._field(payload, "playerLifeAfter", int),
            world=world,
        )
        if (
            world.identity, world.cycle, world.epoch, world.before,
            answer.capacity, answer.player_damage_before,
        ) != (identity, cycle, epoch, vitals, capacity, min(100, player_damage)):
            raise CoreProtocolError("core echoed different balance-contact inputs")
        if (
            world.event_class != "BALANCE"
            or world.direct_damage != 0
            or world.backlash != 0
            or world.after.life < world.before.life
            or answer.player_damage_after > answer.player_damage_before
            or answer.player_healing + answer.player_damage_after != answer.player_damage_before
        ):
            raise CoreProtocolError("balance contact harmed a living side")
        return answer

    def progress_observe(
        self, discovery_mask: int, protocol_mask: int, mastery_marks: int, form: str
    ) -> ProgressAnswer:
        payload = self._call(
            "progress-observe", discovery_mask, protocol_mask, mastery_marks, form
        )
        answer = ProgressAnswer(
            form=self._field(payload, "form", str),
            discovery_mask=self._field(payload, "discoveryMask", int),
            protocol_mask=self._field(payload, "protocolMask", int),
            mastery_marks=self._field(payload, "masteryMarks", int),
            new_discovery=self._field(payload, "newDiscovery", bool),
            pending_choice=self._field(payload, "pendingChoice", bool),
            reason=self._field(payload, "reason", str),
        )
        if answer.form != form.upper() or answer.protocol_mask != protocol_mask:
            raise CoreProtocolError("progress observer echoed a different Chronicle input")
        if answer.discovery_mask < discovery_mask or answer.mastery_marks < mastery_marks:
            raise CoreProtocolError("Chronicle progression moved backwards")
        if answer.new_discovery != (answer.mastery_marks == mastery_marks + 1):
            raise CoreProtocolError("discovery reward disagrees with mastery marks")
        return answer

    def progress_unlock(
        self, discovery_mask: int, protocol_mask: int, mastery_marks: int, protocol: str
    ) -> ProtocolUnlockAnswer:
        payload = self._call(
            "progress-unlock", discovery_mask, protocol_mask, mastery_marks, protocol
        )
        answer = ProtocolUnlockAnswer(
            protocol=self._field(payload, "protocol", str),
            protocol_title=self._field(payload, "protocolTitle", str),
            discovery_mask=self._field(payload, "discoveryMask", int),
            protocol_mask=self._field(payload, "protocolMask", int),
            mastery_marks=self._field(payload, "masteryMarks", int),
            allowed=self._field(payload, "allowed", bool),
            pending_choice=self._field(payload, "pendingChoice", bool),
            reason=self._field(payload, "reason", str),
        )
        if (
            answer.protocol != protocol.upper()
            or answer.discovery_mask != discovery_mask
            or answer.mastery_marks != mastery_marks
        ):
            raise CoreProtocolError("protocol unlock rewrote Chronicle inputs")
        if answer.allowed and answer.protocol_mask == protocol_mask:
            raise CoreProtocolError("allowed protocol unlock did not change its slot")
        return answer

    def _parse_spell_law(
        self,
        payload: Mapping[str, Any],
        identity: int,
        cycle: int,
        pending_tick: int,
        rank: int,
        certificate: int,
        mastery_marks: int,
    ) -> SpellLawAnswer:
        echoed = tuple(
            self._field(payload, key, int)
            for key in ("identity", "cycle", "pendingTick", "rank", "certificate", "masteryMarks")
        )
        expected = (identity, cycle, pending_tick, rank, certificate, mastery_marks)
        if echoed != expected:
            raise CoreProtocolError("spell law echoed different state inputs")
        source_specs = (
            ("SOURCE", "WILL", "will"),
            ("SOURCE", "SHADOW", "shadow"),
            ("SOURCE", "MEMORY", "memory"),
            ("SOURCE", "SPARK", "spark"),
        )
        intent_specs = (
            ("INTENT", "RELEASE", "release"),
            ("INTENT", "REVEAL", "reveal"),
            ("INTENT", "BIND", "bind"),
            ("INTENT", "INVERT", "invert"),
        )
        path_specs = (
            ("PATH", "ROAD", "road"),
            ("PATH", "ECHO", "echo"),
            ("PATH", "RIFT", "rift"),
            ("PATH", "ORBIT", "orbit"),
        )
        lexicon_variant = self._field(payload, "lexiconVariant", int)
        base_specs = tuple(
            spec
            for group, hidden in (
                (source_specs, lexicon_variant % 4),
                (intent_specs, (lexicon_variant + 1) % 4),
                (path_specs, (lexicon_variant + 2) % 4),
            )
            for index, spec in enumerate(group)
            if index != hidden
        )
        form_required = self._field(payload, "formRequired", bool)
        specs = base_specs + ((
            ("FORM", "BLADE", "blade"),
            ("FORM", "VEIL", "veil"),
            ("FORM", "PRISM", "prism"),
        ) if form_required else ())
        terms = tuple(
            SpellTermAnswer(
                slot=slot,
                id=term_id,
                phrase=self._field(payload, f"{prefix}Phrase", str),
                force=self._field(payload, f"{prefix}Force", int),
                coherence=self._field(payload, f"{prefix}Coherence", int),
                resonance=self._field(payload, f"{prefix}Resonance", int),
            )
            for slot, term_id, prefix in specs
        )
        synergy_specs = (
            ("EDGEWAY", "edgeway", (("PATH", "ROAD"), ("FORM", "BLADE"))),
            ("UMBRA", "umbra", (("SOURCE", "SHADOW"), ("FORM", "VEIL"))),
            ("REVELATION", "revelation", (("INTENT", "REVEAL"), ("PATH", "ECHO"))),
            ("REMEMBRANCE", "remembrance", (("SOURCE", "MEMORY"), ("PATH", "ECHO"), ("FORM", "VEIL"))),
            ("NOVA", "nova", (("SOURCE", "SPARK"), ("PATH", "ORBIT"), ("FORM", "PRISM"))),
            ("RIFTBLADE", "riftblade", (("INTENT", "INVERT"), ("PATH", "RIFT"), ("FORM", "BLADE"))),
        )
        synergies = tuple(
            SpellSynergyAnswer(
                id=synergy_id,
                title=self._field(payload, f"{prefix}Title", str),
                requires=requires,
                force=self._field(payload, f"{prefix}Force", int),
                coherence=self._field(payload, f"{prefix}Coherence", int),
                resonance=self._field(payload, f"{prefix}Resonance", int),
            )
            for synergy_id, prefix, requires in synergy_specs
        )
        law = SpellLawAnswer(
            identity=identity,
            cycle=cycle,
            pending_tick=pending_tick,
            rank=rank,
            certificate=certificate,
            mastery_marks=mastery_marks,
            force_need=self._field(payload, "forceNeed", int),
            coherence_need=self._field(payload, "coherenceNeed", int),
            resonance_need=self._field(payload, "resonanceNeed", int),
            pressure=self._field(payload, "pressure", str),
            complexity=self._field(payload, "complexity", int),
            form_required=form_required,
            synergy_required=self._field(payload, "synergyRequired", bool),
            meta_tier=self._field(payload, "metaTier", int),
            lexicon_variant=lexicon_variant,
            terms=terms,
            synergies=synergies,
        )
        if (
            min(law.force_need, law.coherence_need, law.resonance_need) < 1
            or law.pressure not in {"FORCE", "COHERENCE", "RESONANCE"}
            or law.complexity not in {1, 2, 3}
            or law.meta_tier not in {0, 1}
            or law.lexicon_variant not in {0, 1, 2, 3}
            or law.form_required != (certificate >= 4)
            or law.synergy_required != (certificate >= 8)
            or len(law.terms) != (12 if form_required else 9)
            or any(min(term.force, term.coherence, term.resonance) < 0 for term in terms)
            or any(min(item.force, item.coherence, item.resonance) < 0 for item in synergies)
        ):
            raise CoreProtocolError("spell law returned an invalid metric domain")
        return law

    def spell_law(
        self, identity: int, cycle: int, pending_tick: int, rank: int,
        certificate: int, mastery_marks: int
    ) -> SpellLawAnswer:
        payload = self._call(
            "spell-law", identity, cycle, pending_tick, rank, certificate, mastery_marks
        )
        return self._parse_spell_law(
            payload, identity, cycle, pending_tick, rank, certificate, mastery_marks
        )

    def spell_cast(
        self,
        identity: int,
        cycle: int,
        pending_tick: int,
        rank: int,
        certificate: int,
        mastery_marks: int,
        source: str,
        intent: str,
        path: str,
        form: str,
    ) -> SpellCastAnswer:
        source, intent, path, form = source.upper(), intent.upper(), path.upper(), form.upper()
        payload = self._call(
            "spell-cast", identity, cycle, pending_tick, rank, certificate,
            mastery_marks, source, intent, path, form,
        )
        law = self._parse_spell_law(
            payload, identity, cycle, pending_tick, rank, certificate, mastery_marks
        )
        answer = SpellCastAnswer(
            law=law,
            source=self._field(payload, "source", str),
            source_phrase=self._field(payload, "sourcePhrase", str),
            intent=self._field(payload, "intent", str),
            intent_phrase=self._field(payload, "intentPhrase", str),
            path=self._field(payload, "path", str),
            path_phrase=self._field(payload, "pathPhrase", str),
            form=self._field(payload, "form", str),
            form_phrase=self._field(payload, "formPhrase", str),
            synergy=self._field(payload, "synergy", str),
            synergy_title=self._field(payload, "synergyTitle", str),
            synergy_force=self._field(payload, "synergyForce", int),
            synergy_coherence=self._field(payload, "synergyCoherence", int),
            synergy_resonance=self._field(payload, "synergyResonance", int),
            force=self._field(payload, "force", int),
            coherence=self._field(payload, "coherence", int),
            resonance=self._field(payload, "resonance", int),
            force_ok=self._field(payload, "forceOk", bool),
            coherence_ok=self._field(payload, "coherenceOk", bool),
            resonance_ok=self._field(payload, "resonanceOk", bool),
            outcome=self._field(payload, "outcome", str),
            admitted=self._field(payload, "admitted", bool),
            cost=self._field(payload, "cost", int),
            preserves_identity=self._field(payload, "preservesIdentity", bool),
            extends_certificate=self._field(payload, "extendsCertificate", bool),
            reason=self._field(payload, "reason", str),
        )
        if (answer.source, answer.intent, answer.path, answer.form) != (source, intent, path, form):
            raise CoreProtocolError("spell core echoed a different human recipe")
        if answer.outcome not in {"APPEND", "APPEND_WITH_COST", "HOLD"}:
            raise CoreProtocolError("spell core returned an unknown outcome")
        if answer.admitted != (answer.outcome != "HOLD"):
            raise CoreProtocolError("spell outcome disagrees with admission")
        if answer.admitted and not (
            answer.preserves_identity and answer.extends_certificate
        ):
            raise CoreProtocolError("admitted spell lost its interface invariant")
        if answer.cost != (1 if answer.outcome == "APPEND_WITH_COST" else 0):
            raise CoreProtocolError("spell cost disagrees with its outcome")
        return answer

    def journey(self, identity: int, certificate: int) -> JourneyAnswer:
        payload = self._call("journey", identity, certificate)
        answer = JourneyAnswer(
            identity=self._field(payload, "identity", int),
            certificate=self._field(payload, "certificate", int),
            road_bricks=self._field(payload, "roadBricks", int),
            castle_distance=self._field(payload, "castleDistance", int),
            curse_remaining=self._field(payload, "curseRemaining", int),
            chapter=self._field(payload, "chapter", str),
            castle_reached=self._field(payload, "castleReached", bool),
            first_chapter_distance=self._field(payload, "firstChapterDistance", int),
            world_truth_known=self._field(payload, "worldTruthKnown", bool),
            raven_form=self._field(payload, "ravenForm", str),
            raven_form_title=self._field(payload, "ravenFormTitle", str),
            chapter_conflict=self._field(payload, "chapterConflict", bool),
            revelation=self._field(payload, "revelation", str),
            trouble_active=self._field(payload, "troubleActive", bool),
            trouble=self._field(payload, "trouble", str),
            trouble_title=self._field(payload, "troubleTitle", str),
            trouble_copy=self._field(payload, "troubleCopy", str),
            trouble_power=self._field(payload, "troublePower", int),
            reason=self._field(payload, "reason", str),
        )
        if (answer.identity, answer.certificate) != (identity, certificate):
            raise CoreProtocolError("journey core echoed a different identity or certificate")
        if min(answer.road_bricks, answer.castle_distance) + answer.curse_remaining != answer.castle_distance:
            raise CoreProtocolError("journey projection lost a curse fragment")
        if answer.castle_reached != (
            answer.road_bricks >= answer.castle_distance
        ):
            raise CoreProtocolError("castle threshold disagrees with road state")
        if answer.world_truth_known != (
            answer.road_bricks >= answer.first_chapter_distance
        ):
            raise CoreProtocolError("Raven revelation threshold disagrees with road state")
        if answer.raven_form not in {"CURSED_WALKER", "WORLD_MAGUS"}:
            raise CoreProtocolError("journey core returned an unknown Raven form")
        if (answer.raven_form == "WORLD_MAGUS") != answer.world_truth_known:
            raise CoreProtocolError("Raven form disagrees with the discovered World truth")
        if answer.chapter_conflict != (
            answer.road_bricks == answer.first_chapter_distance
        ):
            raise CoreProtocolError("chapter conflict threshold disagrees with road state")
        if answer.trouble_active != (answer.trouble != "NONE"):
            raise CoreProtocolError("Wizard trouble presence is inconsistent")
        return answer
