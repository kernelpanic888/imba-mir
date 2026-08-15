"""Seeded run controller; all rank decisions are delegated to Lean."""

from __future__ import annotations

import random
from typing import Any, Iterable

from .core import CoreClient
from .journal import Journal
from .models import Board, Piece, Position, RunState


class Game:
    def __init__(self, core: CoreClient, seed: int) -> None:
        self.core = core
        self.rng = random.Random(seed)
        board = Board()
        player_cells = [(6, 0), (6, 1), (5, 0), (5, 1)]
        enemy_cells = [(0, 5), (0, 6), (1, 6)]
        for index, (row, col) in enumerate(player_cells, 1):
            board.add(Piece(f"P{index}", "player", Position(row, col), 0, core.name(0)))
        for index, (row, col) in enumerate(enemy_cells, 1):
            rank = self.rng.choice((0, 1))
            board.add(
                Piece(f"E{index}", "system", Position(row, col), rank, core.name(rank))
            )
        self.state = RunState(seed=seed, board=board)
        self.journal = Journal(seed)
        self._log(f"Run initialized with seed {seed}.")

    def _log(self, message: str) -> None:
        self.state.messages.append(message)
        self.state.messages[:] = self.state.messages[-8:]

    def _need_ap(self) -> None:
        if self.state.action_points < 1:
            raise ValueError("no action points; roll D0 first")

    def roll(self, *, record: bool = True) -> int:
        value = self.rng.choice(self.state.d0_faces)
        self.state.last_roll = value
        self.state.action_points = value
        self._log(f"D0 rolled {value}; action budget is {value}.")
        if record:
            self.journal.append("roll", value=value)
        return value

    def move(self, piece_id: str, row: int, col: int, *, record: bool = True) -> None:
        self._need_ap()
        piece = self.state.board.get(piece_id)
        if piece.owner != "player":
            raise ValueError("only player pieces can be moved")
        self.state.board.move(piece_id, Position(row, col))
        self.state.action_points -= 1
        self._log(f"{piece_id} moved to ({row}, {col}).")
        if record:
            self.journal.append("move", piece=piece_id, row=row, col=col)

    def fuse(self, left_id: str, right_id: str, *, record: bool = True) -> bool:
        self._need_ap()
        left = self.state.board.get(left_id)
        right = self.state.board.get(right_id)
        if left.id == right.id or left.owner != "player" or right.owner != "player":
            raise ValueError("fusion needs two different player pieces")
        if not left.position.adjacent(right.position):
            raise ValueError("fusion pieces must be adjacent")

        answer = self.core.fuse(left.rank, right.rank)
        if not answer.allowed:
            self._log(f"Fusion denied by Lean: {answer.reason}.")
            if record:
                self.journal.append("fuse", left=left_id, right=right_id)
            return False

        left.rank = answer.rank  # type: ignore[assignment]
        left.name = answer.name  # type: ignore[assignment]
        self.state.board.remove(right.id)
        self.state.action_points -= 1
        self._log(f"{left_id}+{right_id} became {left.name} [rank {left.rank}].")
        if record:
            self.journal.append("fuse", left=left_id, right=right_id)
        return True

    def attack(self, source_id: str, target_id: str, *, record: bool = True) -> bool:
        self._need_ap()
        attacker = self.state.board.get(source_id)
        defender = self.state.board.get(target_id)
        if attacker.owner != "player" or defender.owner == "player":
            raise ValueError("attack needs a player attacker and opposing target")
        if not attacker.position.adjacent(defender.position):
            raise ValueError("attack target must be adjacent")

        allowed, reason = self.core.compare(attacker.rank, defender.rank)
        if allowed:
            self.state.board.remove(defender.id)
            self.state.action_points -= 1
            self._log(
                f"{attacker.id}[{attacker.rank}] removed {defender.id}[{defender.rank}]: "
                f"{reason}."
            )
        else:
            self._log(
                f"Attack denied: {attacker.id}[{attacker.rank}] vs "
                f"{defender.id}[{defender.rank}]: {reason}."
            )
        if record:
            self.journal.append("attack", attacker=source_id, defender=target_id)
        return allowed

    def promote(self, piece_id: str, delta: int, *, record: bool = True) -> None:
        piece = self.state.board.get(piece_id)
        if piece.owner != "player":
            raise ValueError("only player pieces can receive this reward")
        result, name = self.core.promote(piece.rank, delta)
        piece.rank, piece.name = result, name
        self._log(f"Lean promoted {piece_id} to {name} [rank {result}].")
        if record:
            self.journal.append("promote", piece=piece_id, delta=delta)

    def apply_events(self, events: Iterable[dict[str, Any]]) -> None:
        for item in events:
            event = item["event"]
            if event == "roll":
                actual = self.roll(record=False)
                if actual != item.get("value"):
                    raise ValueError("replay diverged at D0 roll")
            elif event == "move":
                self.move(item["piece"], item["row"], item["col"], record=False)
            elif event == "fuse":
                self.fuse(item["left"], item["right"], record=False)
            elif event == "attack":
                self.attack(item["attacker"], item["defender"], record=False)
            elif event == "promote":
                self.promote(item["piece"], item["delta"], record=False)
            else:
                raise ValueError(f"unknown replay event {event!r}")

    @classmethod
    def replay(cls, core: CoreClient, journal: Journal) -> "Game":
        game = cls(core, journal.seed)
        game.apply_events(journal.events)
        game.journal = Journal(journal.seed, list(journal.events))
        game._log(f"Replayed {len(journal.events)} recorded events.")
        return game

    def signature(self) -> tuple[object, ...]:
        """Stable observable state used to verify replay."""
        pieces = tuple(
            sorted(
                (p.id, p.owner, p.position.row, p.position.col, p.rank, p.name)
                for p in self.state.board.pieces.values()
            )
        )
        return pieces, self.state.action_points, self.state.last_roll
