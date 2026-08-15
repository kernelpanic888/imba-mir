"""Test double for the Lean executable.  Never imported by production code."""

from __future__ import annotations

import json
import operator
import sys


def emit(value: dict[str, object], status: int = 0) -> None:
    print(json.dumps(value, separators=(",", ":")))
    raise SystemExit(status)


def natural(text: str) -> int:
    if not text.isascii() or not text.isdigit():
        raise ValueError("must be a natural number")
    return int(text)


def main(args: list[str]) -> None:
    try:
        command, rest = args[0], args[1:]
        if command == "ping" and not rest:
            emit({"ok": True, "op": "ping", "version": "0.1"})
        if command == "name" and len(rest) == 1:
            rank = natural(rest[0])
            emit({"ok": True, "op": "name", "rank": rank, "name": f"rank-{rank}"})
        if command == "beats" and len(rest) == 2:
            attacker, defender = map(natural, rest)
            result = operator.gt(attacker, defender)
            emit(
                {
                    "ok": True,
                    "op": "beats",
                    "attacker": attacker,
                    "defender": defender,
                    "result": result,
                    "reason": "test-double authority decision",
                }
            )
        if command == "fuse" and len(rest) == 2:
            left, right = map(natural, rest)
            allowed = operator.eq(left, right)
            emit(
                {
                    "ok": True,
                    "op": "fuse",
                    "left": left,
                    "right": right,
                    "allowed": allowed,
                    "rank": left + 1 if allowed else None,
                    "name": f"rank-{left + 1}" if allowed else None,
                    "reason": "test-double authority decision",
                }
            )
        if command == "promote" and len(rest) == 2:
            rank, delta = map(natural, rest)
            result = rank + delta
            emit(
                {
                    "ok": True,
                    "op": "promote",
                    "rank": rank,
                    "delta": delta,
                    "result": result,
                    "name": f"rank-{result}",
                }
            )
        if command in {"defense-roll", "defense-resolve"} and len(rest) in {3, 4}:
            seed, cycle, interrupted_rank = map(natural, rest[:3])
            def face(salt: int) -> int:
                return (
                    seed * 1664525
                    + cycle * 1013904223
                    + interrupted_rank * 69069
                    + salt * 362437
                ) % 6 + 1
            x, y, z, w = (face(index) for index in range(4))
            planes = {
                "XY": x + y, "XZ": x + z, "XW": x + w,
                "YZ": y + z, "YW": y + w, "ZW": z + w,
            }
            complements = {"XY": "ZW", "XZ": "YW", "XW": "YZ", "YZ": "XW", "YW": "XZ", "ZW": "XY"}
            impact = interrupted_rank + x + y + z + w
            fields: dict[str, object] = {
                "ok": True,
                "op": command,
                "seed": seed,
                "cycle": cycle,
                "interruptedRank": interrupted_rank,
                "impact": impact,
                "x": x, "y": y, "z": z, "w": w,
                **{key.lower(): value for key, value in planes.items()},
            }
            if command == "defense-roll" and len(rest) == 3:
                emit(fields)
            if command == "defense-resolve" and len(rest) == 4:
                plane = rest[3].upper()
                if plane not in planes:
                    emit({"ok": False, "error": "bad plane"}, 2)
                complement = complements[plane]
                damage = interrupted_rank + planes[complement]
                fields.update({
                    "plane": plane,
                    "planePower": planes[plane],
                    "complementPlane": complement,
                    "complementPower": planes[complement],
                    "absorbed": planes[plane],
                    "damage": damage,
                    "fullyBlocked": False,
                    "reason": "test-double defense decision",
                })
                emit(fields)
        if command == "first-strike" and len(rest) == 4:
            ticks, tension, reflection, used = map(natural, rest)
            if used not in {0, 1}:
                emit({"ok": False, "error": "already used must be 0 or 1"}, 2)
            allowed = ticks > 0 and tension > 0 and used == 0
            emit({
                "ok": True,
                "op": "first-strike",
                "confirmedTicks": ticks,
                "previousTension": tension,
                "reflection": reflection,
                "alreadyUsed": used == 1,
                "allowed": allowed,
                "damage": ticks + tension + reflection if allowed else 0,
                "reason": "test-double initiative decision",
            })
        if command == "tension-carry" and len(rest) == 3:
            previous, ticks, damage = map(natural, rest)
            gained = ticks + damage + 1
            emit({
                "ok": True,
                "op": "tension-carry",
                "previousTension": previous,
                "confirmedTicks": ticks,
                "natureDamage": damage,
                "gained": gained,
                "result": previous + gained,
                "reason": "test-double tension decision",
            })
        if command == "living-admit" and len(rest) == 7:
            x, y, z, w, ticks, damage = map(natural, rest[:6])
            plane = rest[6].upper()
            complements = {"XY": "ZW", "XZ": "YW", "XW": "YZ", "YZ": "XW", "YW": "XZ", "ZW": "XY"}
            if plane not in complements:
                emit({"ok": False, "error": "bad plane"}, 2)
            charge = ticks + damage + 1
            memory = {"X": x, "Y": y, "Z": z, "W": w}
            for axis in complements[plane]:
                memory[axis] += charge
            values = list(memory.values())
            emit({
                "ok": True, "op": "living-admit",
                **{key.lower(): value for key, value in memory.items()},
                "charge": charge, "total": sum(values),
                "reflection": max(values) - min(values),
                "complementPlane": complements[plane],
                "prefixGuard": True,
                "reason": "test-double living-state decision",
            })
        if command == "certificate-admit" and len(rest) == 4:
            identity, certificate, current, next_rank = map(natural, rest)
            admitted = next_rank == current + 1
            emit({
                "ok": True, "op": "certificate-admit",
                "identity": identity,
                "certificate": certificate + 1 if admitted else certificate,
                "rank": next_rank,
                "admitted": admitted,
                "prefixGuard": admitted,
                "reason": "test-double certificate decision",
            })
        if command == "tick-stage" and len(rest) == 3:
            ticks, rank, certificate = map(natural, rest)
            emit({
                "ok": True,
                "op": "tick-stage",
                "currentTicks": ticks,
                "pendingTick": ticks + 1,
                "currentRank": rank,
                "heldRank": rank,
                "certificate": certificate,
                "heldCertificate": certificate,
                "transitioned": False,
                "reason": "test-double staged tick hold",
            })
        if command == "combat-admit" and len(rest) == 8:
            identity, current_epoch, current_head, candidate_epoch, parent_head = map(
                natural, rest[:5]
            )
            actor, kind = rest[5].upper(), rest[6].upper()
            payload = natural(rest[7])
            if actor not in {"PLAYER", "NATURE", "WORLD"}:
                emit({"ok": False, "error": "bad combat actor"}, 2)
            if kind not in {"ATTACK", "REACTION"}:
                emit({"ok": False, "error": "bad combat kind"}, 2)
            actor_code = {"PLAYER": 1, "NATURE": 2, "WORLD": 3}[actor]
            kind_code = {"ATTACK": 1, "REACTION": 2}[kind]
            proposed_head = (
                (parent_head + 1) * 131
                + identity * 17
                + candidate_epoch * 31
                + actor_code * 13
                + kind_code * 7
                + payload * 19
            )
            admitted = candidate_epoch == current_epoch + 1 and parent_head == current_head
            emit({
                "ok": True,
                "op": "combat-admit",
                "identity": identity,
                "currentEpoch": current_epoch,
                "currentHead": current_head,
                "candidateEpoch": candidate_epoch,
                "parentHead": parent_head,
                "actor": actor,
                "kind": kind,
                "payload": payload,
                "proposedHead": proposed_head,
                "admitted": admitted,
                "resultEpoch": candidate_epoch if admitted else current_epoch,
                "resultHead": proposed_head if admitted else current_head,
                "verdict": "APPEND" if admitted else "HOLD",
                "reason": "test-double combat continuity decision",
            })
        if command == "world-react" and len(rest) == 9:
            identity, cycle, epoch, life, max_life, reserve, load, shield, damage = map(
                natural, rest
            )
            power = (identity * 17 + cycle * 31 + epoch * 13 + damage * 7) % 6 + 1
            if load >= 18 or reserve == 0:
                form = "OVERLOAD"
            else:
                slot = (identity + cycle * 7 + epoch * 11 + damage * 3) % 4
                form = ("REGENERATION", "BARRIER", "REDISTRIBUTION", "SCAR")[slot]
            absorbed = min(damage, shield)
            direct = damage - absorbed
            base_life = max(0, life - direct)
            next_shield = shield - absorbed
            healing = reserve_cost = backlash = 0
            next_max, next_life, next_reserve, next_load = max_life, base_life, reserve, load
            if form == "REGENERATION":
                reserve_cost = min(reserve, power)
                healing = min(max_life - base_life, power + reserve_cost)
                next_life = base_life + healing
                next_reserve = reserve - reserve_cost
                next_load = load + 2
            elif form == "BARRIER":
                reserve_cost = min(reserve, power)
                next_reserve = reserve - reserve_cost
                next_load = load + 1
                next_shield += power + 2
            elif form == "REDISTRIBUTION":
                next_reserve = min(30, reserve + power * 2)
                next_load = load + 1
                next_shield += power // 2
            elif form == "SCAR":
                reserve_cost = min(reserve, power + 1)
                next_max = max(0, max_life - 1)
                next_life = min(base_life, next_max)
                next_reserve = reserve - reserve_cost
                next_load = load + 3
                next_shield += power * 2
            else:
                backlash = power + load // 6
                next_life = max(0, base_life - backlash)
                next_load = load + power
            titles = {
                "REGENERATION": "Регенеративный всплеск",
                "BARRIER": "Адаптивный барьер",
                "REDISTRIBUTION": "Перераспределение потока",
                "SCAR": "Рубцовая броня",
                "OVERLOAD": "Аллостатическая перегрузка",
            }
            emit({
                "ok": True, "op": "world-react",
                "identity": identity, "cycle": cycle, "epoch": epoch,
                "eventClass": "COMPENSATION", "form": form, "title": titles[form],
                "power": power, "rawDamage": damage, "absorbed": absorbed,
                "directDamage": direct, "healing": healing,
                "reserveCost": reserve_cost, "backlash": backlash,
                "beforeLife": life, "beforeMaxLife": max_life,
                "beforeReserve": reserve, "beforeLoad": load, "beforeShield": shield,
                "life": min(next_life, next_max), "maxLife": next_max,
                "reserve": next_reserve, "load": next_load, "shield": next_shield,
                "reason": "test-double living-World compensation decision",
            })
        if command == "progress-observe" and len(rest) == 4:
            discoveries, protocols, marks = map(natural, rest[:3])
            form = rest[3].upper()
            bits = {"REGENERATION": 1, "BARRIER": 2, "REDISTRIBUTION": 4, "SCAR": 8, "OVERLOAD": 16}
            if form not in bits:
                emit({"ok": False, "error": "bad compensation form"}, 2)
            fresh = discoveries // bits[form] % 2 == 0
            next_discoveries = discoveries + bits[form] if fresh else discoveries
            next_marks = marks + 1 if fresh else marks
            emit({
                "ok": True, "op": "progress-observe", "form": form,
                "discoveryMask": next_discoveries, "protocolMask": protocols,
                "masteryMarks": next_marks, "newDiscovery": fresh,
                "pendingChoice": protocols == 0 and next_marks > 0,
                "reason": "test-double Chronicle observation",
            })
        if command == "progress-unlock" and len(rest) == 4:
            discoveries, protocols, marks = map(natural, rest[:3])
            protocol = rest[3].upper()
            bits = {"FORECAST": 1, "REFRACTION": 2}
            if protocol not in bits:
                emit({"ok": False, "error": "bad progress protocol"}, 2)
            allowed = discoveries > 0 and protocols == 0
            emit({
                "ok": True, "op": "progress-unlock", "protocol": protocol,
                "protocolTitle": "Предвестник" if protocol == "FORECAST" else "Преломление",
                "discoveryMask": discoveries,
                "protocolMask": bits[protocol] if allowed else protocols,
                "masteryMarks": marks, "allowed": allowed,
                "pendingChoice": False if allowed else protocols == 0 and marks > 0,
                "reason": "test-double protocol unlock",
            })
        if command in {"spell-law", "spell-cast"} and len(rest) in {6, 10}:
            identity, cycle, pending_tick, rank, certificate, mastery_marks = map(natural, rest[:6])
            term_data = {
                "WILL": ("Собери волю", 2, 1, 0),
                "SHADOW": ("Извлеки тень", 1, 2, 1),
                "MEMORY": ("Вспомни прежнюю форму", 0, 2, 2),
                "SPARK": ("Высеки живую искру", 3, 0, 1),
                "RELEASE": ("ослабь заклятие", 2, 0, 1),
                "REVEAL": ("раскрой его закон", 1, 2, 0),
                "BIND": ("свяжи разрыв", 1, 2, 1),
                "INVERT": ("обрати давление", 2, 1, 1),
                "ROAD": ("проведи зелёной дорогой", 1, 1, 2),
                "ECHO": ("верни изумрудным эхом", 2, 1, 0),
                "RIFT": ("рассеки через разлом", 3, 0, 1),
                "ORBIT": ("замкни по живой орбите", 0, 2, 2),
                "DORMANT": ("без внешней формы", 0, 0, 0),
                "BLADE": ("собери изумрудным лезвием", 2, 0, 1),
                "VEIL": ("укрой теневым покровом", 0, 2, 1),
                "PRISM": ("преломи живой призмой", 1, 1, 2),
            }
            prefixes = {
                "WILL": "will", "SHADOW": "shadow", "MEMORY": "memory", "SPARK": "spark",
                "RELEASE": "release", "REVEAL": "reveal", "BIND": "bind", "INVERT": "invert",
                "ROAD": "road", "ECHO": "echo", "RIFT": "rift", "ORBIT": "orbit",
                "DORMANT": "dormant", "BLADE": "blade", "VEIL": "veil", "PRISM": "prism",
            }
            form_required = certificate >= 4
            synergy_required = certificate >= 8
            meta_tier = 1 if mastery_marks >= 3 else 0
            complexity = 3 if synergy_required else 2 if form_required else 1
            needs = (6, 5, 4) if synergy_required else (5, 4, 3) if form_required else (4, 3, 2)
            pressure = ("FORCE", "COHERENCE", "RESONANCE")[
                (identity + cycle * 3 + pending_tick * 5 + rank * 7 + certificate) % 3
            ]
            lexicon_variant = (identity + cycle * 3 + pending_tick * 5 + rank * 7 + certificate) % 4
            fields: dict[str, object] = {
                "ok": True, "op": command, "identity": identity, "cycle": cycle,
                "pendingTick": pending_tick, "rank": rank, "certificate": certificate,
                "masteryMarks": mastery_marks,
                "forceNeed": needs[0], "coherenceNeed": needs[1], "resonanceNeed": needs[2],
                "pressure": pressure, "complexity": complexity,
                "formRequired": form_required, "synergyRequired": synergy_required,
                "metaTier": meta_tier,
                "lexiconVariant": lexicon_variant,
            }
            for term_id, (phrase, force, coherence, resonance) in term_data.items():
                prefix = prefixes[term_id]
                fields.update({
                    f"{prefix}Phrase": phrase,
                    f"{prefix}Force": force,
                    f"{prefix}Coherence": coherence,
                    f"{prefix}Resonance": resonance,
                })
            synergy_data = {
                "EDGEWAY": ("Лезвие дороги", 1, 1, 1),
                "UMBRA": ("Сцепление с Тенью", 1, 1, 1),
                "REVELATION": ("Эхо откровения", 0, 1, 2),
                "REMEMBRANCE": ("Память покрова", 0, 2, 2),
                "NOVA": ("Изумрудная нова", 2, 0, 2),
                "RIFTBLADE": ("Лезвие разлома", 2, 1, 0),
            }
            for synergy_id, (title, force, coherence, resonance) in synergy_data.items():
                prefix = synergy_id.lower()
                fields.update({
                    f"{prefix}Title": title,
                    f"{prefix}Force": force,
                    f"{prefix}Coherence": coherence,
                    f"{prefix}Resonance": resonance,
                })
            if command == "spell-law" and len(rest) == 6:
                emit(fields)
            if command == "spell-cast" and len(rest) == 10:
                source, intent, path, form = (value.upper() for value in rest[6:])
                if source not in {"WILL", "SHADOW", "MEMORY", "SPARK"} or intent not in {"RELEASE", "REVEAL", "BIND", "INVERT"} or path not in {"ROAD", "ECHO", "RIFT", "ORBIT"} or form not in {"DORMANT", "BLADE", "VEIL", "PRISM"}:
                    emit({"ok": False, "error": "bad spell term"}, 2)
                synergy = "NONE"
                if form == "VEIL" and source == "MEMORY" and path == "ECHO":
                    synergy = "REMEMBRANCE"
                elif form == "PRISM" and source == "SPARK" and path == "ORBIT":
                    synergy = "NOVA"
                elif form == "BLADE" and intent == "INVERT" and path == "RIFT":
                    synergy = "RIFTBLADE"
                elif form != "DORMANT" and form == "BLADE" and path == "ROAD":
                    synergy = "EDGEWAY"
                elif form != "DORMANT" and form == "VEIL" and source == "SHADOW":
                    synergy = "UMBRA"
                elif form != "DORMANT" and intent == "REVEAL" and path == "ECHO":
                    synergy = "REVELATION"
                synergy_term = synergy_data.get(synergy, ("Нет синергии", 0, 0, 0))
                multiplier = 2 if meta_tier else 1
                selected = [term_data[source], term_data[intent], term_data[path], term_data[form]]
                force = sum(term[1] for term in selected)
                coherence = sum(term[2] for term in selected)
                resonance = sum(term[3] for term in selected)
                force += synergy_term[1] * multiplier
                coherence += synergy_term[2] * multiplier
                resonance += synergy_term[3] * multiplier
                checks = (force >= needs[0], coherence >= needs[1], resonance >= needs[2])
                deficit = max(0, needs[0] - force) + max(0, needs[1] - coherence) + max(0, needs[2] - resonance)
                source_ids = ("WILL", "SHADOW", "MEMORY", "SPARK")
                intent_ids = ("RELEASE", "REVEAL", "BIND", "INVERT")
                path_ids = ("ROAD", "ECHO", "RIFT", "ORBIT")
                terms_allowed = (
                    source_ids.index(source) != lexicon_variant
                    and intent_ids.index(intent) != (lexicon_variant + 1) % 4
                    and path_ids.index(path) != (lexicon_variant + 2) % 4
                )
                structure_ok = terms_allowed and form_required == (form != "DORMANT") and (not synergy_required or synergy != "NONE")
                outcome = "APPEND" if structure_ok and all(checks) else "APPEND_WITH_COST" if structure_ok and deficit == 1 else "HOLD"
                admitted = outcome != "HOLD"
                fields.update({
                    "source": source, "sourcePhrase": term_data[source][0],
                    "intent": intent, "intentPhrase": term_data[intent][0],
                    "path": path, "pathPhrase": term_data[path][0],
                    "form": form, "formPhrase": term_data[form][0],
                    "synergy": synergy, "synergyTitle": synergy_term[0],
                    "synergyForce": synergy_term[1],
                    "synergyCoherence": synergy_term[2],
                    "synergyResonance": synergy_term[3],
                    "force": force, "coherence": coherence, "resonance": resonance,
                    "forceOk": checks[0], "coherenceOk": checks[1], "resonanceOk": checks[2],
                    "outcome": outcome, "admitted": admitted,
                    "cost": 1 if outcome == "APPEND_WITH_COST" else 0,
                    "preservesIdentity": admitted, "extendsCertificate": admitted,
                    "reason": "test-double spell morphism decision",
                })
                emit(fields)
        if command == "journey" and len(rest) == 2:
            identity, certificate = map(natural, rest)
            distance = 12
            bricks = certificate
            remaining = max(0, distance - bricks)
            troubles = (
                ("FALSE_STEP", "Ложный шаг", "Замок подмешивает в путь переход без допустимого интерфейса."),
                ("EMERALD_FOG", "Изумрудный туман", "Волшебник скрывает часть закона, но не может изменить его после выбора."),
                ("TICK_LEECH", "Пожиратель тиков", "Беда давит на накопленное время и требует точной связности."),
                ("AXIS_SHIFT", "Сдвиг осей", "Оси Мира смещены; прежняя очевидная проекция больше не надёжна."),
                ("MIRROR_DOUBLE", "Зеркальный двойник", "Замок возвращает прошлую форму игрока как чужое отражение."),
                ("ROAD_DEBT", "Долг дороги", "Следующий шаг по дороге требует объявленной цены, а не бесплатного чуда."),
            )
            trouble = troubles[(identity + bricks * 7) % 6] if bricks else None
            chapter = (
                "0 / ОБУЧЕНИЕ" if bricks == 0 else
                "I / ДОРОГА ПРОСЫПАЕТСЯ" if bricks < 4 else
                "I / КОНФЛИКТ: МИР ЕСТЬ МАГИЯ" if bricks == 4 else
                "АВТОРСКИЙ РУБЕЖ / ГЛАВА I"
            )
            emit({
                "ok": True, "op": "journey", "identity": identity,
                "certificate": certificate, "roadBricks": bricks,
                "castleDistance": distance, "curseRemaining": remaining,
                "chapter": chapter, "castleReached": bricks >= distance,
                "firstChapterDistance": 4,
                "worldTruthKnown": bricks >= 4,
                "ravenForm": "WORLD_MAGUS" if bricks >= 4 else "CURSED_WALKER",
                "ravenFormTitle": "Ворон — маг Мира" if bricks >= 4 else "Ворон под заклятием",
                "chapterConflict": bricks == 4,
                "revelation": "Мир утверждал, что он не магия. Ворон увидел: каждый его закон сложен из магических морфизмов.",
                "troubleActive": trouble is not None,
                "trouble": trouble[0] if trouble else "NONE",
                "troubleTitle": trouble[1] if trouble else "Замок наблюдает",
                "troubleCopy": trouble[2] if trouble else "Заклятие ещё цело. Первый доказанный переход превратит его фрагмент в дорогу.",
                "troublePower": (identity * 11 + bricks * 5) % 5 + 1 if bricks else 0,
                "reason": "test-double certificate projection",
            })
        emit({"ok": False, "error": "bad test request"}, 2)
    except (IndexError, ValueError) as exc:
        emit({"ok": False, "error": str(exc)}, 2)


if __name__ == "__main__":
    main(sys.argv[1:])
