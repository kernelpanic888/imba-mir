"""State models owned by the Python presentation/run layer."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable


BOARD_SIZE = 7


@dataclass(frozen=True, order=True)
class Position:
    row: int
    col: int

    def __post_init__(self) -> None:
        if not (0 <= self.row < BOARD_SIZE and 0 <= self.col < BOARD_SIZE):
            raise ValueError(f"position must be inside {BOARD_SIZE}x{BOARD_SIZE} board")

    def adjacent(self, other: "Position") -> bool:
        return abs(self.row - other.row) + abs(self.col - other.col) == 1


@dataclass
class Piece:
    id: str
    owner: str
    position: Position
    rank: int
    name: str
    status: str = "ready"


@dataclass
class Board:
    size: int = BOARD_SIZE
    pieces: dict[str, Piece] = field(default_factory=dict)
    obstacles: set[Position] = field(default_factory=set)

    def piece_at(self, position: Position) -> Piece | None:
        return next((p for p in self.pieces.values() if p.position == position), None)

    def add(self, piece: Piece) -> None:
        if piece.id in self.pieces:
            raise ValueError(f"duplicate piece id {piece.id}")
        if piece.position in self.obstacles or self.piece_at(piece.position):
            raise ValueError("occupied position")
        self.pieces[piece.id] = piece

    def remove(self, piece_id: str) -> Piece:
        try:
            return self.pieces.pop(piece_id)
        except KeyError as exc:
            raise ValueError(f"unknown piece {piece_id}") from exc

    def get(self, piece_id: str) -> Piece:
        try:
            return self.pieces[piece_id]
        except KeyError as exc:
            raise ValueError(f"unknown piece {piece_id}") from exc

    def move(self, piece_id: str, destination: Position) -> None:
        piece = self.get(piece_id)
        if not piece.position.adjacent(destination):
            raise ValueError("movement is orthogonal by one cell")
        if destination in self.obstacles or self.piece_at(destination):
            raise ValueError("destination is occupied")
        piece.position = destination

    def by_owner(self, owner: str) -> Iterable[Piece]:
        return (piece for piece in self.pieces.values() if piece.owner == owner)


@dataclass
class RunState:
    seed: int
    board: Board
    stage: int = 1
    round: int = 1
    action_points: int = 0
    d0_faces: list[int] = field(default_factory=lambda: [1, 1, 2, 2, 3, 3])
    meta_charges: int = 0
    hyper_charges: int = 0
    last_roll: int | None = None
    risk_multiplier: float = 1.0
    secured_reward: int = 0
    exposed_reward: int = 0
    messages: list[str] = field(default_factory=list)
