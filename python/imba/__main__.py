"""Command-line entry point for the Imba prototype."""

from __future__ import annotations

import argparse
import os
import shlex

from .core import CoreError, CoreClient
from .game import Game
from .journal import Journal
from .ui import render


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Imba terminal prototype")
    result.add_argument("--core", default=os.environ.get("IMBA_CORE", "imba-core"))
    result.add_argument("--seed", type=int, default=int(os.environ.get("IMBA_SEED", "20260813")))
    result.add_argument("--demo", action="store_true", help="run a deterministic smoke turn")
    result.add_argument("--record", metavar="PATH", help="save the run journal on exit")
    result.add_argument("--replay", metavar="PATH", help="replay a saved journal")
    return result


def _dispatch(game: Game, words: list[str]) -> bool:
    if not words:
        return True
    command, args = words[0].lower(), words[1:]
    if command == "quit":
        return False
    if command in {"show", "help"}:
        return True
    if command == "roll" and not args:
        game.roll()
    elif command == "move" and len(args) == 3:
        game.move(args[0].upper(), int(args[1]), int(args[2]))
    elif command == "fuse" and len(args) == 2:
        game.fuse(args[0].upper(), args[1].upper())
    elif command == "attack" and len(args) == 2:
        game.attack(args[0].upper(), args[1].upper())
    elif command == "promote" and len(args) == 2:
        game.promote(args[0].upper(), int(args[1]))
    elif command == "save" and len(args) == 1:
        game.journal.save(args[0])
        game.state.messages.append(f"Journal saved to {args[0]}.")
    else:
        raise ValueError("unknown command or wrong number of arguments")
    return True


def main() -> int:
    options = parser().parse_args()
    core = CoreClient(options.core)
    try:
        version = core.ping()
        if version != "0.1":
            raise CoreError(f"unsupported core protocol {version!r}")
        if options.replay:
            game = Game.replay(core, Journal.load(options.replay))
        else:
            game = Game(core, options.seed)

        if options.demo:
            game.roll()
            game.fuse("P1", "P2")
            print(render(game.state))
        elif options.replay:
            print(render(game.state))
        else:
            print(render(game.state))
            while True:
                try:
                    words = shlex.split(input("imba> "))
                    if not _dispatch(game, words):
                        break
                except (ValueError, CoreError) as exc:
                    game.state.messages.append(f"ERROR: {exc}")
                print(render(game.state))
        if options.record:
            game.journal.save(options.record)
        return 0
    except (CoreError, ValueError, OSError) as exc:
        print(f"imba: {exc}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
