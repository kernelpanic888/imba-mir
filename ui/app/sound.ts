export const SOUND_CUES = {
  MENU_OPEN: {
    futureFile: "/audio/menu-open.ogg",
    bus: "UI",
    title: "Раскрытие главного меню",
  },
  MENU_SELECT: {
    futureFile: "/audio/menu-select.ogg",
    bus: "UI",
    title: "Подтверждение выбора",
  },
  PROLOGUE_FIELD: {
    futureFile: "/audio/prologue-field.ogg",
    bus: "AMBIENCE",
    title: "Чистое информационное поле",
  },
  SHADOW_VOICE: {
    futureFile: "/audio/shadow-voice.ogg",
    bus: "VOICE",
    title: "Голос Тени",
  },
  CURSE_PULSE: {
    futureFile: "/audio/curse-pulse.ogg",
    bus: "MAGIC",
    title: "Импульс заклятия",
  },
  WORLD_GATE: {
    futureFile: "/audio/world-gate.ogg",
    bus: "TRANSITION",
    title: "Проявление Мира",
  },
  SPELL_SEAL: {
    futureFile: "/audio/spell-seal.ogg",
    bus: "SPELL",
    title: "Печать заклинания",
  },
  MAGIC_BLOOM: {
    futureFile: "/audio/magic-bloom.ogg",
    bus: "MAGIC",
    title: "Рождение магии",
  },
} as const;

export type SoundCue = keyof typeof SOUND_CUES;

/**
 * Silent integration seam. Story code emits stable cue identifiers now;
 * the later sound engine can subscribe without changing scene timing.
 */
export function emitSoundCue(cue: SoundCue): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("imba:sound-cue", {
    detail: { cue, ...SOUND_CUES[cue], placeholder: true },
  }));
}
