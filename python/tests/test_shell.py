from __future__ import annotations

import pathlib
import sys
import tempfile
import unittest
from itertools import product

from imba.core import (
    CoreClient,
    CoreExecutionError,
    CoreProtocolError,
    WorldVitalsAnswer,
)
from imba.game import Game
from imba.journal import Journal
from imba.ui import render
from imba.web import GameSession


FAKE = pathlib.Path(__file__).with_name("fake_core.py")


def client() -> CoreClient:
    return CoreClient([sys.executable, str(FAKE)])


class CoreClientTests(unittest.TestCase):
    def test_subprocess_contract(self) -> None:
        core = client()
        self.assertEqual(core.ping(), "0.1")
        self.assertEqual(core.name(7), "rank-7")
        self.assertEqual(core.compare(4, 2), (True, "test-double authority decision"))
        self.assertFalse(core.compare(2, 4)[0])
        fused = core.fuse(3, 3)
        self.assertTrue(fused.allowed)
        self.assertEqual((fused.rank, fused.name), (4, "rank-4"))
        self.assertFalse(core.fuse(2, 3).allowed)
        self.assertEqual(core.promote(8, 5), (13, "rank-13"))
        roll = core.defense_roll(20260813, 1, 3)
        self.assertEqual(roll.axes, {"X": 4, "Y": 5, "Z": 6, "W": 1})
        self.assertEqual(roll.planes["XY"], 9)
        defense = core.defense_resolve(20260813, 1, 3, "XY")
        self.assertEqual(defense.damage, 10)
        self.assertFalse(defense.fully_blocked)
        self.assertEqual(defense.complement_plane, "ZW")
        locked = core.first_strike(2, 0, 0, False)
        self.assertFalse(locked.allowed)
        strike = core.first_strike(2, 5, 3, False)
        self.assertEqual((strike.allowed, strike.damage), (True, 10))
        tension = core.carry_tension(5, 0, 0)
        self.assertEqual((tension.gained, tension.result), (1, 6))
        living = core.living_admit({"X": 0, "Y": 0, "Z": 0, "W": 0}, 1, 2, "XY")
        self.assertEqual(living.memory, {"X": 0, "Y": 0, "Z": 4, "W": 4})
        self.assertEqual(living.reflection, 4)
        certificate = core.admit_tick(17, 3, 4, 5)
        self.assertTrue(certificate.admitted)
        self.assertEqual(certificate.certificate, 4)
        staged = core.stage_tick(3, 4, 9)
        self.assertEqual((staged.pending_tick, staged.held_rank), (4, 4))
        self.assertEqual(staged.held_certificate, 9)
        self.assertFalse(staged.transitioned)
        attack = core.combat_transition(17, 0, 0, "PLAYER", "ATTACK", 9)
        self.assertEqual((attack.verdict, attack.result_epoch), ("APPEND", 1))
        reaction = core.combat_transition(
            17, attack.result_epoch, attack.result_head, "WORLD", "REACTION", 9
        )
        self.assertEqual(reaction.parent_head, attack.result_head)
        rollback = core.combat_admit(
            17, reaction.result_epoch, reaction.result_head,
            reaction.result_epoch, reaction.result_head,
            "NATURE", "ATTACK", 1,
        )
        self.assertEqual((rollback.admitted, rollback.verdict), (False, "HOLD"))
        self.assertEqual(rollback.result_head, reaction.result_head)
        world = core.world_react(
            20260813, 2, 4,
            WorldVitalsAnswer(life=100, max_life=100, reserve=30, load=0, shield=0),
            21,
        )
        self.assertEqual(world.event_class, "COMPENSATION")
        self.assertEqual(world.form, "REDISTRIBUTION")
        self.assertEqual((world.direct_damage, world.after.life, world.after.shield), (21, 79, 1))
        discovered = core.progress_observe(0, 0, 0, world.form)
        self.assertEqual((discovered.discovery_mask, discovered.mastery_marks), (4, 1))
        self.assertTrue(discovered.new_discovery)
        self.assertTrue(discovered.pending_choice)
        repeated = core.progress_observe(4, 0, 1, world.form)
        self.assertEqual((repeated.discovery_mask, repeated.mastery_marks), (4, 1))
        self.assertFalse(repeated.new_discovery)
        protocol = core.progress_unlock(4, 0, 1, "FORECAST")
        self.assertTrue(protocol.allowed)
        self.assertEqual((protocol.protocol_mask, protocol.protocol_title), (1, "Предвестник"))

    def test_all_compensation_forms_share_one_bounded_contract(self) -> None:
        core = client()
        baseline = WorldVitalsAnswer(life=82, max_life=100, reserve=30, load=4, shield=2)
        forms = [core.world_react(identity, 1, 1, baseline, 5) for identity in (3, 0, 1, 2)]
        self.assertEqual(
            [event.form for event in forms],
            ["REGENERATION", "BARRIER", "REDISTRIBUTION", "SCAR"],
        )
        overloaded = core.world_react(
            9, 1, 1,
            WorldVitalsAnswer(life=82, max_life=100, reserve=0, load=18, shield=2),
            5,
        )
        self.assertEqual(overloaded.form, "OVERLOAD")
        for event in [*forms, overloaded]:
            self.assertEqual(event.event_class, "COMPENSATION")
            self.assertEqual(event.absorbed + event.direct_damage, 5)
            self.assertLessEqual(event.after.life, event.after.max_life)

    def test_domain_error_and_bad_json_are_distinct(self) -> None:
        with self.assertRaises(CoreExecutionError):
            client().name(-1)
        invalid = CoreClient([sys.executable, "-c", "print('not-json')"])
        with self.assertRaises(CoreProtocolError):
            invalid.ping()

    def test_hung_core_is_bounded(self) -> None:
        stalled = CoreClient(
            [sys.executable, "-c", "import time; time.sleep(2)"],
            timeout_seconds=0.02,
        )
        with self.assertRaisesRegex(CoreExecutionError, "did not answer"):
            stalled.ping()


