# IMBA / МИР v0.1.2 — first complete source release

This release opens the complete playable architecture as one repository:

- the authoritative Lean 4 rules, executable core, and proofs;
- the Python bridge, deterministic session controller, and tests;
- the bilingual web game and its procedural spell constructor;
- narrative, visual, progression, balance, and source passports;
- the protocol contract and reproducible sample transcript.

## Player-visible state

- One raven, one living World, one confirmed step at a time.
- A spell is assembled by the player; Lean admits, admits with cost, or holds it.
- Every accepted formula becomes visible magic in the reality slice.
- The green road records progress toward the Emerald Wizard.
- Nature answers through compensatory forms instead of acting as a disposable enemy.
- Russian and English interface modes are included.

## Verification

Run the complete formal and bridge suite:

```sh
make test
```

Run the web build and rendered-state checks:

```sh
cd ui
npm ci
npm test
```

The generated GitHub source archives are the release artifacts. Build outputs,
dependency folders, local service files, credentials, and machine-specific
state are intentionally excluded.

