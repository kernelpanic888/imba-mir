# Imba core protocol 0.1

This document defines the process boundary between the authoritative Lean 4
core and the Python terminal shell.

## Authority boundary

Lean 4 is the sole authority for rank names and rank transitions. In
particular, Python must not reimplement `beats`, `fuse`, `promote`, or the rank
name grammar. Python may validate terminal syntax, render data returned by the
core, manage the board, and record or replay seeded random choices.

Every query starts a new `imba-core` subprocess. A request is expressed as
command-line arguments. The process writes exactly one UTF-8 JSON object and a
trailing newline to stdout. Diagnostics may be written to stderr, but clients
must never parse stderr.

On success the exit status is `0` and the JSON object contains `"ok": true`.
On any protocol/input error the exit status is non-zero and stdout still
contains one JSON object with `"ok": false`. A client must reject empty output,
multiple JSON values, invalid JSON, and an inconsistent `ok`/exit-status pair.

Ranks and deltas are non-negative, arbitrary-precision base-10 integers. A
leading `+`, a sign, whitespace inside an argument, decimals, and exponent
notation are outside protocol 0.1.

## Commands

### Health check

```text
imba-core ping
```

```json
{"ok":true,"op":"ping","version":"0.1"}
```

### Rank name

```text
imba-core name <rank>
```

```json
{"ok":true,"op":"name","rank":5,"name":"super-meta-nano-quasi-imba"}
```

Names are presentation supplied by Lean. Clients must not infer a rank from a
name or reconstruct a name from a rank.

### Strict superiority

```text
imba-core beats <attacker-rank> <defender-rank>
```

```json
{"ok":true,"op":"beats","attacker":5,"defender":4,"result":true,"reason":"attacker rank is strictly greater than defender rank"}
```

`"result": false` is a successful domain answer and therefore exits `0`.

### Fuse equal ranks

```text
imba-core fuse <left-rank> <right-rank>
```

Success:

```json
{"ok":true,"op":"fuse","left":4,"right":4,"allowed":true,"rank":5,"name":"super-meta-nano-quasi-imba","reason":"equal ranks fuse into their stronger successor"}
```

Unequal ranks are a successful domain answer with `allowed: false`. They must
not yield a result rank or name:

```json
{"ok":true,"op":"fuse","left":4,"right":5,"allowed":false,"rank":null,"name":null,"reason":"fusion requires equal ranks"}
```

### Promote a rank

```text
imba-core promote <rank> <delta>
```

```json
{"ok":true,"op":"promote","rank":4,"delta":2,"result":6,"name":"super-meta-nano-quasi-ultra-imba"}
```

`delta = 0` is valid and leaves the rank unchanged. The core must report an
error instead of overflowing or silently truncating.

### Multi-axis defense

```text
imba-core defense-roll <seed> <cycle> <interrupted-rank>
imba-core defense-resolve <seed> <cycle> <interrupted-rank> <plane>
```

The roll returns d6 coordinates `x`, `y`, `z`, `w`, all six two-axis sums, and
the full Nature impact. Resolution adds the selected and complementary plane,
their powers, absorbed impact, and residual damage. The core guarantees
`absorbed + damage = impact` and `damage > 0`.

### Session initiative

```text
imba-core first-strike <confirmed-ticks> <previous-tension> <reflection> <already-used:0|1>
imba-core tension-carry <previous-tension> <confirmed-ticks> <nature-damage>
```

A finished session always adds `ticks + damage + 1` tension. In a later
session, one or more confirmed ticks and nonzero tension permit one first
strike whose damage is `ticks + tension + reflection`.

### Living-state admission

```text
imba-core living-admit <x> <y> <z> <w> <ticks> <damage> <plane>
imba-core certificate-admit <identity> <certificate> <current-rank> <next-rank>
```

`living-admit` deposits the positive session charge into the two axes of the
complementary plane and derives reflection from memory anisotropy.
`certificate-admit` accepts exactly the next rank, preserves identity, and
increments the certified-prefix length by one. A rejected candidate does not
extend the certificate.

### Manual tick staging

```text
imba-core tick-stage <confirmed-ticks> <current-rank> <certificate>
```

Lean computes exactly one pending tick while returning the unchanged rank and
certificate with `transitioned: false`. This makes the first button a real core
query without violating the separate-confirmation rule. The HTTP layer exposes
the returned values as a public formal reduction trace; this trace is an audit
view of inputs and outputs, not private reasoning.

