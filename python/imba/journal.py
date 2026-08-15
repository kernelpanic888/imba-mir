"""Portable JSON run journal for deterministic replay."""

from __future__ import annotations

from dataclasses import dataclass, field
import json
from pathlib import Path
from typing import Any


@dataclass
class Journal:
    seed: int
    events: list[dict[str, Any]] = field(default_factory=list)
    format: str = "imba-replay-0.1"

    def append(self, event: str, **data: Any) -> None:
        self.events.append({"event": event, **data})

    def save(self, path: str | Path) -> None:
        Path(path).write_text(
            json.dumps(
                {"format": self.format, "seed": self.seed, "events": self.events},
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    @classmethod
    def load(cls, path: str | Path) -> "Journal":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        if not isinstance(data, dict) or data.get("format") != "imba-replay-0.1":
            raise ValueError("unsupported Imba journal")
        if type(data.get("seed")) is not int or not isinstance(data.get("events"), list):
            raise ValueError("malformed Imba journal")
        if not all(isinstance(event, dict) and isinstance(event.get("event"), str)
                   for event in data["events"]):
            raise ValueError("malformed Imba journal event")
        return cls(seed=data["seed"], events=data["events"])