class GameTests(unittest.TestCase):
    def test_fusion_and_render_use_core_answer(self) -> None:
        game = Game(client(), 17)
        game.roll()
        self.assertTrue(game.fuse("P1", "P2"))
        self.assertNotIn("P2", game.state.board.pieces)
        self.assertEqual(game.state.board.get("P1").name, "rank-1")
        screen = render(game.state)
        self.assertIn("DICE / RISK", screen)
        self.assertIn("JOURNAL", screen)
        self.assertIn("P1=r1", screen)

    def test_seeded_journal_replays_to_same_state(self) -> None:
        game = Game(client(), 20260813)
        game.roll()
        game.fuse("P1", "P2")
        game.promote("P3", 2)
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "run.json"
            game.journal.save(path)
            loaded = Journal.load(path)
        replay = Game.replay(client(), loaded)
        self.assertEqual(replay.signature(), game.signature())
        self.assertEqual(replay.journal.events, game.journal.events)


def cast_valid_spell(session: GameSession) -> dict[str, object]:
    spell = session.state()["spell"]
    if spell is None:
        raise ValueError("spell construction is not the current interface")
    law = spell["law"]
    by_slot = {
        slot: [term for term in law["terms"] if term["slot"] == slot]
        for slot in ("SOURCE", "INTENT", "PATH", "FORM")
    }
    forms = by_slot["FORM"] or [{
        "id": "DORMANT", "force": 0, "coherence": 0, "resonance": 0,
    }]
    for source, intent, path, form in product(
        by_slot["SOURCE"], by_slot["INTENT"], by_slot["PATH"], forms
    ):
        choices = {
            "SOURCE": source["id"], "INTENT": intent["id"],
            "PATH": path["id"], "FORM": form["id"],
        }
        synergy = next((item for item in law["synergies"] if all(
            choices.get(slot) == term_id
            for slot, term_id in item["requires"].items()
        )), None)
        multiplier = 2 if law["metaTier"] else 1
        score = {
            metric: sum(term[metric] for term in (source, intent, path, form))
            + (synergy[metric] * multiplier if synergy else 0)
            for metric in ("force", "coherence", "resonance")
        }
        deficit = sum(max(0, law[f"{metric}Need"] - score[metric]) for metric in score)
        structure_ok = (
            law["formRequired"] == (form["id"] != "DORMANT")
            and (not law["synergyRequired"] or synergy is not None)
        )
        if structure_ok and (deficit == 0 or deficit == 1):
            return session.act({"action": "cast_spell", **{
                "source": source["id"], "intent": intent["id"],
                "path": path["id"], "form": form["id"],
            }})
    raise AssertionError("procedural spell law has no admitted recipe")


