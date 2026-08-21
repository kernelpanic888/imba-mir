# Imba interface

Current release: **0.1.4**. See the [release journal](CHANGELOG.md).

Graphical interface for the single-square Imba World. It sends player actions
to the same-origin `/api/*` boundary. Locally the Worker forwards that boundary
to the Python service on `127.0.0.1:8765`; in production it uses the public
HTTPS origin configured as `IMBA_API_ORIGIN`. The Python boundary delegates
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

The public runtime contract, player-session isolation, and deployment checks
are documented in [`../docs/PUBLIC_RUNTIME_PASSPORT.md`](../docs/PUBLIC_RUNTIME_PASSPORT.md).
