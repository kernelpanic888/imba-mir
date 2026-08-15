"""Single-domain Imba run with one manually confirmed tick at a time.

Lean remains authoritative for every rank transition and presentation name.
This module only owns the finite run rhythm: Nature eventually interrupts a
cycle, the player surrenders the resulting stack, and a new cycle begins.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import random

from .core import (
    CombatAnswer,
    CoreClient,
    DefenseAnswer,
    DefenseRoll,
    FirstStrikeAnswer,
    JourneyAnswer,
    ProgressAnswer,
    ProtocolUnlockAnswer,
    SpellCastAnswer,
    SpellLawAnswer,
    WorldCompensationAnswer,
    WorldVitalsAnswer,
)


VISIBLE_CUT_DEPTH = 3
DISCOVERY_BITS = {
    "REGENERATION": 1,
    "BARRIER": 2,
    "REDISTRIBUTION": 4,
    "SCAR": 8,
    "OVERLOAD": 16,
}


@dataclass
class ProgressState:
    discovery_mask: int = 0
    protocol_mask: int = 0
    mastery_marks: int = 0
    pending_choice: bool = False


@dataclass(frozen=True)
class Layer:
    rank: int
    name: str
    tick: int


@dataclass(frozen=True)
class Surrender:
    cycle: int
    reached_rank: int
    reached_name: str
    interrupted_rank: int
    interrupted_name: str
    plane: str
    absorbed: int
    damage: int
    tension_gained: int
    tension_after: int
    complement_plane: str
    reflection_after: int


@dataclass
class WorldState:
    seed: int
    progression: ProgressState = field(default_factory=ProgressState)
    cycle: int = 1
    status: str = "awaiting_tick"
    confirmed_ticks: int = 0
    spell_law: SpellLawAnswer | None = None
    last_spell: SpellCastAnswer | None = None
    spell_attempts: int = 0
    journey: JourneyAnswer | None = None
    layers: list[Layer] = field(default_factory=list)
    interrupted_layer: Layer | None = None
    defense_roll: DefenseRoll | None = None
    selected_plane: str | None = None
    defense: DefenseAnswer | None = None
    total_damage: int = 0
    internal_tension: int = 0
    enemy_damage: int = 0
    world_vitals: WorldVitalsAnswer = field(
        default_factory=lambda: WorldVitalsAnswer(
            life=100, max_life=100, reserve=30, load=0, shield=0
        )
    )
    world_events: list[WorldCompensationAnswer] = field(default_factory=list)
    forecast: WorldCompensationAnswer | None = None
    plane_preview: DefenseAnswer | None = None
    first_strike_used: bool = False
    strike_preview: FirstStrikeAnswer | None = None
    last_strike_damage: int | None = None
    pending_strike_damage: int | None = None
    axis_memory: dict[str, int] = field(
        default_factory=lambda: {"X": 0, "Y": 0, "Z": 0, "W": 0}
    )
    reflection: int = 0
    certificate: int = 0
    prefix_guard: bool = True
    combat_epoch: int = 0
    combat_head: int = 0
    combat_verdict: str = "GENESIS"
    pending_attack: CombatAnswer | None = None
    last_attack: CombatAnswer | None = None
    last_reaction: CombatAnswer | None = None
    shadow_manifested: int = 0
    shadow_returned: int = 0
    shadow_relic_order: int = 0
    last_activation_relic: str = "Реликт границы ещё не записан."
    surrenders: list[Surrender] = field(default_factory=list)
    messages: list[str] = field(default_factory=list)


class WorldGame:
    """One player, one square World, and one unbounded Imba stack."""

    def __init__(
        self, core: CoreClient, seed: int, progression: ProgressState | None = None
    ) -> None:
        self.core = core
        self._random = random.Random(seed)
        self._interruption_rank = self._draw_interruption_rank()
        self.state = WorldState(seed=seed, progression=progression or ProgressState())
        self.state.journey = self.core.journey(seed, 0)
        self._begin_cycle()

    def _has_protocol(self, protocol: str) -> bool:
        bit = {"FORECAST": 1, "REFRACTION": 2}[protocol]
        return self.state.progression.protocol_mask == bit

    def _refresh_forecast(self) -> None:
        preview = self.state.strike_preview
        if not self._has_protocol("FORECAST") or preview is None or not preview.allowed:
            self.state.forecast = None
            return
        self.state.forecast = self.core.world_react(
            self.state.seed,
            self.state.cycle,
            self.state.combat_epoch + 2,
            self.state.world_vitals,
            preview.damage,
        )

    def _require_protocol_choice(self) -> None:
        if self.state.progression.pending_choice:
            raise ValueError("сначала выберите первый Протокол Хроники на игровом поле")

    def _draw_interruption_rank(self) -> int:
        """Draw a finite cutoff from a distribution with no fixed maximum."""
        rank = 3
        while self._random.random() < 0.58:
            rank += 1
        return rank

    def _pure_creation(self, layer: Layer) -> None:
        """Record one piece manifesting without consuming another piece."""
        self.state.shadow_manifested += 1
        self.state.shadow_relic_order += 1
        self.state.last_activation_relic = (
            f"R{self.state.shadow_relic_order}: граница допустила проявление {layer.name}."
        )

    def _return_to_shadow(self, amount: int, reason: str) -> None:
        """Return opaque pieces to the archive without exposing their contents."""
        self.state.shadow_returned += amount
        self.state.shadow_relic_order += 1
        self.state.last_activation_relic = (
            f"R{self.state.shadow_relic_order}: {reason}"
        )

    def _append_combat(self, actor: str, kind: str, payload: int) -> CombatAnswer:
        """Append one Lean-admitted continuation to the local combat head."""
        answer = self.core.combat_transition(
            self.state.seed,
            self.state.combat_epoch,
            self.state.combat_head,
            actor,
            kind,
            payload,
        )
        self.state.combat_epoch = answer.result_epoch
        self.state.combat_head = answer.result_head
        self.state.combat_verdict = answer.verdict
        if kind == "ATTACK":
            self.state.pending_attack = answer
            self.state.last_attack = answer
        else:
            self.state.last_reaction = answer
            self.state.pending_attack = None
        return answer

    def _begin_cycle(self) -> None:
        self.state.status = "awaiting_tick"
        self.state.confirmed_ticks = 0
        self.state.spell_law = None
        self.state.spell_attempts = 0
        initial = Layer(rank=1, name=self.core.name(1), tick=0)
        self.state.layers = [initial]
        self._pure_creation(initial)
        self.state.interrupted_layer = None
        self.state.defense_roll = None
        self.state.selected_plane = None
        self.state.defense = None
        self.state.plane_preview = None
        self.state.first_strike_used = False
        self.state.last_strike_damage = None
        self.state.pending_strike_damage = None
        self.state.pending_attack = None
        self.state.strike_preview = self.core.first_strike(
            0, self.state.internal_tension, self.state.reflection, False
        )
        self._refresh_forecast()
        self.state.messages.append(
            f"Цикл {self.state.cycle}: акт чистого творения проявил простую Imba из Тени."
        )

    def tick(self) -> None:
        self._require_protocol_choice()
        if self.state.status != "awaiting_tick":
            raise ValueError("сначала подтвердите текущий шаг")
        staged = self.core.stage_tick(
            self.state.confirmed_ticks,
            self.state.layers[-1].rank,
            self.state.certificate,
        )
        next_tick = staged.pending_tick
        self.state.spell_law = self.core.spell_law(
            self.state.seed,
            self.state.cycle,
            next_tick,
            self.state.layers[-1].rank,
            self.state.certificate,
            self.state.progression.mastery_marks,
        )
        self.state.status = "awaiting_spell"
        self.state.messages.append(
            f"Тик {next_tick} накоплен. Соберите заклинание и извлеките из заклятия следующий шаг по дороге."
        )

    def cast_spell(self, source: str, intent: str, path: str, form: str) -> None:
        if self.state.status != "awaiting_spell" or self.state.spell_law is None:
            raise ValueError("нет тика, ожидающего конфигурации заклинания")

        current = self.state.layers[-1]
        next_tick = self.state.confirmed_ticks + 1
        spell = self.core.spell_cast(
            self.state.seed,
            self.state.cycle,
            next_tick,
            current.rank,
            self.state.certificate,
            self.state.progression.mastery_marks,
            source,
            intent,
            path,
            form,
        )
        self.state.last_spell = spell
        self.state.spell_attempts += 1
        if not spell.admitted:
            failed = ", ".join(
                label for label, passed in (
                    ("сила", spell.force_ok),
                    ("связность", spell.coherence_ok),
                    ("резонанс", spell.resonance_ok),
                ) if not passed
            )
            self.state.messages.append(
                f"Заклинание удержано: не совпали {failed}. Состояние, ранг и дорога не изменились."
            )
            return

        next_rank, next_name = self.core.promote(current.rank, 1)
        candidate = Layer(rank=next_rank, name=next_name, tick=next_tick)
        self._pure_creation(candidate)

        if spell.cost:
            self.state.internal_tension += spell.cost
            self.state.messages.append(
                f"Заклинание допущено с объявленной ценой: напряжение +{spell.cost}."
            )

        if next_rank == self._interruption_rank:
            attack = self._append_combat("NATURE", "ATTACK", next_rank)
            self.state.status = "awaiting_defense_roll"
            self.state.interrupted_layer = candidate
            self._return_to_shadow(
                1,
                f"{next_name} перебита Природой и вернулась в Тень.",
            )
            self.state.messages.append(
                f"Природа перебила тик {next_tick}: контакт Σ{attack.result_epoch} "
                f"привязана к h{attack.parent_head}; {next_name} ушла в Тень."
            )
            return

        certificate = self.core.admit_tick(
            self.state.seed,
            self.state.certificate,
            current.rank,
            next_rank,
        )
        if not certificate.admitted:
            raise ValueError("Lean-страж не допустил следующий тик")

        self.state.layers.append(candidate)
        self.state.certificate = certificate.certificate
        self.state.prefix_guard = certificate.prefix_guard
        self.state.journey = self.core.journey(
            self.state.seed, self.state.certificate
        )
        self.state.confirmed_ticks = next_tick
        self.state.status = "awaiting_tick"
        self.state.strike_preview = self.core.first_strike(
            self.state.confirmed_ticks,
            self.state.internal_tension,
            self.state.reflection,
            self.state.first_strike_used,
        )
        self._refresh_forecast()
        self.state.messages.append(
            f"Шаг {next_tick} подтверждён: {next_name} проявлена, а фрагмент заклятия стал шагом по зелёной дороге."
        )
        if self.state.journey is not None:
            self.state.messages.append(
                f"Шаги по дороге {self.state.journey.road_bricks}; рубеж R{self.state.journey.castle_distance}; "
                f"заклятие {self.state.journey.curse_remaining}/{self.state.journey.castle_distance}. "
                f"Волшебник насылает: {self.state.journey.trouble_title}."
            )
            if self.state.journey.chapter_conflict:
                self.state.messages.append(
                    "КОНФЛИКТ: Ворон понял, что Мир целиком сложен из магии, "
                    "принял вторую форму и впервые ответил Волшебнику как равный маг."
                )
        hidden = max(0, len(self.state.layers) - VISIBLE_CUT_DEPTH)
        if hidden > 0:
            self.state.messages.append(
                f"Виден только последний срез из трёх фишек; ещё {hidden} живут под ним в Тени."
            )

    def first_strike(self) -> None:
        self._require_protocol_choice()
        if self.state.status != "awaiting_tick":
            raise ValueError("первый контакт возможен только до следующего тика")
        answer = self.core.first_strike(
            self.state.confirmed_ticks,
            self.state.internal_tension,
            self.state.reflection,
            self.state.first_strike_used,
        )
        if not answer.allowed:
            raise ValueError("для первого контакта нужны тики и напряжение прошлых сессий")
        attack = self._append_combat("PLAYER", "ATTACK", answer.damage)
        self.state.pending_strike_damage = answer.damage
        self.state.status = "awaiting_world_reaction"
        self.state.forecast = None
        self.state.messages.append(
            f"Контакт Σ{attack.result_epoch} предложен: {self.state.confirmed_ticks} тиков + "
            f"{self.state.internal_tension} напряжения + {self.state.reflection} "
            f"рефлексии = {answer.damage}. Изменение ждёт реакции Мира."
        )

    def world_reaction(self) -> None:
        attack = self.state.pending_attack
        damage = self.state.pending_strike_damage
        if (
            self.state.status != "awaiting_world_reaction"
            or attack is None
            or attack.actor != "PLAYER"
            or attack.kind != "ATTACK"
            or damage is None
        ):
            raise ValueError("нет контакта игрока, ожидающего реакции Мира")
        reaction = self._append_combat("WORLD", "REACTION", damage)
        if reaction.parent_head != attack.result_head:
            raise ValueError("реакция Мира не привязана к принятому контакту")
        compensation = self.core.world_react(
            self.state.seed,
            self.state.cycle,
            reaction.result_epoch,
            self.state.world_vitals,
            damage,
        )
        self.state.world_vitals = compensation.after
        self.state.world_events.append(compensation)
        self.state.world_events[:] = self.state.world_events[-8:]
        progress = self.core.progress_observe(
            self.state.progression.discovery_mask,
            self.state.progression.protocol_mask,
            self.state.progression.mastery_marks,
            compensation.form,
        )
        self.state.progression.discovery_mask = progress.discovery_mask
        self.state.progression.protocol_mask = progress.protocol_mask
        self.state.progression.mastery_marks = progress.mastery_marks
        self.state.progression.pending_choice = progress.pending_choice
        self.state.enemy_damage += compensation.direct_damage + compensation.backlash
        self.state.first_strike_used = True
        self.state.last_strike_damage = compensation.direct_damage
        self.state.pending_strike_damage = None
        self.state.status = (
            "world_defeated" if compensation.after.life == 0 else "awaiting_tick"
        )
        self.state.strike_preview = self.core.first_strike(
            self.state.confirmed_ticks,
            self.state.internal_tension,
            self.state.reflection,
            True,
        )
        self._refresh_forecast()
        effect = (
            f"лечение +{compensation.healing}"
            if compensation.healing
            else f"щит → {compensation.after.shield}"
            if compensation.after.shield
            else f"перегрузка +{compensation.backlash}"
            if compensation.backlash
            else "перераспределение ресурса"
        )
        self.state.messages.append(
            f"Мир ответил формой {compensation.form}: вход {damage}, "
            f"прямой урон {compensation.direct_damage}; {effect}. "
            f"Жизнь {compensation.before.life}→{compensation.after.life}, "
            f"нагрузка {compensation.before.load}→{compensation.after.load}."
        )
        if progress.new_discovery:
            self.state.messages.append(
                f"Хроника расширена: {compensation.form}. Отметка мастерства +1."
            )
        if progress.pending_choice:
            self.state.messages.append(
                "Первый рубеж достигнут. Выберите Протокол, чтобы продолжить."
            )

    def choose_protocol(self, protocol: str) -> None:
        selected = protocol.upper()
        if selected not in {"FORECAST", "REFRACTION"}:
            raise ValueError("неизвестный Протокол Хроники")
        if not self.state.progression.pending_choice:
            raise ValueError("сейчас Хроника не ждёт выбора Протокола")
        answer = self.core.progress_unlock(
            self.state.progression.discovery_mask,
            self.state.progression.protocol_mask,
            self.state.progression.mastery_marks,
            selected,
        )
        if not answer.allowed:
            raise ValueError("Lean-страж не допустил этот Протокол")
        self.state.progression.protocol_mask = answer.protocol_mask
        self.state.progression.pending_choice = answer.pending_choice
        self._refresh_forecast()
        self.state.messages.append(
            f"Хроника допустила Протокол «{answer.protocol_title}»: {answer.protocol}."
        )

    def roll_defense(self) -> None:
        if self.state.status != "awaiting_defense_roll" or self.state.interrupted_layer is None:
            raise ValueError("защитный бросок доступен только после перебития")
        self.state.defense_roll = self.core.defense_roll(
            self.state.seed,
            self.state.cycle,
            self.state.interrupted_layer.rank,
        )
        self.state.plane_preview = None
        self.state.status = "awaiting_plane"
        self.state.messages.append(
            "Многоосевой куб брошен. Выберите подпространственную плоскость."
        )

    def select_plane(self, plane: str) -> None:
        if self.state.status != "awaiting_plane" or self.state.defense_roll is None:
            raise ValueError("сначала бросьте многоосевой куб")
        selected = plane.upper()
        if selected not in self.state.defense_roll.planes:
            raise ValueError("неизвестная подпространственная плоскость")
        self.state.selected_plane = selected
        self.state.plane_preview = (
            self.core.defense_resolve(
                self.state.seed,
                self.state.cycle,
                self.state.interrupted_layer.rank,
                selected,
            )
            if self._has_protocol("REFRACTION") and self.state.interrupted_layer is not None
            else None
        )
        self.state.messages.append(
            f"Выбрана плоскость {selected}. Защиту ещё нужно подтвердить."
        )

    def confirm_defense(self) -> None:
        if (
            self.state.status != "awaiting_plane"
            or self.state.interrupted_layer is None
            or self.state.selected_plane is None
        ):
            raise ValueError("выберите плоскость перед подтверждением защиты")
        answer = self.core.defense_resolve(
            self.state.seed,
            self.state.cycle,
            self.state.interrupted_layer.rank,
            self.state.selected_plane,
        )
        attack = self.state.pending_attack
        if attack is None or attack.actor != "NATURE" or attack.kind != "ATTACK":
            raise ValueError("защита не видит принятый импульс Природы")
        reaction = self._append_combat("PLAYER", "REACTION", answer.absorbed)
        if reaction.parent_head != attack.result_head:
            raise ValueError("защитная реакция не привязана к импульсу Природы")
        self.state.defense = answer
        self.state.total_damage += answer.damage
        self.state.status = "defended"
        self.state.messages.append(
            f"Реакция Σ{reaction.result_epoch} привязана к контакту h{reaction.parent_head}: "
            f"плоскость {answer.plane} поглотила {answer.absorbed}; Природа пробила {answer.damage}."
        )

    def surrender(self) -> None:
        if (
            self.state.status != "defended"
            or self.state.interrupted_layer is None
            or self.state.defense is None
        ):
            raise ValueError("сначала завершите защиту от Природы")

        reached = self.state.layers[-1]
        interrupted = self.state.interrupted_layer
        tension = self.core.carry_tension(
            self.state.internal_tension,
            self.state.confirmed_ticks,
            self.state.defense.damage,
        )
        living = self.core.living_admit(
            self.state.axis_memory,
            self.state.confirmed_ticks,
            self.state.defense.damage,
            self.state.defense.plane,
        )
        self.state.internal_tension = tension.result
        self.state.axis_memory = living.memory
        self.state.reflection = living.reflection
        self.state.prefix_guard = living.prefix_guard
        self.state.surrenders.append(
            Surrender(
                cycle=self.state.cycle,
                reached_rank=reached.rank,
                reached_name=reached.name,
                interrupted_rank=interrupted.rank,
                interrupted_name=interrupted.name,
                plane=self.state.defense.plane,
                absorbed=self.state.defense.absorbed,
                damage=self.state.defense.damage,
                tension_gained=tension.gained,
                tension_after=tension.result,
                complement_plane=living.complement_plane,
                reflection_after=living.reflection,
            )
        )
        self.state.messages.append(
            f"Ответ цикла {self.state.cycle}: сдача Миру на {reached.name}; "
            f"напряжение +{tension.gained}."
        )
        returned = len(self.state.layers)
        self._return_to_shadow(
            returned,
            f"Сдача: {returned} фишек полного среза вернулись в Тень.",
        )
        self.state.messages.append(
            f"Вся линия из {returned} фишек ушла в Тень без раскрытия скрытых слоёв."
        )
        self.state.cycle += 1
        self._interruption_rank = self._draw_interruption_rank()
        self._begin_cycle()