class WebInterfaceTests(unittest.TestCase):
    def test_tick_requires_confirmation_before_imba_plus_one(self) -> None:
        session = GameSession(client(), 20260813)
        initial = session.state()
        self.assertEqual(initial["status"], "awaiting_tick")
        self.assertEqual(initial["layers"], [{"rank": 1, "name": "rank-1", "tick": 0}])
        self.assertEqual(initial["shadow"]["sliceDepth"], 3)
        self.assertEqual(initial["shadow"]["relicOrder"], 1)
        self.assertEqual(initial["shadow"]["boundary"], "opaque")
        self.assertEqual(
            [horizon["id"] for horizon in initial["progression"]["horizons"]],
            ["NOW", "CONFLICT", "SESSION", "CHRONICLE"],
        )
        self.assertNotIn("stackDepth", initial)
        self.assertEqual(initial["journey"]["roadBricks"], 0)
        self.assertEqual(initial["journey"]["curseRemaining"], 12)

        pending = session.act({"action": "tick"})
        self.assertEqual(pending["status"], "awaiting_spell")
        self.assertEqual(pending["pendingTick"], 1)
        self.assertEqual(len(pending["layers"]), 1)
        self.assertEqual(pending["spell"]["law"]["forceNeed"], 4)
        self.assertEqual(len(pending["spell"]["law"]["terms"]), 9)
        self.assertEqual(pending["calculation"]["theorem"], "stagedTick_is_next")
        self.assertIn("0 + 1 = 1", pending["calculation"]["equation"])
        self.assertEqual(pending["calculation"]["verdict"], "WAIT / SPELL")
        self.assertEqual(pending["calculation"]["scene"], "tick")
        self.assertEqual(
            [signal["value"] for signal in pending["calculation"]["signals"]],
            ["0", "+1", "1"],
        )

        confirmed = cast_valid_spell(session)
        self.assertEqual(confirmed["status"], "awaiting_tick")
        self.assertEqual(confirmed["confirmedTicks"], 1)
        self.assertEqual(confirmed["layers"][-1]["rank"], 2)
        self.assertEqual(confirmed["living"]["certificate"], 1)
        self.assertTrue(confirmed["living"]["prefixGuard"])
        self.assertEqual(confirmed["shadow"]["relicOrder"], 2)
        self.assertIn("nadimbaMorphism", confirmed["calculation"]["theorem"])
        self.assertEqual(confirmed["calculation"]["result"], "ROAD STEP 1 / APPEND")
        self.assertEqual(confirmed["calculation"]["scene"], "spell")
        self.assertEqual(confirmed["journey"]["roadBricks"], 1)
        self.assertEqual(confirmed["journey"]["curseRemaining"], 11)
        self.assertTrue(confirmed["journey"]["trouble"]["active"])
        self.assertEqual(confirmed["journey"]["ravenForm"], "CURSED_WALKER")
        self.assertFalse(confirmed["journey"]["worldTruthKnown"])

    def test_failed_spell_holds_rank_certificate_curse_and_road(self) -> None:
        session = GameSession(client(), 20260813)
        session.act({"action": "tick"})
        held = session.act({
            "action": "cast_spell",
            "source": "WILL",
            "intent": "RELEASE",
            "path": "ECHO",
            "form": "DORMANT",
        })
        self.assertEqual(held["status"], "awaiting_spell")
        self.assertEqual(held["spell"]["last"]["outcome"], "HOLD")
        self.assertEqual(held["confirmedTicks"], 0)
        self.assertEqual(held["living"]["certificate"], 0)
        self.assertEqual(held["journey"]["roadBricks"], 0)
        self.assertEqual(held["journey"]["curseRemaining"], 12)
        self.assertEqual(held["calculation"]["scene"], "spell")
        self.assertEqual(held["calculation"]["verdict"], "HOLD")

    def test_spell_complexity_synergy_and_meta_progression_are_core_owned(self) -> None:
        core = client()
        novice = core.spell_law(20260813, 1, 1, 1, 0, 0)
        shaped = core.spell_law(20260813, 1, 5, 5, 4, 0)
        meta = core.spell_law(20260814, 1, 9, 9, 8, 3)

        self.assertEqual((novice.complexity, novice.form_required), (1, False))
        self.assertEqual((shaped.complexity, shaped.form_required), (2, True))
        self.assertEqual((meta.complexity, meta.synergy_required, meta.meta_tier), (3, True, 1))
        self.assertEqual([term.slot for term in shaped.terms].count("FORM"), 3)
        self.assertEqual(len(novice.terms), 9)
        self.assertNotEqual(novice.lexicon_variant, meta.lexicon_variant)

        cast = core.spell_cast(
            20260814, 1, 9, 9, 8, 3,
            "WILL", "REVEAL", "ECHO", "BLADE",
        )
        self.assertEqual(cast.synergy, "REVELATION")
        self.assertEqual(cast.synergy_title, "Эхо откровения")
        self.assertEqual(cast.outcome, "APPEND")

    def test_shadow_exposes_only_the_last_three_pieces(self) -> None:
        session = GameSession(client(), 20260813)
        session.game._interruption_rank = 8
        for _ in range(4):
            session.act({"action": "tick"})
            state = cast_valid_spell(session)

        self.assertEqual(len(session.game.state.layers), 5)
        self.assertEqual([layer["rank"] for layer in state["layers"]], [3, 4, 5])
        self.assertEqual(state["shadow"]["visibleDepth"], 3)
        self.assertTrue(state["shadow"]["hasHiddenPrefix"])
        self.assertEqual(state["journey"]["roadBricks"], 4)
        self.assertTrue(state["journey"]["chapterConflict"])
        self.assertTrue(state["journey"]["worldTruthKnown"])
        self.assertEqual(state["journey"]["ravenForm"], "WORLD_MAGUS")
        self.assertEqual(state["shadow"]["relicOrder"], 5)
        self.assertNotIn("hiddenDepth", state["shadow"])
        self.assertNotIn("resident", state["shadow"])

    def test_nature_interrupts_and_surrender_starts_again(self) -> None:
        session = GameSession(client(), 20260813)
        for _ in range(100):
            session.act({"action": "tick"})
            state = cast_valid_spell(session)
            if state["status"] == "awaiting_defense_roll":
                break
        else:
            self.fail("seeded Nature did not interrupt a finite cycle")

        reached = state["layers"][-1]["rank"]
        self.assertEqual(state["interruptedLayer"]["rank"], reached + 1)
        self.assertEqual(state["status"], "awaiting_defense_roll")
        self.assertEqual(state["calculation"]["scene"], "interrupt")
        nature_attack = state["continuity"]["pendingAttack"]
        self.assertEqual((nature_attack["actor"], nature_attack["kind"]), ("NATURE", "ATTACK"))
        rolled = session.act({"action": "roll_defense"})
        self.assertEqual(rolled["status"], "awaiting_plane")
        self.assertEqual(set(rolled["defenseRoll"]["axes"]), {"X", "Y", "Z", "W"})
        self.assertEqual(rolled["calculation"]["scene"], "axes")
        self.assertEqual(
            [signal["symbol"] for signal in rolled["calculation"]["signals"]],
            ["X", "Y", "Z", "W"],
        )
        chosen = max(rolled["defenseRoll"]["planes"], key=lambda item: item["power"])
        selected = session.act({"action": "select_plane", "plane": chosen["id"]})
        self.assertEqual(selected["selectedPlane"], chosen["id"])
        self.assertEqual(selected["calculation"]["scene"], "projection")
        self.assertIn(f"π{chosen['id']}(v)", selected["calculation"]["relation"])
        defended = session.act({"action": "confirm_defense"})
        self.assertEqual(defended["status"], "defended")
        self.assertGreaterEqual(defended["defense"]["damage"], 1)
        self.assertFalse(defended["defense"]["fullyBlocked"])
        self.assertIsNone(defended["continuity"]["pendingAttack"])
        self.assertEqual(defended["continuity"]["lastReaction"]["actor"], "PLAYER")
        self.assertEqual(
            defended["continuity"]["lastReaction"]["parentHead"],
            nature_attack["head"],
        )
        self.assertIn("defense_conserves_impact", defended["calculation"]["theorem"])
        self.assertEqual(defended["calculation"]["scene"], "conservation")
        self.assertEqual(
            defended["calculation"]["signals"][-1]["value"],
            str(defended["defense"]["damage"]),
        )
        restarted = session.act({"action": "surrender"})
        self.assertEqual(restarted["cycle"], 2)
        self.assertEqual(restarted["status"], "awaiting_tick")
        self.assertEqual(restarted["layers"][0]["rank"], 1)
        self.assertEqual(restarted["surrenders"][0]["reachedRank"], reached)
        self.assertGreaterEqual(restarted["totalDamage"], 1)
        self.assertGreater(restarted["internalTension"], 0)
        self.assertGreater(restarted["living"]["reflection"], 0)
        self.assertTrue(restarted["living"]["prefixGuard"])
        self.assertEqual(session.game.state.shadow_returned, reached + 1)
        self.assertEqual(session.game.state.shadow_manifested, reached + 2)
        self.assertEqual(restarted["shadow"]["relicOrder"], reached + 4)
        self.assertEqual(restarted["calculation"]["scene"], "memory")

        session.act({"action": "tick"})
        ready = cast_valid_spell(session)
        self.assertTrue(ready["firstStrike"]["allowed"])
        struck = session.act({"action": "first_strike"})
        self.assertEqual(struck["status"], "awaiting_world_reaction")
        self.assertEqual(struck["calculation"]["scene"], "attack")
        self.assertFalse(struck["firstStrikeUsed"])
        self.assertEqual(struck["enemyDamage"], 0)
        player_attack = struck["continuity"]["pendingAttack"]
        self.assertEqual((player_attack["actor"], player_attack["kind"]), ("PLAYER", "ATTACK"))
        with self.assertRaises(ValueError):
            session.act({"action": "first_strike"})
        reacted = session.act({"action": "world_reaction"})
        self.assertEqual(reacted["status"], "awaiting_tick")
        self.assertEqual(reacted["calculation"]["scene"], "reaction")
        self.assertTrue(reacted["firstStrikeUsed"])
        self.assertGreater(reacted["enemyDamage"], 0)
        self.assertIsNone(reacted["continuity"]["pendingAttack"])
        self.assertEqual(reacted["continuity"]["lastReaction"]["actor"], "WORLD")
        self.assertEqual(
            reacted["continuity"]["lastReaction"]["parentHead"],
            player_attack["head"],
        )
        self.assertEqual(reacted["worldEvent"]["class"], "COMPENSATION")
        reaction_form = reacted["worldEvent"]["form"]
        self.assertIn(reaction_form, {"REGENERATION", "BARRIER", "REDISTRIBUTION", "SCAR", "OVERLOAD"})
        self.assertEqual(reacted["actors"]["world"]["life"], reacted["worldEvent"]["after"]["life"])
        self.assertEqual(reacted["actors"]["world"]["shield"], reacted["worldEvent"]["after"]["shield"])
        self.assertEqual(reacted["calculation"]["eventForm"], reaction_form)
        self.assertIn("resolved_life_bounded", reacted["calculation"]["theorem"])
        self.assertTrue(reacted["progression"]["pendingChoice"])
        self.assertEqual(reacted["progression"]["discovered"], [reaction_form])
        self.assertEqual(reacted["progression"]["masteryMarks"], 1)
        with self.assertRaises(ValueError):
            session.act({"action": "tick"})
        protocol = session.act({"action": "choose_protocol", "protocol": "FORECAST"})
        self.assertFalse(protocol["progression"]["pendingChoice"])
        self.assertEqual(protocol["progression"]["activeProtocol"]["id"], "FORECAST")
        self.assertEqual(protocol["calculation"]["scene"], "progress")
        self.assertIn("preserves_chronicle", protocol["calculation"]["theorem"])

        reset = session.reset(99)
        self.assertEqual(reset["status"], "awaiting_tick")
        self.assertEqual(reset["seed"], 99)
        self.assertEqual(reset["calculation"]["scene"], "reset")
        self.assertEqual(reset["calculation"]["verdict"], "GENESIS")
        self.assertEqual(reset["progression"]["discovered"], [reaction_form])
        self.assertEqual(reset["progression"]["activeProtocol"]["id"], "FORECAST")

    def test_refraction_protocol_previews_damage_without_applying_it(self) -> None:
        session = GameSession(client(), 20260813)
        session.game.state.progression.protocol_mask = 2
        session.game._interruption_rank = 2
        session.act({"action": "tick"})
        interrupted = cast_valid_spell(session)
        self.assertEqual(interrupted["status"], "awaiting_defense_roll")
        rolled = session.act({"action": "roll_defense"})
        selected = session.act({
            "action": "select_plane",
            "plane": rolled["defenseRoll"]["planes"][0]["id"],
        })
        preview = selected["progression"]["planePreview"]
        self.assertIsNotNone(preview)
        self.assertGreaterEqual(preview["damage"], 1)
        self.assertIsNone(selected["defense"])

    def test_forecast_protocol_reveals_the_next_world_form_only_when_strike_is_ready(self) -> None:
        session = GameSession(client(), 20260813)
        session.game.state.progression.protocol_mask = 1
        session.game.state.internal_tension = 5
        session.game.state.reflection = 3
        session.game._interruption_rank = 20
        session.act({"action": "tick"})
        ready = cast_valid_spell(session)
        self.assertTrue(ready["firstStrike"]["allowed"])
        self.assertIsNotNone(ready["progression"]["forecast"])
        self.assertIn(
            ready["progression"]["forecast"]["form"],
            {"REGENERATION", "BARRIER", "REDISTRIBUTION", "SCAR", "OVERLOAD"},
        )
        struck = session.act({"action": "first_strike"})
        self.assertIsNone(struck["progression"]["forecast"])

    def test_bad_interface_action_does_not_mutate_state(self) -> None:
        session = GameSession(client(), 17)
        before = session.state()
        with self.assertRaises(ValueError):
            cast_valid_spell(session)
        self.assertEqual(session.state(), before)


if __name__ == "__main__":
    unittest.main()
