# IMBA / MIR v0.1.5

![IMBA / MIR — The Raven on the Green Road](https://raw.githubusercontent.com/kernelpanic888/imba-mir/main/docs/assets/imba-mir-cover.png)

## [▶ PLAY IMBA / MIR](https://imba-mir-aleksey.kernelpanic888.chatgpt.site/)

Version `v0.1.5` restores the complete chapter selector on phones.

IMBA / MIR is both a **video game** and a **mathematics project**. Its living
World is executed through Lean 4; the interface is a visual projection of the
admitted state, never a substitute for it.

## Fixes

- Chapters 0, I, and II are visible together on narrow screens and each remains
  available with one touch.
- The chapter selector no longer hides entries in an unmarked horizontal strip.
- Mobile focus and hover feedback no longer shifts the menu.

## Verification

- UI production build and server render: PASS
- UI automated tests: 7/7 PASS
- Mobile menu verified at a 390 × 844 viewport

The development-only Vite error overlay seen on `localhost` is not part of the
published build. The public site serves the tested production bundle.
