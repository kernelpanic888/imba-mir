"""HTTP boundary between the graphical Imba interface and its Lean core."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import re
import secrets
import threading
import time
from typing import Any, Mapping
from urllib.parse import urlparse

from .core import CoreClient, CoreError
from .world import DISCOVERY_BITS, VISIBLE_CUT_DEPTH, ProgressState, WorldGame


def _integer(value: object, label: str) -> int:
    if type(value) is not int:
        raise ValueError(f"{label} must be an integer")
    return value


def _text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{label} must be a non-empty string")
    return value


def _layer(layer: object) -> dict[str, Any]:
    return {
        "rank": layer.rank,
        "name": layer.name,
        "tick": layer.tick,
    }


def _combat(certificate: object | None) -> dict[str, Any] | None:
    if certificate is None:
        return None
    return {
        "epoch": certificate.result_epoch,
        "parentHead": str(certificate.parent_head),
        "head": str(certificate.result_head),
        "actor": certificate.actor,
        "kind": certificate.kind,
        "payload": certificate.payload,
        "verdict": certificate.verdict,
    }


def _world_vitals(vitals: object) -> dict[str, int]:
    return {
        "life": vitals.life,
        "maxLife": vitals.max_life,
        "reserve": vitals.reserve,
        "load": vitals.load,
        "shield": vitals.shield,
    }


def _world_event(event: object | None) -> dict[str, Any] | None:
    if event is None:
        return None
    return {
        "class": event.event_class,
        "form": event.form,
        "title": event.title,
        "power": event.power,
        "rawDamage": event.raw_damage,
        "absorbed": event.absorbed,
        "directDamage": event.direct_damage,
        "healing": event.healing,
        "reserveCost": event.reserve_cost,
        "backlash": event.backlash,
        "before": _world_vitals(event.before),
        "after": _world_vitals(event.after),
        "reason": event.reason,
    }


def _active_protocol(mask: int) -> dict[str, str] | None:
    if mask == 1:
        return {
            "id": "FORECAST", "title": "Предвестник",
            "copy": "Показывает следующую форму компенсации до первого контакта.",
        }
    if mask == 2:
        return {
            "id": "REFRACTION", "title": "Преломление",
            "copy": "Показывает точное пробитие выбранной плоскости до подтверждения.",
        }
    return None


def _conflict_progress(status: str) -> tuple[int, int]:
    return {
        "awaiting_tick": (0, 7),
        "awaiting_spell": (1, 7),
        "awaiting_defense_roll": (2, 7),
        "awaiting_plane": (3, 7),
        "defended": (4, 7),
        "awaiting_world_reaction": (6, 7),
        "world_defeated": (7, 7),
    }[status]


def snapshot(game: WorldGame) -> dict[str, Any]:
    """Return the complete public state needed by the browser UI."""
    state = game.state
    full_depth = len(state.layers)
    hidden_depth = max(0, full_depth - VISIBLE_CUT_DEPTH)
    visible_layers = state.layers[-VISIBLE_CUT_DEPTH:]
    world_vitals = state.world_vitals
    world_condition = (
        "SILENCE" if world_vitals.life == 0
        else "OVERLOAD" if world_vitals.load >= 18
        else "FORTIFIED" if world_vitals.shield > 0
        else "WOUNDED" if world_vitals.life < world_vitals.max_life
        else "HOMEOSTASIS"
    )
    progression = state.progression
    discovered = [
        form for form, bit in DISCOVERY_BITS.items()
        if progression.discovery_mask // bit % 2 == 1
    ]
    conflict_value, conflict_target = _conflict_progress(state.status)
    immediate = {
        "awaiting_tick": "Накопить один тик",
        "awaiting_spell": "Сконструировать заклинание шага по дороге",
        "awaiting_defense_roll": "Бросить куб защиты",
        "awaiting_plane": "Выбрать и подтвердить плоскость",
        "defended": "Сдать стопку Миру",
        "awaiting_world_reaction": "Кликнуть по Миру: принять реакцию",
        "world_defeated": "Создать новый Мир",
    }[state.status]
    if progression.pending_choice:
        immediate = "Выбрать первый Протокол Хроники"
    return {
        "seed": state.seed,
        "cycle": state.cycle,
        "status": state.status,
        "confirmedTicks": state.confirmed_ticks,
        "pendingTick": state.confirmed_ticks + 1
        if state.status == "awaiting_spell"
        else None,
        # The browser receives the proven last-three projection, never the
        # opaque prefix itself.  Lean's shadow_cut_reconstructs covers the
        # corresponding full-state invariant.
        "layers": [_layer(layer) for layer in visible_layers],
        "shadow": {
            "sliceDepth": VISIBLE_CUT_DEPTH,
            "visibleDepth": len(visible_layers),
            "hasHiddenPrefix": hidden_depth > 0,
            "boundary": "opaque",
            "channel": "J / admitted boundary interaction",
            "relicOrder": state.shadow_relic_order,
            "lastRelic": state.last_activation_relic,
        },
        "interruptedLayer": _layer(state.interrupted_layer)
        if state.interrupted_layer is not None
        else None,
        "defenseRoll": {
            "impact": state.defense_roll.impact,
            "axes": state.defense_roll.axes,
            "planes": [
                {"id": key, "power": value}
                for key, value in state.defense_roll.planes.items()
            ],
        } if state.defense_roll is not None else None,
        "selectedPlane": state.selected_plane,
        "defense": {
            "plane": state.defense.plane,
            "planePower": state.defense.plane_power,
            "complementPlane": state.defense.complement_plane,
            "complementPower": state.defense.complement_power,
            "absorbed": state.defense.absorbed,
            "damage": state.defense.damage,
            "fullyBlocked": state.defense.fully_blocked,
        } if state.defense is not None else None,
        "totalDamage": state.total_damage,
        "internalTension": state.internal_tension,
        "enemyDamage": state.enemy_damage,
        "actors": {
            "player": {
                "life": max(0, 100 - state.total_damage),
                "maxLife": 100,
                "damageTaken": state.total_damage,
                "condition": "WOUNDED" if state.total_damage else "READY",
            },
            "world": _world_vitals(world_vitals) | {
                "condition": world_condition,
            },
        },
        "worldEvent": _world_event(state.world_events[-1] if state.world_events else None),
        "worldEvents": [_world_event(event) for event in state.world_events],
        "progression": {
            "discoveryMask": progression.discovery_mask,
            "masteryMarks": progression.mastery_marks,
            "pendingChoice": progression.pending_choice,
            "activeProtocol": _active_protocol(progression.protocol_mask),
            "options": [
                {
                    "id": "FORECAST", "title": "Предвестник",
                    "copy": "Заранее раскрывает форму следующей компенсации Мира.",
                },
                {
                    "id": "REFRACTION", "title": "Преломление",
                    "copy": "До подтверждения раскрывает точное остаточное пробитие плоскости.",
                },
            ] if progression.pending_choice else [],
            "forecast": {
                "form": state.forecast.form,
                "title": state.forecast.title,
                "power": state.forecast.power,
            } if state.forecast is not None else None,
            "planePreview": {
                "plane": state.plane_preview.plane,
                "damage": state.plane_preview.damage,
                "complementPlane": state.plane_preview.complement_plane,
            } if state.plane_preview is not None else None,
            "horizons": [
                {"id": "NOW", "label": "СЕЙЧАС", "title": immediate,
                 "value": 1 if progression.pending_choice else 0, "target": 1},
                {"id": "CONFLICT", "label": "РУБЕЖ", "title": "Получить ответ живого Мира",
                 "value": conflict_value, "target": conflict_target},
                {"id": "SESSION", "label": "СЕССИЯ", "title": "Закрыть дугу ответом Мира",
                 "value": 1 if state.world_events else 0, "target": 1},
                {"id": "CHRONICLE", "label": "ХРОНИКА", "title": "Понять все формы Мира",
                 "value": len(discovered), "target": len(DISCOVERY_BITS)},
            ],
            "discovered": discovered,
            "totalForms": len(DISCOVERY_BITS),
        },
        "firstStrikeUsed": state.first_strike_used,
        "firstStrike": {
            "allowed": state.strike_preview.allowed,
            "damage": state.strike_preview.damage,
            "confirmedTicks": state.strike_preview.confirmed_ticks,
            "previousTension": state.strike_preview.previous_tension,
            "reflection": state.strike_preview.reflection,
            "reason": state.strike_preview.reason,
        } if state.strike_preview is not None else None,
        "lastStrikeDamage": state.last_strike_damage,
        "living": {
            "identity": state.seed,
            "memory": state.axis_memory,
            "reflection": state.reflection,
            "certificate": state.certificate,
            "prefixGuard": state.prefix_guard,
        },
        "continuity": {
            "identity": state.seed,
            "epoch": state.combat_epoch,
            "head": str(state.combat_head),
            "verdict": state.combat_verdict,
            "pendingAttack": _combat(state.pending_attack),
            "lastAttack": _combat(state.last_attack),
            "lastReaction": _combat(state.last_reaction),
            "route": ["OBSERVE", "ADMIT", "CERTIFY", "APPEND"],
            "boundary": "game commitment / not a cryptographic signature",
        },
        "spell": {
            "law": {
                "forceNeed": state.spell_law.force_need,
                "coherenceNeed": state.spell_law.coherence_need,
                "resonanceNeed": state.spell_law.resonance_need,
                "pressure": state.spell_law.pressure,
                "complexity": state.spell_law.complexity,
                "formRequired": state.spell_law.form_required,
                "synergyRequired": state.spell_law.synergy_required,
                "metaTier": state.spell_law.meta_tier,
                "lexiconVariant": state.spell_law.lexicon_variant,
                "terms": [
                    {
                        "slot": term.slot,
                        "id": term.id,
                        "phrase": term.phrase,
                        "force": term.force,
                        "coherence": term.coherence,
                        "resonance": term.resonance,
                    }
                    for term in state.spell_law.terms
                ],
                "synergies": [
                    {
                        "id": synergy.id,
                        "title": synergy.title,
                        "requires": dict(synergy.requires),
                        "force": synergy.force,
                        "coherence": synergy.coherence,
                        "resonance": synergy.resonance,
                    }
                    for synergy in state.spell_law.synergies
                ],
            },
            "attempts": state.spell_attempts,
            "last": {
                "source": state.last_spell.source,
                "sourcePhrase": state.last_spell.source_phrase,
                "intent": state.last_spell.intent,
                "intentPhrase": state.last_spell.intent_phrase,
                "path": state.last_spell.path,
                "pathPhrase": state.last_spell.path_phrase,
                "form": state.last_spell.form,
                "formPhrase": state.last_spell.form_phrase,
                "synergy": state.last_spell.synergy,
                "synergyTitle": state.last_spell.synergy_title,
                "synergyForce": state.last_spell.synergy_force,
                "synergyCoherence": state.last_spell.synergy_coherence,
                "synergyResonance": state.last_spell.synergy_resonance,
                "force": state.last_spell.force,
                "coherence": state.last_spell.coherence,
                "resonance": state.last_spell.resonance,
                "forceOk": state.last_spell.force_ok,
                "coherenceOk": state.last_spell.coherence_ok,
                "resonanceOk": state.last_spell.resonance_ok,
                "outcome": state.last_spell.outcome,
                "admitted": state.last_spell.admitted,
                "cost": state.last_spell.cost,
                "reason": state.last_spell.reason,
            } if state.last_spell is not None else None,
        } if state.spell_law is not None else None,
        "journey": {
            "roadBricks": state.journey.road_bricks,
            "castleDistance": state.journey.castle_distance,
            "curseRemaining": state.journey.curse_remaining,
            "chapter": state.journey.chapter,
            "castleReached": state.journey.castle_reached,
            "firstChapterDistance": state.journey.first_chapter_distance,
            "worldTruthKnown": state.journey.world_truth_known,
            "ravenForm": state.journey.raven_form,
            "ravenFormTitle": state.journey.raven_form_title,
            "chapterConflict": state.journey.chapter_conflict,
            "revelation": state.journey.revelation,
            "trouble": {
                "active": state.journey.trouble_active,
                "id": state.journey.trouble,
                "title": state.journey.trouble_title,
                "copy": state.journey.trouble_copy,
                "power": state.journey.trouble_power,
            },
            "reason": state.journey.reason,
        } if state.journey is not None else None,
        "surrenders": [
            {
                "cycle": item.cycle,
                "reachedRank": item.reached_rank,
                "reachedName": item.reached_name,
                "interruptedRank": item.interrupted_rank,
                "interruptedName": item.interrupted_name,
                "plane": item.plane,
                "absorbed": item.absorbed,
                "damage": item.damage,
                "tensionGained": item.tension_gained,
                "tensionAfter": item.tension_after,
                "complementPlane": item.complement_plane,
                "reflectionAfter": item.reflection_after,
            }
            for item in state.surrenders
        ],
        "messages": list(state.messages),
    }


def _trace_step(label: str, expression: str, state: str = "ok") -> dict[str, str]:
    return {"label": label, "expression": expression, "state": state}


def _signal(
    symbol: str, label: str, value: object, state: str = "ok"
) -> dict[str, str]:
    """Return one visible node in the public mathematical scene."""
    return {
        "symbol": symbol,
        "label": label,
        "value": str(value),
        "state": state,
    }


def _calculation(
    action: str, before: Mapping[str, Any], after: Mapping[str, Any]
) -> dict[str, Any]:
    """Build a public formal trace from values actually returned by the core.

    This is deliberately a reduction/audit trace, not hidden model reasoning.
    """
    rank_before = before["layers"][-1]["rank"]
    ticks_before = before["confirmedTicks"]
    certificate_before = before["living"]["certificate"]
    common: dict[str, Any] = {
        "action": action,
        "engine": "LEAN 4 / imba-core",
        "boundary": "FORMAL REDUCTION TRACE / NOT PRIVATE REASONING",
        "durationMs": 6200,
    }

    if action == "tick":
        pending = after["pendingTick"]
        return common | {
            "scene": "tick",
            "relation": "n ↦ n + 1",
            "signals": [
                _signal("n", "ПОДТВЕРЖДЕНО", ticks_before),
                _signal("Δ", "РУЧНОЙ ШАГ", "+1"),
                _signal("p", "ОЖИДАЕТ", pending, "wait"),
            ],
            "title": "Стадирование ручного тика",
            "theorem": "stagedTick_is_next",
            "equation": f"p := n + 1 = {ticks_before} + 1 = {pending}",
            "steps": [
                _trace_step("OBSERVE", f"σ = (n={ticks_before}, r={rank_before}, C={certificate_before})"),
                _trace_step("REDUCE", f"stagedTick {ticks_before} ↦ {pending}"),
                _trace_step("HOLD", f"r′ = r{rank_before} ∧ C′ = C{certificate_before}", "hold"),
                _trace_step("GATE", "transitioned = false; требуется формула игрока", "wait"),
            ],
            "result": f"PENDING TICK {pending}",
            "verdict": "WAIT / SPELL",
        }

    if action == "cast_spell":
        spell = after["spell"]["last"]
        law = after["spell"]["law"]
        form_step = [] if spell["form"] == "DORMANT" else [
            _trace_step("FORM", spell["formPhrase"]),
        ]
        synergy_step = [] if spell["synergy"] == "NONE" else [
            _trace_step("SYNERGY", f"{spell['synergyTitle']} / {spell['synergy']}"),
        ]
        if spell["outcome"] == "HOLD":
            failed = " · ".join(
                label for label, key in (
                    ("F", "forceOk"), ("C", "coherenceOk"), ("R", "resonanceOk")
                ) if not spell[key]
            )
            structural = []
            if law["formRequired"] and spell["form"] == "DORMANT":
                structural.append("FORM")
            if law["synergyRequired"] and spell["synergy"] == "NONE":
                structural.append("SYNERGY")
            failed_label = " · ".join(filter(None, [failed, *structural])) or "INTERFACE"
            return common | {
                "scene": "spell",
                "relation": "Mor_I(A,B) ∉ Interface ⇒ HOLD",
                "signals": [
                    _signal("F", "СИЛА", spell["force"], "ok" if spell["forceOk"] else "warn"),
                    _signal("C", "СВЯЗНОСТЬ", spell["coherence"], "ok" if spell["coherenceOk"] else "warn"),
                    _signal("R", "РЕЗОНАНС", spell["resonance"], "ok" if spell["resonanceOk"] else "warn"),
                    _signal("C′", "СЕРТИФИКАТ", certificate_before, "hold"),
                ],
                "title": "Заклинание удержано интерфейсом",
                "theorem": "judgeSpell / partial_interface_morphism",
                "equation": f"deficit({failed_label}) ⇒ C′ = C{certificate_before}",
                "steps": [
                    _trace_step("SOURCE", spell["sourcePhrase"]),
                    _trace_step("GOAL", spell["intentPhrase"]),
                    _trace_step("MAP", spell["pathPhrase"]),
                    *form_step,
                    *synergy_step,
                    _trace_step("HOLD", "ранг, сертификат, заклятие и дорога неизменны", "hold"),
                ],
                "result": "HOLD / ИЗМЕНИТЕ ФОРМУЛУ",
                "verdict": "HOLD",
            }
        if after["status"] == "awaiting_defense_roll":
            interrupted = after["interruptedLayer"]
            attack = after["continuity"]["pendingAttack"]
            return common | {
                "scene": "interrupt",
                "relation": "r(candidate) = κₙ ⇒ HOLD(C)",
                "signals": [
                    _signal("r", "ОСНОВА", f"r{rank_before}"),
                    _signal("r+1", "КАНДИДАТ", f"r{interrupted['rank']}", "warn"),
                    _signal("κₙ", "СРЕЗ ПРИРОДЫ", f"r{interrupted['rank']}", "warn"),
                    _signal("C", "СЕРТИФИКАТ", f"C{certificate_before}", "hold"),
                ],
                "title": "Редукция кандидата и перебитие",
                "theorem": "combat_admissible_iff",
                "equation": f"promote(r{rank_before}, 1) = r{interrupted['rank']} = κₙ",
                "steps": [
                    _trace_step("SPELL", f"{spell['source']} → {spell['intent']} → {spell['path']} → {spell['form']} / {spell['outcome']}"),
                    *synergy_step,
                    _trace_step("PROMOTE", f"r{rank_before} + 1 ↦ r{interrupted['rank']} / {interrupted['name']}"),
                    _trace_step("COMPARE", f"candidate rank {interrupted['rank']} = Nature cutoff", "warn"),
                    _trace_step("REJECT TICK", f"C′ = C{certificate_before}; кандидат не входит в prefix", "hold"),
                    _trace_step("APPEND", f"NATURE/CONTACT · Σ{attack['epoch']} · parent h{attack['parentHead']}"),
                ],
                "result": f"h′ = {attack['head']}",
                "verdict": attack["verdict"],
            }
        layer = after["layers"][-1]
        certificate_after = after["living"]["certificate"]
        journey = after["journey"]
        return common | {
            "scene": "spell",
            "relation": f"Curse[{journey['curseRemaining'] + 1}] → RoadStep[{journey['roadBricks']}]",
            "signals": [
                _signal("F", "СИЛА", spell["force"]),
                _signal("C", "СВЯЗНОСТЬ", spell["coherence"]),
                _signal("R", "РЕЗОНАНС", spell["resonance"]),
                _signal("⊗", "СИНЕРГИЯ", spell["synergy"]),
                _signal("▰", "ШАГ ПО ЗЕЛЁНОЙ ДОРОГЕ", journey["roadBricks"]),
            ],
            "title": "Заклятие стало частью дороги",
            "theorem": "nadimbaMorphism.admissible ∧ road_and_curse_complete",
            "equation": f"Mor_I(r{rank_before},C{certificate_before}) ↦ (r{layer['rank']},C{certificate_after}); road={journey['roadBricks']}/{journey['castleDistance']}",
            "steps": [
                _trace_step("COMPOSE", f"{spell['source']} → {spell['intent']} → {spell['path']} → {spell['form']}"),
                *synergy_step,
                _trace_step("ADMIT", f"{spell['outcome']} · identity preserved"),
                _trace_step("CERTIFY", f"C{certificate_before} ⊑ C{certificate_after}"),
                _trace_step("EXTERNALIZE", f"заклятие → шаг по дороге {journey['roadBricks']} → {layer['name']}"),
            ],
            "result": f"ROAD STEP {journey['roadBricks']} / {spell['outcome']}",
            "verdict": spell["outcome"],
        }

    if action == "roll_defense":
        roll = after["defenseRoll"]
        axes = roll["axes"]
        planes = " · ".join(f"{item['id']}={item['power']}" for item in roll["planes"])
        return common | {
            "scene": "axes",
            "relation": "v = (X,Y,Z,W) ∈ [1,6]⁴",
            "signals": [
                _signal(axis, f"ОСЬ {axis}", axes[axis])
                for axis in ("X", "Y", "Z", "W")
            ],
            "title": "Четырёхосевой бросок",
            "theorem": "rollDefense / axisFace_positive / axisFace_at_most_six",
            "equation": f"v = ({axes['X']},{axes['Y']},{axes['Z']},{axes['W']}) ∈ [1,6]⁴",
            "steps": [
                _trace_step("SEED", f"ι={after['seed']} · cycle={after['cycle']} · rank={after['interruptedLayer']['rank']}"),
                _trace_step("AXES", f"X={axes['X']} · Y={axes['Y']} · Z={axes['Z']} · W={axes['W']}"),
                _trace_step("PROJECT", planes),
                _trace_step("IMPACT", f"I = r + X + Y + Z + W = {roll['impact']}"),
            ],
            "result": f"IMPACT {roll['impact']}",
            "verdict": "PROJECT",
        }

    if action == "select_plane":
        selected = after["selectedPlane"]
        axes = after["defenseRoll"]["axes"]
        power = next(
            item["power"] for item in after["defenseRoll"]["planes"]
            if item["id"] == selected
        )
        complements = {
            "XY": "ZW", "XZ": "YW", "XW": "YZ",
            "YZ": "XW", "YW": "XZ", "ZW": "XY",
        }
        complement = complements[selected]
        complement_power = next(
            item["power"] for item in after["defenseRoll"]["planes"]
            if item["id"] == complement
        )
        return common | {
            "engine": "HOST GATE / awaiting Lean confirmation",
            "scene": "projection",
            "relation": f"π{selected}(v) = {selected[0]} + {selected[1]} = {power}",
            "signals": [
                _signal(selected[0], f"ОСЬ {selected[0]}", axes[selected[0]]),
                _signal(selected[1], f"ОСЬ {selected[1]}", axes[selected[1]]),
                _signal(f"π{selected}", "ВЫБРАНО", power),
                _signal(f"π{complement}", "ОТКРЫТО", complement_power, "hold"),
            ],
            "title": "Выбор проекции",
            "theorem": "HOST SELECTION / no Lean transition",
            "equation": f"π := {selected}; power(π) = {power}",
            "steps": [
                _trace_step("OBSERVE", f"доступные плоскости = XY,XZ,XW,YZ,YW,ZW"),
                _trace_step("SELECT", f"π = {selected}"),
                _trace_step("HOLD", "damage′ = damage; memory′ = memory", "hold"),
                _trace_step("GATE", "защита ждёт отдельный вызов defense-resolve", "wait"),
            ],
            "result": f"SELECTED {selected}",
            "verdict": "WAIT / CONFIRM",
        }

    if action == "confirm_defense":
        defense = after["defense"]
        attack = before["continuity"]["pendingAttack"]
        reaction = after["continuity"]["lastReaction"]
        return common | {
            "scene": "conservation",
            "relation": "I = π(v) + (r + π⊥(v))",
            "signals": [
                _signal("I", "ИМПУЛЬС", after["defenseRoll"]["impact"]),
                _signal("π", f"ПОГЛОЩЕНО / {defense['plane']}", defense["absorbed"]),
                _signal("π⊥", f"ОТКРЫТО / {defense['complementPlane']}", defense["complementPower"], "hold"),
                _signal("d", "ПРОБИТИЕ", defense["damage"], "warn"),
            ],
            "title": "Разложение импульса и реакция",
            "theorem": "defense_conserves_impact ∧ full_block_impossible",
            "equation": f"I={after['defenseRoll']['impact']} = absorbed {defense['absorbed']} + damage {defense['damage']}",
            "steps": [
                _trace_step("PROJECT", f"π={defense['plane']} / π⊥={defense['complementPlane']}"),
                _trace_step("CONSERVE", f"{defense['absorbed']} + {defense['damage']} = {after['defenseRoll']['impact']}"),
                _trace_step("NONZERO", f"damage={defense['damage']} ≥ 1"),
                _trace_step("PARENT", f"REACTION parent h{reaction['parentHead']} = CONTACT h{attack['head']}"),
                _trace_step("APPEND", f"PLAYER/REACTION · Σ{reaction['epoch']} → h{reaction['head']}"),
            ],
            "result": f"DAMAGE {defense['damage']}",
            "verdict": reaction["verdict"],
        }

    if action == "surrender":
        session = after["surrenders"][-1]
        memory = after["living"]["memory"]
        return common | {
            "scene": "memory",
            "relation": "τ′ = τ + χ; ρ = max(q′) − min(q′)",
            "signals": [
                _signal("χ", "ЗАРЯД СЕССИИ", session["tensionGained"]),
                _signal("τ", "БЫЛО", before["internalTension"]),
                _signal("τ′", "СТАЛО", after["internalTension"]),
                _signal("ρ", "РЕФЛЕКСИЯ", after["living"]["reflection"]),
            ],
            "title": "Перенос сессии в память",
            "theorem": "every_session_increases_tension ∧ every_session_grows_memory",
            "equation": f"τ′ = {before['internalTension']} + ({before['confirmedTicks']} + {before['defense']['damage']} + 1) = {after['internalTension']}",
            "steps": [
                _trace_step("CHARGE", f"χ = ticks + damage + 1 = {session['tensionGained']}"),
                _trace_step("TENSION", f"τ: {before['internalTension']} ↦ {after['internalTension']}"),
                _trace_step("MEMORY", f"q′ = ({memory['X']},{memory['Y']},{memory['Z']},{memory['W']})"),
                _trace_step("REFLECT", f"ρ = max(q′)-min(q′) = {after['living']['reflection']}"),
                _trace_step("RETURN", "active line → Sh(D); identity preserved"),
            ],
            "result": f"CYCLE {after['cycle']} / τ={after['internalTension']}",
            "verdict": "COMMIT",
        }

    if action == "first_strike":
        attack = after["continuity"]["pendingAttack"]
        strike = after["firstStrike"]
        return common | {
            "scene": "attack",
            "relation": "d = ticks + τ + ρ",
            "signals": [
                _signal("t", "ТИКИ", strike["confirmedTicks"]),
                _signal("τ", "НАПРЯЖЕНИЕ", strike["previousTension"]),
                _signal("ρ", "РЕФЛЕКСИЯ", strike["reflection"]),
                _signal("d", "ИМПУЛЬС", strike["damage"], "warn"),
            ],
            "title": "Сертификация первого контакта",
            "theorem": "firstStrikeDamage ∧ combat_admissible_iff",
            "equation": f"d = ticks + τ + ρ = {strike['confirmedTicks']} + {strike['previousTension']} + {strike['reflection']} = {strike['damage']}",
            "steps": [
                _trace_step("GUARD", f"ticks>0 ∧ τ>0 ∧ unused = true"),
                _trace_step("REDUCE", f"firstStrikeDamage ↦ {strike['damage']}"),
                _trace_step("APPEND", f"PLAYER/CONTACT · Σ{attack['epoch']} · parent h{attack['parentHead']}"),
                _trace_step("HOLD DAMAGE", f"enemyDamage = {after['enemyDamage']}; ждём WORLD/REACTION", "wait"),
            ],
            "result": f"PENDING CONTACT {strike['damage']}",
            "verdict": "APPEND / WAIT",
        }

    if action == "world_reaction":
        attack = before["continuity"]["pendingAttack"]
        reaction = after["continuity"]["lastReaction"]
        event = after["worldEvent"]
        return common | {
            "scene": "reaction",
            "eventForm": event["form"],
            "relation": f"HP′ = HP − d + κ[{event['form']}]",
            "signals": [
                _signal("d", "ВХОД", event["rawDamage"], "warn"),
                _signal("β", "ЩИТ ПОГЛОТИЛ", event["absorbed"], "hold"),
                _signal("κ", event["form"], event["power"]),
                _signal("HP′", "ЖИЗНЬ МИРА", event["after"]["life"]),
            ],
            "title": event["title"],
            "theorem": "direct_reaction_admitted ∧ resolved_life_bounded",
            "equation": f"HP: {event['before']['life']} − {event['directDamage']} + {event['healing']} − {event['backlash']} = {event['after']['life']}",
            "steps": [
                _trace_step("OBSERVE", f"CONTACT Σ{attack['epoch']} / h{attack['head']}"),
                _trace_step("SHIELD", f"{event['rawDamage']} = absorbed {event['absorbed']} + direct {event['directDamage']}"),
                _trace_step("COMPENSATE", f"κ={event['form']} · power={event['power']} · reserve cost={event['reserveCost']}"),
                _trace_step("ALLOSTATIC COST", f"load: {event['before']['load']} → {event['after']['load']}", "hold"),
                _trace_step("APPEND", f"WORLD/REACTION Σ{reaction['epoch']} → h{reaction['head']}"),
            ],
            "result": f"WORLD HP {event['after']['life']} / {event['after']['maxLife']}",
            "verdict": reaction["verdict"],
        }

    if action == "choose_protocol":
        protocol = after["progression"]["activeProtocol"]
        return common | {
            "scene": "progress",
            "relation": "Chronicle + choice -> Protocol",
            "signals": [
                _signal("K", "ОТКРЫТО ФОРМ", len(after["progression"]["discovered"])),
                _signal("M", "МАСТЕРСТВО", after["progression"]["masteryMarks"]),
                _signal("P", "ПРОТОКОЛ", protocol["id"]),
            ],
            "title": "Допуск первого Протокола",
            "theorem": "protocol_unlock_preserves_chronicle",
            "equation": f"K′=K; M′=M; P={protocol['id']}",
            "steps": [
                _trace_step("OBSERVE", "первая форма уже записана в Хронике"),
                _trace_step("CHOOSE", protocol["title"]),
                _trace_step("PRESERVE", "открытия и отметки не переписаны"),
                _trace_step("ADMIT", "информационный Протокол активен"),
            ],
            "result": protocol["title"].upper(),
            "verdict": "UNLOCKED",
        }

    if action == "reset":
        return common | {
            "engine": "HOST SESSION / Lean-authoritative world",
            "boundary": "SESSION RESET TRACE / NOT PRIVATE REASONING",
            "scene": "reset",
            "relation": "World(ι) ↦ Genesis(ι)",
            "signals": [
                _signal("Σ", "ПРЕЖНИЙ ЦИКЛ", before["cycle"], "hold"),
                _signal("ι", "КОД МИРА", after["seed"]),
                _signal("r₀", "НАЧАЛЬНЫЙ РАНГ", "r1"),
                _signal("C₀", "СЕРТИФИКАТ", "C0"),
            ],
            "title": "Пересоздание локального Мира",
            "theorem": "WorldGame.init / genesis",
            "equation": f"ι={after['seed']}; cycle=1; rank=1; C=0",
            "steps": [
                _trace_step("CLOSE", f"cycle {before['cycle']} → Sh(D)", "hold"),
                _trace_step("SEED", f"identity ι := {after['seed']}"),
                _trace_step("GENESIS", "manifest imba / r1 / tick 0"),
                _trace_step("CERTIFY", "C0 · PREFIX GUARD / OK"),
            ],
            "result": f"WORLD {after['seed']} / CYCLE 1",
            "verdict": "GENESIS",
        }

    return common | {
        "scene": "transition",
        "relation": f"{before['status']} → {after['status']}",
        "signals": [
            _signal("σ", "БЫЛО", before["status"]),
            _signal("σ′", "СТАЛО", after["status"]),
        ],
        "title": "Проверка перехода",
        "theorem": "state_transition",
        "equation": f"{before['status']} → {after['status']}",
        "steps": [_trace_step("STATE", f"status′ = {after['status']}")],
        "result": after["status"].upper(),
        "verdict": "DONE",
    }


class GameSession:
    """Thread-safe owner of one player's run."""

    def __init__(self, core: CoreClient, seed: int) -> None:
        version = core.ping()
        if version != "0.1":
            raise CoreError(f"unsupported core protocol {version!r}")
        self.core = core
        self.lock = threading.RLock()
        self.game = WorldGame(core, seed)

    def state(self) -> dict[str, Any]:
        with self.lock:
            return snapshot(self.game)

    def reset(self, seed: int) -> dict[str, Any]:
        with self.lock:
            before = snapshot(self.game)
            progress = ProgressState(
                discovery_mask=self.game.state.progression.discovery_mask,
                protocol_mask=self.game.state.progression.protocol_mask,
                mastery_marks=self.game.state.progression.mastery_marks,
                pending_choice=self.game.state.progression.pending_choice,
            )
            self.game = WorldGame(self.core, seed, progression=progress)
            after = snapshot(self.game)
            after["calculation"] = _calculation("reset", before, after)
            return after

    def act(self, request: Mapping[str, object]) -> dict[str, Any]:
        action = _text(request.get("action"), "action")
        with self.lock:
            before = snapshot(self.game)
            if action == "tick":
                self.game.tick()
            elif action == "cast_spell":
                self.game.cast_spell(
                    _text(request.get("source"), "source"),
                    _text(request.get("intent"), "intent"),
                    _text(request.get("path"), "path"),
                    _text(request.get("form", "DORMANT"), "form"),
                )
            elif action == "surrender":
                self.game.surrender()
            elif action == "roll_defense":
                self.game.roll_defense()
            elif action == "select_plane":
                self.game.select_plane(_text(request.get("plane"), "plane"))
            elif action == "confirm_defense":
                self.game.confirm_defense()
            elif action == "first_strike":
                self.game.first_strike()
            elif action == "world_reaction":
                self.game.world_reaction()
            elif action == "choose_protocol":
                self.game.choose_protocol(_text(request.get("protocol"), "protocol"))
            else:
                raise ValueError(f"unknown action {action!r}")
            after = snapshot(self.game)
            after["calculation"] = _calculation(action, before, after)
            return after


