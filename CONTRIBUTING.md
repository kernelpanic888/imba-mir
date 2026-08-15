# Contributing

Спасибо за интерес к **IMBA / МИР**.

1. Create a focused branch from `main`.
2. Keep game rules in Lean; Python and the web interface must consume the
   admitted result instead of reimplementing the authoritative rule.
3. Run `make test` for the formal core and bridge.
4. Run `cd ui && npm test` for the web interface.
5. Describe the player-visible effect and the invariant preserved by the
   change in the pull request.

Bug reports should include the world seed, the visible action sequence, and
the expected versus observed result. Never include credentials or private
session data.

