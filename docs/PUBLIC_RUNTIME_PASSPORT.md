# Public runtime passport

Status: implementation contract for the public prototype.

## Goal

Any visitor must be able to open the published game and play without ChatGPT
login, a local Python process, or a locally compiled Lean toolchain.

## Authority boundary

Lean 4 remains the only authority for admission, spell laws, rank changes,
defence, continuity, World compensation, progression, and journey state. The
browser renders answers; it does not reproduce those rules. Python validates
HTTP input, owns player sessions, invokes `imba-core`, and serializes the result.

## Public request path

```text
browser /api/*
  -> same-origin Sites Worker proxy
  -> HTTPS container
  -> Python session boundary
  -> native Lean 4 imba-core process
  -> JSON state
```

The browser contains no `localhost` API address. In local development the Worker
uses `http://127.0.0.1:8765`; in production `IMBA_API_ORIGIN` must name the
public HTTPS container.

## Session law

- One opaque `HttpOnly`, `SameSite=Lax` cookie identifies one player session.
- A missing, expired, or malformed token creates a new independent World.
- Sessions expire after 12 idle hours by default.
- The in-memory store is bounded to 1,000 sessions by default and evicts the
  least recently used session when full.
- A reset preserves only the progression already preserved by `WorldGame`.
- Container restarts currently reset active browser sessions. Durable journals
  are a later persistence slice and must not move game rules out of Lean.

## Failure language

If the public runtime is not configured, the Worker returns HTTP 503 and an
explicit machine-readable error. The interface may retry without moving layout
or mutating game state. No offline JavaScript substitute is permitted.

## Deployment contract

1. Build the root `Dockerfile`; its first stage compiles the pinned Lean
   toolchain and its final stage runs the Python boundary as a non-root user.
2. Publish the container behind HTTPS and verify `/api/health`.
3. Set the Sites environment variable `IMBA_API_ORIGIN` to that HTTPS origin.
4. Rebuild and publish the UI.
5. Verify in a signed-out browser and on a device that has no local core.

The repository includes `render.yaml` as the zero-cost public-preview path.
Render builds the root Dockerfile and supplies a public HTTPS origin. Its free
service sleeps after inactivity and uses an ephemeral filesystem, so a cold
start can take about a minute and a restart clears active sessions. This is
acceptable for the first public proof, not for durable progression.

Cloudflare Containers is the preferred later always-integrated path when a
Workers Paid account is available. It can run this Linux image beside the
Worker, but it is not part of the free Workers plan.

## Acceptance checks

- Page source and client bundles contain no `127.0.0.1:8765`.
- `/api/health` reports `engine: Lean 4 / imba-core`.
- Two clean cookie jars receive different session identifiers and independent
  initial states.
- An action in one session cannot change the other.
- An unavailable core returns a stable error and never invents a transition.
- Lean, Python, UI, and authority-audit tests pass before publication.