@dataclass
class _StoredSession:
    game: GameSession
    touched_at: float


class SessionStore:
    """Bounded, expiring collection of independent browser game sessions.

    The store owns no game rules. Each session still delegates every formal
    decision to the authoritative Lean executable.
    """

    _TOKEN = re.compile(r"^[A-Za-z0-9_-]{32,128}$")

    def __init__(
        self,
        core_command: str,
        seed: int,
        *,
        ttl_seconds: int = 43_200,
        max_sessions: int = 1_000,
    ) -> None:
        if ttl_seconds <= 0:
            raise ValueError("session TTL must be positive")
        if max_sessions <= 0:
            raise ValueError("maximum sessions must be positive")
        probe = CoreClient(core_command)
        version = probe.ping()
        if version != "0.1":
            raise CoreError(f"unsupported core protocol {version!r}")
        self.core_command = core_command
        self.seed = seed
        self.ttl_seconds = ttl_seconds
        self.max_sessions = max_sessions
        self.lock = threading.RLock()
        self._sessions: dict[str, _StoredSession] = {}

    def _cleanup_expired(self, now: float) -> None:
        expired = [
            token for token, stored in self._sessions.items()
            if now - stored.touched_at >= self.ttl_seconds
        ]
        for token in expired:
            del self._sessions[token]

    def _make_room(self) -> None:
        while len(self._sessions) >= self.max_sessions:
            oldest = min(
                self._sessions,
                key=lambda item: self._sessions[item].touched_at,
            )
            del self._sessions[oldest]

    def get(self, token: str | None) -> tuple[str, GameSession, bool]:
        now = time.monotonic()
        with self.lock:
            self._cleanup_expired(now)
            if token is not None and self._TOKEN.fullmatch(token):
                stored = self._sessions.get(token)
                if stored is not None:
                    stored.touched_at = now
                    return token, stored.game, False
            self._make_room()
            token = secrets.token_urlsafe(32)
            game = GameSession(CoreClient(self.core_command), self.seed)
            self._sessions[token] = _StoredSession(game=game, touched_at=now)
            return token, game, True

    def count(self) -> int:
        with self.lock:
            return len(self._sessions)


