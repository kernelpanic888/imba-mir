# IMBA sound placeholders

The prologue already emits these stable cue IDs, but deliberately plays no
audio until final assets are produced:

| Cue | Future file | Bus |
| --- | --- | --- |
| `MENU_OPEN` | `menu-open.ogg` | ui |
| `MENU_SELECT` | `menu-select.ogg` | ui |
| `PROLOGUE_FIELD` | `prologue-field.ogg` | ambience |
| `SHADOW_VOICE` | `shadow-voice.ogg` | voice |
| `CURSE_PULSE` | `curse-pulse.ogg` | magic |
| `WORLD_GATE` | `world-gate.ogg` | transition |
| `SPELL_SEAL` | `spell-seal.ogg` | spell |
| `MAGIC_BLOOM` | `magic-bloom.ogg` | magic |

The future audio engine should subscribe to the `imba:sound-cue` window event.
Missing files must remain silent and must never block a game transition.
