import type { SoundCue } from "../sound";

export type StoryBeat = {
  state: string;
  speaker: string;
  line: string;
  responseSpeaker: string;
  response: string;
  cue: SoundCue;
};

export type StoryFigure = {
  asset: string;
  alt: string;
  eyebrow: string;
  name: string;
};

export type StorySceneDefinition = {
  id: string;
  kind: "OPENING" | "INTERLUDE";
  indexLabel: string;
  title: string;
  fieldLabel: string;
  boundary: string;
  boundaryLabel: string;
  left: StoryFigure;
  right: StoryFigure;
  beats: readonly StoryBeat[];
  exitLabel: string;
};

export type ChapterFinaleDefinition = {
  trigger: "JOURNEY_CHAPTER_CONFLICT" | "TUTORIAL_MASTERY";
  exit: "DISMISS" | "CHAPTER_MENU";
  header: string;
  protocol: string;
  left: StoryFigure;
  right: StoryFigure;
  contactLabel: string;
  contactFormula: string;
  kicker: string;
  title: string;
  bodyFallback: string;
  theorem: string;
  consequence: string;
  acceptLabel: string;
};

export type TutorialObservation =
  | "MANUAL_TICK"
  | "SPELL_CAST"
  | "NATURE_INTERRUPT"
  | "AXES_ROLL"
  | "PLANE_PROJECTION"
  | "SURRENDER_MEMORY"
  | "FIRST_STRIKE"
  | "WORLD_REACTION"
  | "PROTOCOL_CHOICE";

export type TutorialMilestone = {
  id: TutorialObservation;
  glyph: string;
  title: string;
  instruction: string;
};

export type StoryChapterDefinition = {
  id: string;
  order: number;
  numeral: string;
  publication: {
    state: "PUBLISHED";
    label: string;
  };
  title: string;
  subtitle: string;
  menu: {
    eyebrow: string;
    titleLines: readonly [string, string];
    synopsis: string;
    formula: string;
  };
  runtime: {
    id: "WORLD_JOURNEY_V1";
    start: "RESET_WORLD";
    progressLabel: string;
  };
  openingSceneId: string;
  scenes: readonly StorySceneDefinition[];
  tutorial?: {
    memoryVersion: number;
    milestones: readonly TutorialMilestone[];
  };
  finale: ChapterFinaleDefinition;
};

export type StoryPlayback = {
  chapterId: string;
  sceneId: string;
  beat: number;
};