### HTTP mathematical scenes

Every successful `/api/action` response and `/api/reset` response includes a
`calculation` object for the field overlay. Its `scene` selects one of the
bounded visual grammars, `relation` states the governing mathematical relation,
and `signals` contains the labelled values actually used by that transition.
The accompanying `equation`, `steps`, `result`, and `verdict` remain the exact
public reduction trace.

The current scene set is `tick`, `spell`, `manifest`, `interrupt`, `axes`, `projection`,
`conservation`, `memory`, `attack`, `reaction`, `progress`, and `reset`. `projection` is
explicitly a host selection gate with no Lean transition; `reset` is a host
session transition that creates a fresh Lean-authoritative world. These labels
prevent the interface from attributing host decisions to the theorem prover.

### Spell morphisms and the green road

```text
imba-core spell-law <identity> <cycle> <pending-tick> <rank> <certificate>
imba-core spell-cast <identity> <cycle> <pending-tick> <rank> <certificate> \
  <WILL|SHADOW> <RELEASE|REVEAL> <ROAD|ECHO>
imba-core journey <identity> <certificate>
```

`spell-law` returns the current force, coherence, and resonance thresholds plus
the six human-readable terms and their exact scores. `spell-cast` evaluates the
player-authored three-term formula. `HOLD` leaves rank, certificate, curse, and
road unchanged; `APPEND_WITH_COST` declares exactly one tension cost; `APPEND`
has no extra cost. Every admitted outcome preserves identity and extends the
certified prefix.

`journey` is a projection of the certificate, never a second host counter:
`roadBricks + curseRemaining = 12`. At road step 4 Lean changes the Raven from
`CURSED_WALKER` to `WORLD_MAGUS`, exposes the World-truth flag, and marks the
one-step chapter conflict with the Wizard. At road step 12 the castle threshold is
reached. Clients must not infer these thresholds independently.

### Chronicle progression

```text
imba-core progress-observe <discovery-mask> <protocol-mask> <mastery-marks> <form>
imba-core progress-unlock <discovery-mask> <protocol-mask> <mastery-marks> <FORECAST|REFRACTION>
```

`progress-observe` adds the bit and one mastery mark only when the compensation
form has not been seen before. Repeated observations return the unchanged mask
and mark count. The first discovery opens one protocol slot.

`progress-unlock` accepts exactly one first choice when the Chronicle is
nonempty and the protocol slot is empty. It preserves the discovery mask and
mastery marks. `FORECAST` reveals the next compensatory form before an allowed
first strike; `REFRACTION` reveals exact residual damage after plane selection
but before defense confirmation. Neither changes authoritative damage.

### Certified combat continuation

```text
imba-core combat-admit <identity> <current-epoch> <current-head> \
  <candidate-epoch> <parent-head> <PLAYER|NATURE|WORLD> \
  <ATTACK|REACTION> <payload>
```

An attack or reaction is admitted only when its epoch is exactly the successor
of the observed combat epoch and its `parent-head` is exactly the observed
head. Admission returns `verdict: "APPEND"` and advances both values. A stale
epoch or mismatched parent returns `verdict: "HOLD"` and leaves both values
unchanged. The numeric `proposedHead` is a deterministic game commitment for
replay and local audit; it is not a cryptographic hash or signature.

The runtime uses this rule twice per exchange: Nature attack → player reaction,
or player attack → World reaction. Damage is not applied until the direct
reaction has been admitted against the attack head.

## Generic errors

The error shape is deliberately small:

```json
{"ok":false,"error":"rank must be a natural number"}
```

The error string is human-readable and is not a stable machine code. Python may
display it but must not branch on its exact text. A future protocol can add a
separate stable error code without changing this shape.

## Reproducible runs

The interruption cutoff belongs to the seeded Python run controller. The
four-axis defense throw is a deterministic Lean function of the explicit world
seed, cycle, and interrupted rank. Repeating the same ordered actions must issue
the same ordered core queries and reach the same observable state. The Lean core
does not generate hidden randomness.

For a smoke run:

```sh
make run SEED=20260813
```

For a recorded run and replay, use the Python CLI's `--record`/`--replay`
options when available. Until both options are implemented, `make demo` is the
canonical deterministic integration smoke test.

## Versioning

Protocol `0.1` is append-only. New commands or response fields may be added, but
a field documented here cannot change meaning. A breaking change changes the
version string returned by `ping`.
