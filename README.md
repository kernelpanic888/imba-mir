# IMBA / MIR

![IMBA / MIR — The Raven on the Green Road](docs/assets/imba-mir-cover.png)

## [▶ PLAY IMBA / MIR](https://imba-mir-aleksey.kernelpanic888.chatgpt.site/)

> Один ворон · одна дорога · живой Мир  
> One raven · one road · a living World

**Author:** [Aleksey Salkutsan](AUTHORS.md)

**Source release:** `v0.1.6`

**Repository:** [github.com/kernelpanic888/imba-mir](https://github.com/kernelpanic888/imba-mir)

**Categories:** Video game · Mathematics · Lean 4 formal methods

Imba is a one-player game about building an unbounded stack in one square
World. Every tick waits for manual confirmation before it becomes Imba + 1.
Nature eventually interrupts the line; a four-axis throw and a chosen plane
absorb part of the impact, while the complementary plane always remains open.

The implementation keeps that law in one place:

- `lean/` is the authoritative Lean 4 model, executable core, and proofs;
- `python/` is the terminal board, seeded run controller, journal, and renderer;
- `protocol.md` specifies their subprocess/JSON boundary;
- `contracts/sample-transcript.json` is a readable protocol example;
- `scripts/imba-core` gives Python a stable path to the Lean executable.

The published interface uses a same-origin `/api/*` route. A Worker forwards
that route to a container containing the compiled native Lean core and the
Python session boundary; browsers never call their own `localhost`. Each player
receives an independent expiring session. The complete contract is
[`docs/PUBLIC_RUNTIME_PASSPORT.md`](docs/PUBLIC_RUNTIME_PASSPORT.md).

Python never decides whether an attack wins and never computes a fusion or
promotion result. It asks Lean once per transition and displays the answer.

The living-state mechanics adapt the formal architecture of
[DL-04 / Living Model in a Virtual Domain](https://chertogi-razuma-research.kernelpanic888.chatgpt.site/readers/digital-life-living-model/):
fixed identity, admitted-state history, session memory, reflection, and a
monotone tick certificate. An interrupted tick is rejected from history.
This is an executable game model, not a claim of consciousness or literal life.

The Shadow follows the boundary discipline of
[AR-01 / Activation Relic: Shadow Boundary](https://chertogi-razuma-research.kernelpanic888.chatgpt.site/readers/activation-relic-shadow-boundary/).
A confirmed step performs one pure creation act; a Nature-rejected candidate
returns immediately, and surrender returns the full active line. The Shadow is
not directly observable. The browser receives only the newest three pieces and
an ordered in-domain activation relic `R_D` for each admitted boundary crossing,
never a list or count of Shadow inhabitants. Lean proves that the hidden prefix
and three-piece cut reconstruct the unchanged full line, that the visible cut
never exceeds three pieces, and that every boundary act advances relic order.

Attacks and reactions follow the local-continuity discipline of
[CR-01 / Certified Continuity Protocol Candidate](https://chertogi-razuma-research.kernelpanic888.chatgpt.site/readers/certified-continuity-protocol/).
Every combat event observes the current epoch and head, asks Lean to admit the
exact successor, receives a game commitment, and appends or holds. Nature's
attack must be followed by the player's directly attached defense reaction;
the player's first strike must be followed by a separately confirmed World
reaction before any damage is applied. Stale epochs and wrong parents are held
without changing combat state. This is a local game-continuity model, not a
cryptographic protocol or security claim.

## Requirements

- Lean 4 with Lake (the repository's toolchain file selects the version)
- Python 3.11 or newer
- `make` and a POSIX shell
- Node.js 22 or newer and npm (graphical interface only)

No Python package installation is required for the prototype.

## Build and run

```sh
make build
make ping
make run SEED=20260813
make ui SEED=20260813
```

In this prototype the seed controls initial enemy ranks and D0 rolls. Future
field generation, system tie-breaking, and seeded rewards must use the same run
generator. The Lean strength core is deterministic and contains no
random-number generator.

Run the non-interactive seeded smoke scenario with:

```sh
make demo SEED=20260813
```

`make ui` starts the single-square World and its Lean-backed HTTP bridge. Open
`http://localhost:3000/` if the interface does not open automatically. Accumulate
one tick, compose its three-part human-readable spell, and submit that formula
to admit Imba + 1. Each admitted spell externalizes one curse fragment as a
step on the green road. Use the four-axis defense when Nature interrupts the line.
The browser never decides spell admission, promotion, journey thresholds,
defense, initiative, memory, or certificate results itself.

Every action temporarily transforms the square World into a mathematical Lean
trace: the submitted term, named definition or theorem, exact substitutions,
guards, `APPEND/HOLD`, and returned state. The trace is deliberately an
auditable reduction view, not a simulation of hidden thoughts. Even the first
`accumulate tick` button calls Lean `tick-stage`; it computes the pending index
while proving that rank and certificate are still held for confirmation.

The trace also carries a structured mathematical scene (`scene`, `relation`,
and exact `signals`) rather than relying on decorative animation. Eleven visible
scenes cover every control that changes the run: tick staging, spell morphism, manifestation,
Nature interruption, four-axis roll, plane projection, impact conservation,
session memory, first attack, World reaction, protocol choice, and world reset. Host-only choices
and reset are labelled as such; the interface never presents them as Lean
theorems.

The first progression slice is now playable. Four nested horizons are visible
on the square field. The first observation of each World compensation form is
recorded once in a persistent Chronicle; the first discovery requires a choice
between `FORECAST` (preview the next compensatory form) and `REFRACTION`
(preview residual plane damage before confirmation). The choice reveals
information rather than adding hidden power, and survives a World-code reset.
The design rules and implementation status live in
[`docs/PROGRESSION_PASSPORT.md`](docs/PROGRESSION_PASSPORT.md).

Project standards are now split into independently verifiable modules listed in
[`docs/PASSPORT_INDEX.md`](docs/PASSPORT_INDEX.md). Visual-language evidence is in
[`docs/VISUAL_RESEARCH.md`](docs/VISUAL_RESEARCH.md) and its normative contract
is [`docs/VISUAL_PASSPORT.md`](docs/VISUAL_PASSPORT.md). The former
[`docs/GOOD_GAME_PASSPORT.md`](docs/GOOD_GAME_PASSPORT.md) remains an archival
umbrella and is no longer extended as a monolith. A written passport is design
guidance, not runtime content or a claim that the current prototype is already
certified.

The active calibration contract is
[`docs/BALANCE_PASSPORT.md`](docs/BALANCE_PASSPORT.md), grounded in
[`docs/BALANCE_RESEARCH.md`](docs/BALANCE_RESEARCH.md). Its baseline audit
enumerates the current spell space and seed-driven Nature curve. It records two
confirmed blockers before tuning begins: the `REMEMBRANCE` synergy has no viable
late-game context, and the current first-contact formula releases unbounded
session history linearly into a finite World life pool.

The first spellcraft slice is implemented: an accumulated tick opens a
human-readable three-part constructor instead of offering a ready-made
`Imba + 1`. The player authors the Emerald incantation, while Lean decides
`APPEND`, `APPEND WITH COST`, or `HOLD`. The fourth certified road step ends chapter
one: the Raven discovers that the World that denied being magic is composed of
admissible magical morphisms, takes the `WORLD_MAGUS` form, and enters explicit
conflict with the Wizard.

You can also invoke each layer directly:

```sh
./scripts/imba-core beats 5 4
PYTHONPATH=python python3 -m imba --core ./scripts/imba-core --seed 20260813 --demo
```

## Test

```sh
make test
```

This runs Lean tests/proofs, Python tests against the compiled subprocess,
protocol smoke calls, and an authority audit that flags likely copies of the
strict rank comparison in Python.

Individual checks:

```sh
make test-lean
make test-python
make contract
make audit
```

## Core commands

```text
imba-core ping
imba-core name <rank>
imba-core beats <attacker> <defender>
imba-core fuse <left> <right>
imba-core promote <rank> <delta>
imba-core defense-roll <seed> <cycle> <interrupted-rank>
imba-core defense-resolve <seed> <cycle> <interrupted-rank> <plane>
imba-core first-strike <confirmed-ticks> <previous-tension> <reflection> <already-used:0|1>
imba-core tension-carry <previous-tension> <confirmed-ticks> <nature-damage>
imba-core living-admit <x> <y> <z> <w> <ticks> <damage> <plane>
imba-core certificate-admit <identity> <certificate> <current-rank> <next-rank>
imba-core tick-stage <confirmed-ticks> <current-rank> <certificate>
imba-core combat-admit <identity> <current-epoch> <current-head> <candidate-epoch> <parent-head> <actor> <kind> <payload>
imba-core progress-observe <discovery-mask> <protocol-mask> <mastery-marks> <form>
imba-core progress-unlock <discovery-mask> <protocol-mask> <mastery-marks> <FORECAST|REFRACTION>
```

Every invocation emits exactly one JSON object. See `protocol.md` for the full
contract and error semantics.

## Reproducibility

A session starts from an explicit integer seed. Its journal records that seed,
ordered random draws, and player actions; replaying those actions issues the
same ordered Lean queries. Replay must reproduce the same observable states.
Randomness can alter a rank before combat, but it cannot overturn Lean's final
`beats` decision.

## Project status

This is the first playable architecture, deliberately smaller than the complete
design passport. The invariant is already the permanent one: for every rank
there is a higher rank, so a locally strongest Imba may always be beaten later
by a successfully assembled counter-Imba.

## Verification status

| Check | Status in this workspace |
|---|---|
| JSON sample parses | passed |
| POSIX launchers parse | passed |
| Python unit/integration tests | 18/18 passed |
| Seeded demo through protocol-compatible fake core | passed |
| Python authority audit | passed; no `beats` reimplementation detected |
| Lean build and real-core end-to-end run | passed with pinned Lean 4.30.0 |
| Graphical interface build | passed |
| Live UI bridge tick/defense/session/initiative smoke | passed |

The single-domain loop now covers pure creation from the Shadow, a last-three
observable cut, player-authored spell admission, the green road and the first
two authored chapters, Nature interruption, three certified defense geometries,
surrender, session memory, next-session initiative, and manually completed
attack/reaction pairs with certified local continuity.
Long-term goals, enemy variety, and deeper stack configuration remain future
gameplay work rather than hidden interface behavior.

The researched design-only instruction for that future work is split into
[`docs/PROGRESSION_RESEARCH.md`](docs/PROGRESSION_RESEARCH.md) and the normative
[`docs/PROGRESSION_PASSPORT.md`](docs/PROGRESSION_PASSPORT.md). The passport is
not runtime content and must not be presented as an already implemented system.

The modular source of truth is
[`docs/PASSPORT_INDEX.md`](docs/PASSPORT_INDEX.md). The visual and progression
passports each require their own implementation evidence and target-player
tests before their module can be described as closed. The broader
[`docs/GOOD_GAME_RESEARCH.md`](docs/GOOD_GAME_RESEARCH.md) and archival
[`docs/GOOD_GAME_PASSPORT.md`](docs/GOOD_GAME_PASSPORT.md) preserve the original
research context without overriding the specialist modules.