class ImbaServer(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 64
    sessions: SessionStore
    cookie_secure: bool
    allowed_origin: str


class ImbaHandler(BaseHTTPRequestHandler):
    server: ImbaServer
    server_version = "ImbaCore/0.3"
    sys_version = ""

    def _session(self) -> GameSession:
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except CookieError:
            cookie = SimpleCookie()
        morsel = cookie.get("imba_session")
        supplied = morsel.value if morsel is not None else None
        token, session, created = self.server.sessions.get(supplied)
        if created:
            secure = "; Secure" if self.server.cookie_secure else ""
            self._set_cookie = (
                f"imba_session={token}; Path=/; HttpOnly; SameSite=Lax{secure}"
            )
        return session

    def _headers(self, status: int) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        origin = self.headers.get("Origin", "")
        if self.server.allowed_origin and origin == self.server.allowed_origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if hasattr(self, "_set_cookie"):
            self.send_header("Set-Cookie", self._set_cookie)

    def _send(self, value: object, status: int = 200) -> None:
        body = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
        self._headers(status)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _request(self) -> Mapping[str, object]:
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError as exc:
            raise ValueError("invalid content length") from exc
        if length > 64_000:
            raise ValueError("request is too large")
        try:
            value = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError as exc:
            raise ValueError("request body must be JSON") from exc
        if not isinstance(value, dict):
            raise ValueError("request body must be an object")
        return value

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._headers(204)
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/api/state":
            self._send({"ok": True, "state": self._session().state()})
        elif path == "/api/health":
            self._send({
                "ok": True,
                "protocol": "0.3",
                "engine": "Lean 4 / imba-core",
                "sessions": self.server.sessions.count(),
            })
        else:
            self._send({"ok": False, "error": "not found"}, 404)

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path not in {"/api/action", "/api/reset"}:
            self._send({"ok": False, "error": "not found"}, 404)
            return
        session = self._session()
        try:
            request = self._request()
            if path == "/api/action":
                state = session.act(request)
            else:
                state = session.reset(
                    _integer(request.get("seed"), "seed")
                )
            self._send({"ok": True, "state": state})
        except (CoreError, OSError, ValueError) as exc:
            self._send(
                {
                    "ok": False,
                    "error": str(exc),
                    "state": session.state(),
                },
                400,
            )

    def log_message(self, format: str, *args: object) -> None:
        print(f"imba-web: {format % args}")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="HTTP bridge for the Imba UI")
    result.add_argument("--core", default=os.environ.get("IMBA_CORE", "imba-core"))
    result.add_argument("--seed", type=int, default=int(os.environ.get("IMBA_SEED", "20260813")))
    result.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    result.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8765")))
    result.add_argument("--session-ttl", type=int, default=int(os.environ.get("IMBA_SESSION_TTL", "43200")))
    result.add_argument("--max-sessions", type=int, default=int(os.environ.get("IMBA_MAX_SESSIONS", "1000")))
    return result


def main() -> int:
    options = parser().parse_args()
    server = ImbaServer((options.host, options.port), ImbaHandler)
    server.sessions = SessionStore(
        options.core,
        options.seed,
        ttl_seconds=options.session_ttl,
        max_sessions=options.max_sessions,
    )
    server.cookie_secure = os.environ.get("IMBA_COOKIE_SECURE", "0") == "1"
    server.allowed_origin = os.environ.get("IMBA_ALLOWED_ORIGIN", "")
    print(f"Imba Lean API: http://{options.host}:{options.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
