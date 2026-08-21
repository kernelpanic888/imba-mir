# IMBA / MIR v0.1.7

![IMBA / MIR — The Raven on the Green Road](https://raw.githubusercontent.com/kernelpanic888/imba-mir/main/docs/assets/imba-mir-cover.png)

## [▶ PLAY IMBA / MIR](https://imba-mir-aleksey.kernelpanic888.chatgpt.site/)

Version `v0.1.7` turns zero balance into a real playable crisis and makes Raven
death an achievable end of the current run.

## What changed

- `BALANCE LOST` pauses ordinary actions while both living sides remain alive.
- The player chooses one of three certified consequences: Anchor, Rewind, or
  Shadow.
- Lean raises only the lower life toward the higher one and returns the exact
  life, balance, tension, and Shadow costs.
- Every recovery is rendered in the Reality Slice with its actual values.
- If Raven life reaches zero, the Raven and current line return to Shadow. The
  run ends, while Chronicle progress and mastered geometries persist.
- A new illustrated full-screen crisis scene distinguishes recovery from the
  authored ending of the whole story.

## Formal rule

`lower' = min(higher, lower + (higher - lower) / 2 + target)`

Lean proves that recovery never lowers either life and preserves both living
sides when both entered the crisis alive.

## Verification

- Lean build and executable contract: pass.
- Python core/session tests: pass.
- Production UI build and rendered-interface tests: pass.

Author and creative direction: **Aleksey Salkutsan**. ChatGPT contributed to
research and concept development; Codex implemented, integrated, and verified
the release under the author's direction.
