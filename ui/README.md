# Imba interface

Current release: **0.1.2**. See the [release journal](CHANGELOG.md).

Local graphical interface for the single-square Imba World. It sends player
actions to the Python HTTP bridge on `127.0.0.1:8765`; the bridge delegates
promotion, tick admission, defense, session memory, initiative, and certified
combat continuation to the Lean executable.

Every state-changing control temporarily turns the square field into a
structured mathematical scene. Actual transition values flow through labelled
nodes, a governing relation, the exact equation, and the public reduction
steps. Tick, manifestation, interruption, four axes, plane projection,
conservation, memory, attack, reaction, and reset each have a distinct scene.
The trace is an audit view, not a depiction of private reasoning.

The intended project-level launch is:

```sh
make ui SEED=20260813
```

For interface-only development, start the Python bridge from the parent project
and then run:

```sh
npm run dev
```

Checks:

```sh
npm run build
npm test
```

This UI is local by design: a hosted static copy would not have access to the
machine-local Lean process.
