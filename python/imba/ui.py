"""Plain terminal renderer: central board, side tables, and transition log."""

from __future__ import annotations

from .models import RunState


def _table(title: str, rows: list[tuple[str, object]], width: int = 30) -> list[str]:
    line = "+" + "-" * (width - 2) + "+"
    out = [line, f"| {title[:width-4]:<{width-4}} |", line]
    for key, value in rows:
        text = f"{key}: {value}"[: width - 4]
        out.append(f"| {text:<{width-4}} |")
    out.append(line)
    return out


def render(state: RunState) -> str:
    cells = [[" .  " for _ in range(state.board.size)] for _ in range(state.board.size)]
    for obstacle in state.board.obstacles:
        cells[obstacle.row][obstacle.col] = "### "
    for piece in state.board.pieces.values():
        cells[piece.position.row][piece.position.col] = f"{piece.id[0]}{piece.rank:<2} "

    board = ["       0   1   2   3   4   5   6"]
    board.extend(f"  {row}  " + "".join(values) for row, values in enumerate(cells))
    players = ", ".join(
        f"{p.id}=r{p.rank}" for p in sorted(state.board.by_owner("player"), key=lambda p: p.id)
    ) or "none"
    enemies = ", ".join(
        f"{p.id}=r{p.rank}" for p in sorted(state.board.by_owner("system"), key=lambda p: p.id)
    ) or "none"
    left = _table(
        "RUN",
        [
            ("seed", state.seed),
            ("stage/round", f"{state.stage}/{state.round}"),
            ("AP", state.action_points),
            ("player", players),
            ("system", enemies),
            ("charges", f"M{state.meta_charges}/H{state.hyper_charges}"),
        ],
    )
    right = _table(
        "DICE / RISK",
        [
            ("D0", state.d0_faces),
            ("last", state.last_roll if state.last_roll is not None else "-"),
            ("risk", f"x{state.risk_multiplier:g}"),
            ("secured", state.secured_reward),
            ("exposed", state.exposed_reward),
        ],
    )

    height = max(len(board), len(left), len(right))
    board += [""] * (height - len(board))
    left += [""] * (height - len(left))
    right += [""] * (height - len(right))
    combined = [f"{left[i]:<31}  {board[i]:<37}  {right[i]}" for i in range(height)]
    combined.extend(
        [
            "",
            "Commands: roll | move ID ROW COL | fuse LEFT RIGHT | attack A D",
            "          promote ID DELTA | show | save PATH | help | quit",
            "",
            "JOURNAL",
            *(f"  {message}" for message in state.messages[-6:]),
        ]
    )
    return "\n".join(combined)
