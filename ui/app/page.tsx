"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { emitSoundCue, SOUND_CUES } from "./sound";
import { LocalizedTree, LOCALE_MEMORY_KEY, type Locale } from "./i18n";
import { ARCHIVE_GROUPS, AUTHOR_LINKS, AUTHOR_NAME } from "./sources";
import { FormulaEntity, FormulaIndividual, type FormulaEntityOrgan, type FormulaIndividualModel } from "./formula-individual";
import {
  ACTIVE_CHAPTER_MEMORY_KEY,
  DEFAULT_CHAPTER_ID,
  STORY_CHAPTERS,
  chapterCompletionMemoryKey,
  getStoryChapter,
  getStoryScene,
  storySceneMemoryKey,
  tutorialMemoryKey,
} from "./story/registry";
import type { StoryPlayback, TutorialObservation } from "./story/types";

type Piece = {
  id: string;
  owner: "player" | "system";
  row: number;
  col: number;
  rank: number;
  name: string;
  status: string;
};

type GameState = {
  seed: number;
  stage: number;
  round: number;
  actionPoints: number;
  lastRoll: number | null;
  d0Faces: number[];
  metaCharges: number;
  hyperCharges: number;
  riskMultiplier: number;
  securedReward: number;
  exposedReward: number;
  boardSize: number;
  obstacles: Array<{ row: number; col: number }>;
  pieces: Piece[];
  messages: string[];
};

type ApiResponse = {
  ok: boolean;
  state?: GameState;
  error?: string;
};

// The Worker keeps the browser on one origin and forwards /api/* to Lean.
const API_BASE = "";
const EMPTY_SIZE = 7;

type WorldLayer = { rank: number; name: string; tick: number };
type WorldSurrender = {
  cycle: number;
  reachedRank: number;
  reachedName: string;
  interruptedRank: number;
  interruptedName: string;
  plane: string;
  absorbed: number;
  damage: number;
  tensionGained: number;
  tensionAfter: number;
  complementPlane: string;
  reflectionAfter: number;
};
type DefenseRollView = {
  impact: number;
  axes: Record<"X" | "Y" | "Z" | "W", number>;
  planes: Array<{ id: string; power: number }>;
};
type DefenseView = {
  plane: string;
  planePower: number;
  complementPlane: string;
  complementPower: number;
  absorbed: number;
  damage: number;
  fullyBlocked: boolean;
};
type FirstStrikeView = {
  allowed: boolean;
  damage: number;
  confirmedTicks: number;
  previousTension: number;
  reflection: number;
  reason: string;
};
type LivingView = {
  identity: number;
  memory: Record<"X" | "Y" | "Z" | "W", number>;
  reflection: number;
  certificate: number;
  prefixGuard: boolean;
};
type ShadowView = {
  sliceDepth: number;
  visibleDepth: number;
  hasHiddenPrefix: boolean;
  boundary: "opaque";
  channel: string;
  relicOrder: number;
  lastRelic: string;
};
type CombatCertificateView = {
  epoch: number;
  parentHead: string;
  head: string;
  actor: "PLAYER" | "NATURE" | "WORLD";
  kind: "ATTACK" | "REACTION";
  payload: number;
  verdict: "APPEND" | "HOLD";
};
type ContinuityView = {
  identity: number;
  epoch: number;
  head: string;
  verdict: "GENESIS" | "APPEND" | "HOLD";
  pendingAttack: CombatCertificateView | null;
  lastAttack: CombatCertificateView | null;
  lastReaction: CombatCertificateView | null;
  route: ["OBSERVE", "ADMIT", "CERTIFY", "APPEND"];
  boundary: string;
};
type CalculationStepView = {
  label: string;
  expression: string;
  state: "ok" | "hold" | "wait" | "warn";
};
type CalculationSignalView = {
  symbol: string;
  label: string;
  value: string;
  state: "ok" | "hold" | "wait" | "warn";
};
type CalculationSceneView =
  | "tick"
  | "spell"
  | "manifest"
  | "interrupt"
  | "axes"
  | "projection"
  | "conservation"
  | "memory"
  | "attack"
  | "reaction"
  | "progress"
  | "reset"
  | "transition";
type CalculationView = {
  action: string;
  engine: string;
  boundary: string;
  durationMs: number;
  scene: CalculationSceneView;
  relation: string;
  signals: CalculationSignalView[];
  title: string;
  theorem: string;
  equation: string;
  steps: CalculationStepView[];
  result: string;
  verdict: string;
  eventForm?: WorldEventForm;
};
type SpellPerformanceView = {
  phase: "PROJECT" | "CONTACT" | "REJECT";
  source: string;
  intent: string;
  path: string;
  form: string;
  synergy: string;
  verdict: string;
};
type ActorVitalsView = {
  life: number;
  maxLife: number;
  condition: string;
};
type PlayerActorView = ActorVitalsView & { damageTaken: number };
type WorldVitalsView = {
  life: number;
  maxLife: number;
  reserve: number;
  load: number;
  shield: number;
};
type WorldActorView = ActorVitalsView & WorldVitalsView;
type WorldEventForm = "REGENERATION" | "BARRIER" | "REDISTRIBUTION" | "SCAR" | "OVERLOAD";
type WorldEventView = {
  class: "COMPENSATION";
  form: WorldEventForm;
  title: string;
  power: number;
  rawDamage: number;
  absorbed: number;
  directDamage: number;
  healing: number;
  reserveCost: number;
  backlash: number;
  before: WorldVitalsView;
  after: WorldVitalsView;
  reason: string;
};
type ProgressProtocolView = { id: "FORECAST" | "REFRACTION"; title: string; copy: string };
type ProgressionView = {
  discoveryMask: number;
  masteryMarks: number;
  pendingChoice: boolean;
  activeProtocol: ProgressProtocolView | null;
  options: ProgressProtocolView[];
  forecast: { form: WorldEventForm; title: string; power: number } | null;
  planePreview: { plane: string; damage: number; complementPlane: string } | null;
  horizons: Array<{ id: "NOW" | "CONFLICT" | "SESSION" | "CHRONICLE"; label: string; title: string; value: number; target: number }>;
  discovered: WorldEventForm[];
  totalForms: number;
};
type SpellSlot = "SOURCE" | "INTENT" | "PATH" | "FORM";
type SpellTermView = {
  slot: SpellSlot;
  id: string;
  phrase: string;
  force: number;
  coherence: number;
  resonance: number;
};
type SpellSynergyView = {
  id: "EDGEWAY" | "UMBRA" | "REVELATION" | "REMEMBRANCE" | "NOVA" | "RIFTBLADE";
  title: string;
  requires: Partial<Record<SpellSlot, string>>;
  force: number;
  coherence: number;
  resonance: number;
};
type SpellResultView = {
  source: string;
  sourcePhrase: string;
  intent: string;
  intentPhrase: string;
  path: string;
  pathPhrase: string;
  form: string;
  formPhrase: string;
  synergy: "NONE" | SpellSynergyView["id"];
  synergyTitle: string;
  synergyForce: number;
  synergyCoherence: number;
  synergyResonance: number;
  force: number;
  coherence: number;
  resonance: number;
  forceOk: boolean;
  coherenceOk: boolean;
  resonanceOk: boolean;
  outcome: "APPEND" | "APPEND_WITH_COST" | "HOLD";
  admitted: boolean;
  cost: number;
  reason: string;
};
type SpellView = {
  law: {
    forceNeed: number;
    coherenceNeed: number;
    resonanceNeed: number;
    pressure: "FORCE" | "COHERENCE" | "RESONANCE";
    complexity: 1 | 2 | 3;
    formRequired: boolean;
    synergyRequired: boolean;
    metaTier: 0 | 1;
    lexiconVariant: 0 | 1 | 2 | 3;
    terms: SpellTermView[];
    synergies: SpellSynergyView[];
  };
  attempts: number;
  last: SpellResultView | null;
};
type SpellFormulaEvaluation = {
  terms: SpellTermView[];
  synergy: SpellSynergyView | null;
  score: { force: number; coherence: number; resonance: number };
  deficit: number;
  penalty: number;
};
type JourneyView = {
  roadBricks: number;
  castleDistance: number;
  curseRemaining: number;
  chapter: string;
  castleReached: boolean;
  firstChapterDistance: number;
  worldTruthKnown: boolean;
  ravenForm: "CURSED_WALKER" | "WORLD_MAGUS";
  ravenFormTitle: string;
  chapterConflict: boolean;
  revelation: string;
  trouble: { active: boolean; id: string; title: string; copy: string; power: number };
  reason: string;
};
type WorldState = {
  seed: number;
  cycle: number;
  status: "awaiting_tick" | "awaiting_spell" | "awaiting_defense_roll" | "awaiting_plane" | "awaiting_world_reaction" | "defended" | "world_defeated";
  confirmedTicks: number;
  pendingTick: number | null;
  layers: WorldLayer[];
  shadow: ShadowView;
  interruptedLayer: WorldLayer | null;
  defenseRoll: DefenseRollView | null;
  selectedPlane: string | null;
  defense: DefenseView | null;
  totalDamage: number;
  internalTension: number;
  enemyDamage: number;
  firstStrikeUsed: boolean;
  firstStrike: FirstStrikeView | null;
  lastStrikeDamage: number | null;
  actors: { player: PlayerActorView; world: WorldActorView };
  worldEvent: WorldEventView | null;
  worldEvents: WorldEventView[];
  progression: ProgressionView;
  spell: SpellView | null;
  journey: JourneyView | null;
  living: LivingView;
  continuity: ContinuityView;
  calculation?: CalculationView;
  surrenders: WorldSurrender[];
  messages: string[];
};
type WorldResponse = { ok: boolean; state?: WorldState; error?: string };
type WorldAction = "tick" | "cast_spell" | "roll_defense" | "select_plane" | "confirm_defense" | "first_strike" | "world_reaction" | "surrender" | "choose_protocol";
type CalculationAction = WorldAction | "reset";

const pendingScene: Record<CalculationAction, CalculationSceneView> = {
  tick: "tick",
  cast_spell: "spell",
  roll_defense: "axes",
  select_plane: "projection",
  confirm_defense: "conservation",
  surrender: "memory",
  first_strike: "attack",
  world_reaction: "reaction",
  choose_protocol: "progress",
  reset: "reset",
};

const SPELL_SLOT_META: Record<SpellSlot, { glyph: string; label: string }> = {
  SOURCE: { glyph: "✦", label: "ИСТОЧНИК" },
  INTENT: { glyph: "◎", label: "НАМЕРЕНИЕ" },
  PATH: { glyph: "↝", label: "ПУТЬ" },
  FORM: { glyph: "⬡", label: "ФОРМА КОНТАКТА" },
};

const SPELL_TERM_GLYPHS: Record<string, string> = {
  WILL: "▲", SHADOW: "◒", RELEASE: "↟", REVEAL: "◉",
  MEMORY: "⧖", SPARK: "✧", BIND: "⊙", INVERT: "⇄",
  ROAD: "▰", ECHO: "≋", RIFT: "⫶", ORBIT: "◌",
  BLADE: "◆", VEIL: "◫", PRISM: "◇",
};

const SYNERGY_GLYPHS: Record<string, string> = {
  NONE: "○", EDGEWAY: "⟐", UMBRA: "◈", REVELATION: "✺",
  REMEMBRANCE: "⧗", NOVA: "✹", RIFTBLADE: "ϟ",
};

const SPELL_TOPOLOGIES = ["КОНТУР", "ПРИЗМА", "РАЗЛОМ", "ОРБИТА"] as const;

const WORLD_REACTION_GLYPHS: Record<WorldEventForm | "HOMEOSTASIS", string> = {
  HOMEOSTASIS: "○", REGENERATION: "✣", BARRIER: "⬡",
  REDISTRIBUTION: "⇌", SCAR: "⫷", OVERLOAD: "⌁",
};

function evaluateSpellFormula(
  law: SpellView["law"],
  choices: Record<SpellSlot, string | null>,
  slots: readonly SpellSlot[],
): SpellFormulaEvaluation {
  const terms = slots
    .map((slot) => law.terms.find((term) => term.slot === slot && term.id === choices[slot]))
    .filter((term): term is SpellTermView => Boolean(term));
  const synergy = law.synergies.find((candidate) =>
    Object.entries(candidate.requires).every(([slot, id]) => choices[slot as SpellSlot] === id),
  ) ?? null;
  const multiplier = law.metaTier ? 2 : 1;
  const score = terms.reduce(
    (total, term) => ({
      force: total.force + term.force,
      coherence: total.coherence + term.coherence,
      resonance: total.resonance + term.resonance,
    }),
    { force: 0, coherence: 0, resonance: 0 },
  );
  if (synergy) {
    score.force += synergy.force * multiplier;
    score.coherence += synergy.coherence * multiplier;
    score.resonance += synergy.resonance * multiplier;
  }
  const deficit = Math.max(0, law.forceNeed - score.force)
    + Math.max(0, law.coherenceNeed - score.coherence)
    + Math.max(0, law.resonanceNeed - score.resonance);
  return {
    terms,
    synergy,
    score,
    deficit,
    penalty: deficit + (law.synergyRequired && !synergy ? 4 : 0),
  };
}

function pendingCalculation(action: CalculationAction, world: WorldState | null): CalculationView {
  const ticks = world?.confirmedTicks ?? 0;
  const rank = world?.layers.at(-1)?.rank ?? 1;
  const certificate = world?.living.certificate ?? 0;
  const status = world?.status ?? "awaiting_tick";
  const isTick = action === "tick";
  const scene = pendingScene[action];
  return {
    action,
    engine: action === "reset" ? "HOST SESSION / Lean-authoritative world" : "LEAN 4 / imba-core",
    boundary: action === "reset" ? "SESSION RESET TRACE / NOT PRIVATE REASONING" : "FORMAL REDUCTION TRACE / NOT PRIVATE REASONING",
    durationMs: 6200,
    scene,
    relation: isTick ? "n ↦ n + 1" : `σ —${action}→ σ′`,
    signals: isTick
      ? [
          { symbol: "n", label: "ПОДТВЕРЖДЕНО", value: String(ticks), state: "ok" },
          { symbol: "Δ", label: "РУЧНОЙ ШАГ", value: "+1", state: "ok" },
          { symbol: "p", label: "ОЖИДАЕТ", value: "?", state: "wait" },
        ]
      : [
          { symbol: "σ", label: "СОСТОЯНИЕ", value: status, state: "ok" },
          { symbol: "→", label: "ДЕЙСТВИЕ", value: action.toUpperCase(), state: "ok" },
          { symbol: "σ′", label: "РЕЗУЛЬТАТ", value: "?", state: "wait" },
        ],
    title: isTick ? "Стадирование ручного тика" : "Передача перехода в Lean",
    theorem: isTick ? "stagedTick_is_next" : `dispatch / ${action}`,
    equation: isTick ? `stagedTick ${ticks} ⟶ ?` : `σ(${status}, r${rank}, C${certificate}) ⟶ ?`,
    steps: [
      { label: "OBSERVE", expression: `status=${status} · n=${ticks} · r=${rank} · C=${certificate}`, state: "ok" },
      { label: "ENCODE", expression: `imba-core ${isTick ? `tick-stage ${ticks} ${rank} ${certificate}` : action}`, state: "ok" },
      { label: "REDUCE", expression: "нормализация терма…", state: "wait" },
      { label: "VERIFY", expression: "ожидание проверяемого результата…", state: "wait" },
    ],
    result: "COMPUTING…",
    verdict: "RUNNING",
  };
}

function observedTutorialMechanics(world: WorldState): TutorialObservation[] {
  const observations: TutorialObservation[] = [];
  if (world.confirmedTicks > 0 || world.pendingTick !== null) observations.push("MANUAL_TICK");
  if ((world.journey?.roadBricks ?? 0) > 0) observations.push("SPELL_CAST");
  if (world.interruptedLayer || world.surrenders.length > 0) observations.push("NATURE_INTERRUPT");
  if (world.defenseRoll || world.surrenders.length > 0) observations.push("AXES_ROLL");
  if (world.selectedPlane || world.defense || world.surrenders.length > 0) observations.push("PLANE_PROJECTION");
  if (world.surrenders.length > 0) observations.push("SURRENDER_MEMORY");
  if (world.firstStrikeUsed) observations.push("FIRST_STRIKE");
  if (world.continuity.lastReaction || world.worldEvents.length > 0) observations.push("WORLD_REACTION");
  if (world.progression.activeProtocol) observations.push("PROTOCOL_CHOICE");
  return observations;
}

export default function WorldHome() {
  const [locale, setLocale] = useState<Locale>("en");
  const [world, setWorld] = useState<WorldState | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState("20260813");
  const [calculation, setCalculation] = useState<CalculationView | null>(null);
  const [spellChoices, setSpellChoices] = useState<Record<SpellSlot, string | null>>({ SOURCE: null, INTENT: null, PATH: null, FORM: null });
  const [spellPreview, setSpellPreview] = useState<{ slot: SpellSlot; termId: string } | null>(null);
  const [spellProjected, setSpellProjected] = useState(false);
  const [spellBindPulse, setSpellBindPulse] = useState(0);
  const [spellPerformance, setSpellPerformance] = useState<SpellPerformanceView | null>(null);
  const [spellResolution, setSpellResolution] = useState<SpellPerformanceView | null>(null);
  const [formulaSnapshot, setFormulaSnapshot] = useState<FormulaIndividualModel | null>(null);
  const [dismissedChapterFinale, setDismissedChapterFinale] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState(DEFAULT_CHAPTER_ID);
  const [storyPlayback, setStoryPlayback] = useState<StoryPlayback | null>(null);
  const [tutorialMarks, setTutorialMarks] = useState<TutorialObservation[]>([]);
  const [completedChapterIds, setCompletedChapterIds] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [metaphysicsOpen, setMetaphysicsOpen] = useState(false);
  const [runPanelOpen, setRunPanelOpen] = useState(false);
  const selectedChapter = useMemo(() => getStoryChapter(selectedChapterId), [selectedChapterId]);
  const playbackChapter = useMemo(
    () => storyPlayback ? getStoryChapter(storyPlayback.chapterId) : null,
    [storyPlayback],
  );
  const currentStoryScene = useMemo(
    () => playbackChapter && storyPlayback ? getStoryScene(playbackChapter, storyPlayback.sceneId) : null,
    [playbackChapter, storyPlayback],
  );
  const currentStoryBeat = currentStoryScene && storyPlayback ? currentStoryScene.beats[storyPlayback.beat] : null;

  useEffect(() => {
    const rememberedLocale = window.localStorage.getItem(LOCALE_MEMORY_KEY);
    if (rememberedLocale === "ru" || rememberedLocale === "en") setLocale(rememberedLocale);
    const completed = STORY_CHAPTERS.filter((candidate) => {
      if (window.localStorage.getItem(chapterCompletionMemoryKey(candidate.id)) === "complete") return true;
      if (!candidate.tutorial) return false;
      try {
        const marks = JSON.parse(window.localStorage.getItem(tutorialMemoryKey(candidate)) ?? "[]") as unknown;
        return Array.isArray(marks) && candidate.tutorial.milestones.every((milestone) => marks.includes(milestone.id));
      } catch {
        return false;
      }
    }).map((candidate) => candidate.id);
    setCompletedChapterIds(completed);
    const rememberedId = window.localStorage.getItem(ACTIVE_CHAPTER_MEMORY_KEY) ?? DEFAULT_CHAPTER_ID;
    const rememberedChapter = getStoryChapter(rememberedId);
    const rememberedUnlocked = STORY_CHAPTERS.filter((candidate) => candidate.order < rememberedChapter.order).every((candidate) => completed.includes(candidate.id));
    const chapter = rememberedUnlocked ? rememberedChapter : getStoryChapter(DEFAULT_CHAPTER_ID);
    setSelectedChapterId(chapter.id);
    if (window.localStorage.getItem(storySceneMemoryKey(chapter.id, chapter.openingSceneId)) !== "complete") {
      setStoryPlayback({ chapterId: chapter.id, sceneId: chapter.openingSceneId, beat: 0 });
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (!currentStoryBeat) return;
    emitSoundCue(currentStoryBeat.cue);
  }, [currentStoryBeat]);

  useEffect(() => {
    if (!selectedChapter.tutorial) {
      setTutorialMarks([]);
      return;
    }
    try {
      const stored = JSON.parse(window.localStorage.getItem(tutorialMemoryKey(selectedChapter)) ?? "[]") as unknown;
      const allowed = new Set(selectedChapter.tutorial.milestones.map((milestone) => milestone.id));
      setTutorialMarks(Array.isArray(stored) ? stored.filter((value): value is TutorialObservation => typeof value === "string" && allowed.has(value as TutorialObservation)) : []);
    } catch {
      setTutorialMarks([]);
    }
  }, [selectedChapter]);

  useEffect(() => {
    if (!world || !selectedChapter.tutorial) return;
    const observed = observedTutorialMechanics(world);
    setTutorialMarks((currentMarks) => {
      const merged = selectedChapter.tutorial!.milestones
        .map((milestone) => milestone.id)
        .filter((id) => currentMarks.includes(id) || observed.includes(id));
      if (merged.length === currentMarks.length && merged.every((id, index) => id === currentMarks[index])) return currentMarks;
      window.localStorage.setItem(tutorialMemoryKey(selectedChapter), JSON.stringify(merged));
      return merged;
    });
  }, [selectedChapter, world]);

  useEffect(() => {
    if (menuOpen) emitSoundCue("MENU_OPEN");
  }, [menuOpen]);

  useEffect(() => {
    if (!sourcesOpen) return;
    const closeArchive = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSourcesOpen(false);
    };
    window.addEventListener("keydown", closeArchive);
    return () => window.removeEventListener("keydown", closeArchive);
  }, [sourcesOpen]);

  useEffect(() => {
    if (!metaphysicsOpen) return;
    const closeReading = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMetaphysicsOpen(false);
    };
    window.addEventListener("keydown", closeReading);
    return () => window.removeEventListener("keydown", closeReading);
  }, [metaphysicsOpen]);

  useEffect(() => {
    if (!runPanelOpen) return;
    const closeRunPanel = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRunPanelOpen(false);
    };
    window.addEventListener("keydown", closeRunPanel);
    return () => window.removeEventListener("keydown", closeRunPanel);
  }, [runPanelOpen]);

  useEffect(() => {
    if (menuOpen) setRunPanelOpen(false);
    else {
      setSourcesOpen(false);
      setMetaphysicsOpen(false);
    }
  }, [menuOpen]);

  useEffect(() => {
    setDismissedChapterFinale(null);
  }, [selectedChapter.id]);

  const acceptWorld = useCallback((payload: WorldResponse) => {
    if (payload.state) {
      setWorld(payload.state);
      setSeed(String(payload.state.seed));
      if (payload.state.calculation) setCalculation(payload.state.calculation);
      const resolvedCalculation = payload.state.calculation;
      if (resolvedCalculation?.scene === "spell" && resolvedCalculation.verdict !== "RUNNING") {
        const resolvedSpell = payload.state.spell?.last;
        setSpellResolution({
          phase: resolvedCalculation.verdict === "APPEND" || resolvedCalculation.verdict === "APPEND_WITH_COST" ? "CONTACT" : "REJECT",
          source: resolvedSpell?.source ?? "NONE",
          intent: resolvedSpell?.intent ?? "NONE",
          path: resolvedSpell?.path ?? "NONE",
          form: resolvedSpell?.form ?? "DORMANT",
          synergy: resolvedSpell?.synergy ?? "NONE",
          verdict: resolvedCalculation.verdict,
        });
      }
    }
    if (!payload.ok) throw new Error(payload.error || "Мир отклонил действие");
  }, []);

  const loadWorld = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/state`, { cache: "no-store" });
      acceptWorld((await response.json()) as WorldResponse);
      setConnected(true);
      setError(null);
    } catch {
      setConnected(false);
      setError("Lean-ядро просыпается. Соединение восстановится автоматически…");
    }
  }, [acceptWorld]);

  useEffect(() => {
    void loadWorld();
    if (connected) return;
    const reconnect = window.setInterval(() => void loadWorld(), 1500);
    return () => window.clearInterval(reconnect);
  }, [connected, loadWorld]);

  const actWorld = useCallback(async (action: WorldAction, extra: Record<string, unknown> = {}) => {
    if (busy || !connected) return;
    setCalculation(pendingCalculation(action, world));
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      acceptWorld((await response.json()) as WorldResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Шаг не выполнен");
      setCalculation(null);
      if (action === "cast_spell") {
        setSpellPerformance(null);
        setSpellResolution(null);
      }
    } finally {
      setBusy(false);
    }
  }, [acceptWorld, busy, connected, world]);

  useEffect(() => {
    if (!calculation || calculation.verdict === "RUNNING") return;
    const timer = window.setTimeout(
      () => setCalculation(null),
      calculation.durationMs,
    );
    return () => window.clearTimeout(timer);
  }, [calculation]);

  useEffect(() => {
    if (calculation?.scene !== "spell") return;
    if (calculation.verdict === "RUNNING") emitSoundCue("SPELL_SEAL");
    if (calculation.verdict === "APPEND" || calculation.verdict === "APPEND_WITH_COST") emitSoundCue("MAGIC_BLOOM");
  }, [calculation?.scene, calculation?.verdict]);

  useEffect(() => {
    if (!spellResolution || spellPerformance?.phase !== "PROJECT") return;
    const timer = window.setTimeout(() => {
      setSpellPerformance(spellResolution);
      setSpellResolution(null);
    }, 1700);
    return () => window.clearTimeout(timer);
  }, [spellPerformance?.phase, spellResolution]);

  useEffect(() => {
    if (!spellPerformance || spellPerformance.phase === "PROJECT") return;
    const timer = window.setTimeout(() => setSpellPerformance(null), 2600);
    return () => window.clearTimeout(timer);
  }, [spellPerformance]);

  const pendingSpellTick = world?.status === "awaiting_spell" ? world.pendingTick : null;
  useEffect(() => {
    if (pendingSpellTick === null) return;
    setSpellChoices({ SOURCE: null, INTENT: null, PATH: null, FORM: null });
    setSpellPreview(null);
    setSpellProjected(false);
    setSpellBindPulse(0);
    setSpellPerformance(null);
    setSpellResolution(null);
  }, [pendingSpellTick]);

  const bindSpellTerm = useCallback((slot: SpellSlot, termId: string) => {
    setSpellPreview(null);
    setSpellChoices((currentChoices) => ({
      ...currentChoices,
      [slot]: currentChoices[slot] === termId ? null : termId,
    }));
    setSpellProjected(false);
    setSpellBindPulse((pulse) => pulse + 1);
  }, []);

  const resetWorld = useCallback(async () => {
    const value = Number(seed);
    if (!Number.isSafeInteger(value)) {
      setError("Код мира должен быть целым числом.");
      return false;
    }
    setBusy(true);
    setError(null);
    setCalculation(pendingCalculation("reset", world));
    try {
      const response = await fetch(`${API_BASE}/api/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: value }),
      });
      acceptWorld((await response.json()) as WorldResponse);
      setConnected(true);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Новый Мир не создан");
      setCalculation(null);
      return false;
    } finally {
      setBusy(false);
    }
  }, [acceptWorld, seed, world]);

  const status = world?.status ?? "awaiting_tick";
  const current = world?.layers.at(-1) ?? { rank: 1, name: "imba", tick: 0 };
  const nextTick = world ? world.confirmedTicks + 1 : 1;
  const visibleLayers = world?.layers ?? [current];
  const recentMessages = world?.messages.slice(-6).reverse() ?? ["Простая Imba проявлена из Тени."];
  const natureActive = status === "awaiting_defense_roll" || status === "awaiting_plane" || status === "defended";
  const reactionPending = status === "awaiting_world_reaction";
  const worldDefeated = status === "world_defeated";
  const progressChoicePending = world?.progression.pendingChoice ?? false;
  const spellLaw = world?.spell?.law ?? null;
  const spellSlots = (["SOURCE", "INTENT", "PATH", ...(spellLaw?.formRequired ? ["FORM" as const] : [])] as SpellSlot[]);
  const displayedSpellChoices = spellPreview
    ? { ...spellChoices, [spellPreview.slot]: spellPreview.termId }
    : spellChoices;
  const committedSpellEvaluation = spellLaw ? evaluateSpellFormula(spellLaw, spellChoices, spellSlots) : null;
  const spellEvaluation = spellLaw ? evaluateSpellFormula(spellLaw, displayedSpellChoices, spellSlots) : null;
  const selectedSpellTerms = spellEvaluation?.terms ?? [];
  const committedSpellComplete = (committedSpellEvaluation?.terms.length ?? 0) === spellSlots.length;
  // A hover may temporarily complete the *preview*, but only a click is allowed
  // to change the dialog's topology. Otherwise the rune list disappears under
  // the pointer and immediately reappears on leave, producing a visual loop.
  const spellComplete = committedSpellComplete;
  const spellAssemblyIndex = spellSlots.findIndex((slot) => !spellChoices[slot]);
  const nextSpellSlot = spellAssemblyIndex >= 0 ? spellSlots[spellAssemblyIndex] : null;
  const activeSynergy = spellEvaluation?.synergy ?? null;
  const committedSynergy = committedSpellEvaluation?.synergy ?? null;
  const spellReady = committedSpellComplete && (!spellLaw?.synergyRequired || Boolean(committedSynergy));
  const synergyMultiplier = spellLaw?.metaTier ? 2 : 1;
  const spellScore = spellEvaluation?.score ?? { force: 0, coherence: 0, resonance: 0 };
  const spellDeficit = spellEvaluation?.deficit ?? 0;
  let spellRepair: null | {
    slot: SpellSlot;
    from: SpellTermView;
    to: SpellTermView;
    evaluation: SpellFormulaEvaluation;
  } = null;
  if (spellLaw && spellComplete && spellEvaluation) {
    for (const slot of spellSlots) {
      const from = selectedSpellTerms.find((term) => term.slot === slot);
      if (!from) continue;
      for (const to of spellLaw.terms.filter((term) => term.slot === slot && term.id !== from.id)) {
        const choices = { ...displayedSpellChoices, [slot]: to.id };
        const evaluation = evaluateSpellFormula(spellLaw, choices, spellSlots);
        if (evaluation.penalty >= spellEvaluation.penalty) continue;
        if (!spellRepair || evaluation.penalty < spellRepair.evaluation.penalty) {
          spellRepair = { slot, from, to, evaluation };
        }
      }
    }
  }
  const spellQuality = !spellComplete
    ? { state: "building", label: `СБОРКА ${selectedSpellTerms.length}/${spellSlots.length}`, detail: nextSpellSlot ? `СЛЕДУЮЩАЯ РУНА: ${SPELL_SLOT_META[nextSpellSlot].label}` : "СОЕДИНИТЕ РУНЫ" }
    : spellLaw?.synergyRequired && !activeSynergy
      ? { state: "fractured", label: "СВЯЗЬ НЕ ЗАМКНУТА", detail: "ТРЕБУЕТСЯ СИНЕРГИЯ" }
      : spellDeficit === 0
        ? { state: "stable", label: "УСТОЙЧИВОЕ ЗАКЛИНАНИЕ", detail: "ПРОЕКЦИЯ: APPEND" }
        : spellDeficit === 1
          ? { state: "strained", label: "СИЛЬНОЕ, НО НА ГРАНИ", detail: "ПРОЕКЦИЯ: ЦЕНА +1" }
          : { state: "fractured", label: "ФОРМУЛА РАСПАДАЕТСЯ", detail: `ДЕФИЦИТ КАНАЛОВ: ${spellDeficit}` };
  const spellPhrase = selectedSpellTerms.map((term) => term.phrase).join(" → ");
  const weakSpellChannels = spellLaw ? [
    spellScore.force < spellLaw.forceNeed ? `СИЛА −${spellLaw.forceNeed - spellScore.force}` : null,
    spellScore.coherence < spellLaw.coherenceNeed ? `СВЯЗНОСТЬ −${spellLaw.coherenceNeed - spellScore.coherence}` : null,
    spellScore.resonance < spellLaw.resonanceNeed ? `РЕЗОНАНС −${spellLaw.resonanceNeed - spellScore.resonance}` : null,
  ].filter((channel): channel is string => Boolean(channel)) : [];
  const spellGuide = !spellComplete || !spellLaw
    ? null
    : spellDeficit === 0 && (!spellLaw.synergyRequired || activeSynergy)
      ? {
          state: "stable",
          title: "КАНАЛЫ СВЯЗАНЫ",
          detail: `F${spellScore.force} · C${spellScore.coherence} · R${spellScore.resonance}. Проекция устойчива; вердикт даст Lean.`,
        }
      : spellRepair
        ? {
            state: "repair",
            title: `ОСЛАБЛЕНО: ${weakSpellChannels.join(" · ") || "СИНЕРГИЯ"}`,
            detail: `Одна замена: «${spellRepair.from.phrase}» → «${spellRepair.to.phrase}». Каналы станут F${spellRepair.evaluation.score.force} · C${spellRepair.evaluation.score.coherence} · R${spellRepair.evaluation.score.resonance}.`,
          }
        : {
            state: "warning",
            title: spellLaw.synergyRequired && !activeSynergy ? "КОНТУР НЕ ОБРАЗУЕТ СИНЕРГИЮ" : `ОСЛАБЛЕНО: ${weakSpellChannels.join(" · ")}`,
            detail: "Одной заменой формулу не удержать. Разберите один узел и соберите другой контур; Проводник не выбирает заклинание вместо вас.",
          };
  const selectedTermFor = (slot: SpellSlot) => selectedSpellTerms.find((term) => term.slot === slot);
  const lastSpell = world?.spell?.last ?? null;
  const magicEmerging = calculation?.scene === "spell" && (calculation.verdict === "APPEND" || calculation.verdict === "APPEND_WITH_COST");
  const spellVisualActive = Boolean(spellPerformance);
  const spellVisualPhase = spellPerformance?.phase ?? "IDLE";
  const spellVisualSource = spellPerformance?.source ?? "NONE";
  const spellVisualIntent = spellPerformance?.intent ?? "NONE";
  const spellVisualPath = spellPerformance?.path ?? "NONE";
  const spellVisualForm = spellPerformance?.form ?? "DORMANT";
  const spellVisualSynergy = spellPerformance?.synergy ?? "NONE";
  const worldGesture = spellVisualPhase === "PROJECT" ? "WARN" : spellVisualPhase === "CONTACT" ? "RECEIVE" : spellVisualPhase === "REJECT" ? "RESIST" : reactionPending ? "COMPENSATE" : "IDLE";
  const journey = world?.journey;
  const roadPercent = journey?.castleDistance ? Math.min(100, journey.roadBricks / journey.castleDistance * 100) : 0;
  const tutorial = selectedChapter.tutorial ?? null;
  const tutorialMilestones = tutorial?.milestones ?? [];
  const tutorialComplete = Boolean(tutorial && tutorialMilestones.every((milestone) => tutorialMarks.includes(milestone.id)));
  useEffect(() => {
    if (!tutorialComplete) return;
    window.localStorage.setItem(chapterCompletionMemoryKey(selectedChapter.id), "complete");
    setCompletedChapterIds((completed) => completed.includes(selectedChapter.id) ? completed : [...completed, selectedChapter.id]);
  }, [selectedChapter.id, tutorialComplete]);
  const tutorialCurrent = tutorialMilestones.find((milestone) => !tutorialMarks.includes(milestone.id)) ?? null;
  const tutorialProgress = `${tutorialMarks.length}/${tutorialMilestones.length}`;
  const chapterFinaleReady = selectedChapter.finale.trigger === "TUTORIAL_MASTERY"
    ? tutorialComplete
    : Boolean(journey?.chapterConflict);
  const chapterFinaleKey = `${selectedChapter.id}:${selectedChapter.finale.trigger}`;
  const isChapterUnlocked = (chapterId: string) => {
    const chapter = getStoryChapter(chapterId);
    return STORY_CHAPTERS.filter((candidate) => candidate.order < chapter.order).every((candidate) => completedChapterIds.includes(candidate.id));
  };
  const menuProgress = tutorial
    ? `${tutorialProgress} МЕХАНИК`
    : `ШАГИ ПО ДОРОГЕ ${journey?.roadBricks ?? 0} · РУБЕЖ ${journey?.castleDistance ?? 12}`;
  const action: WorldAction = worldDefeated
    ? "tick"
    : reactionPending
    ? "world_reaction"
    : status === "awaiting_tick"
    ? "tick"
    : status === "awaiting_spell"
      ? "cast_spell"
      : status === "awaiting_defense_roll"
        ? "roll_defense"
        : status === "awaiting_plane"
          ? "confirm_defense"
          : "surrender";
  const actionLabel = progressChoicePending
    ? "ВЫБЕРИТЕ ПРОТОКОЛ НА ПОЛЕ"
    : worldDefeated
    ? "РАВНОВЕСИЕ НАРУШЕНО · СОЗДАТЬ НОВЫЙ МИР"
    : reactionPending
    ? "ПОДТВЕРДИТЬ РЕАКЦИЮ МИРА"
    : status === "awaiting_tick"
    ? `НАКОПИТЬ ТИК ${nextTick}`
    : status === "awaiting_spell"
      ? spellReady ? `СДЕЛАТЬ ШАГ ПО ДОРОГЕ ${world?.pendingTick ?? nextTick}` : spellLaw?.synergyRequired && committedSpellComplete && !committedSynergy ? "СОЗДАЙТЕ СИНЕРГИЮ" : "СОБЕРИТЕ ФОРМУЛУ"
      : status === "awaiting_defense_roll"
        ? "БРОСИТЬ МНОГООСЕВОЙ КУБ"
        : status === "awaiting_plane"
          ? world?.selectedPlane ? `ПОДТВЕРДИТЬ ПЛОСКОСТЬ ${world.selectedPlane}` : "ВЫБЕРИТЕ ПЛОСКОСТЬ"
          : "СДАТЬ СТОПКУ МИРУ";
  const actionSymbol = action === "tick" ? "+1" : action === "cast_spell" || action === "confirm_defense" || action === "world_reaction" ? "✓" : action === "roll_defense" ? "◇" : "↺";
  const actionDisabled = progressChoicePending || worldDefeated || busy || !connected || (status === "awaiting_plane" && !world?.selectedPlane) || (status === "awaiting_spell" && !spellReady);
  const decisionKicker = progressChoicePending
    ? "РУБЕЖ ХРОНИКИ ДОСТИГНУТ"
    : worldDefeated
    ? "БАЛАНС = 0 · ЭТО ПОРАЖЕНИЕ"
    : reactionPending
    ? "КОНТАКТ ДОПИСАН · РЕАКЦИЯ ОБЯЗАТЕЛЬНА"
    : status === "awaiting_tick" ? `СЛЕДУЮЩИЙ: ТИК ${nextTick}`
    : status === "awaiting_spell" ? "ТИК НАКОПЛЕН · КНИГА ОТКРЫТА"
    : status === "awaiting_defense_roll" ? "ПЕРЕБИТИЕ ПРИРОДЫ"
    : status === "awaiting_plane" ? world?.selectedPlane ? `ВЫБРАНА ${world.selectedPlane}` : "ВЫБЕРИТЕ 2 ИЗ 4 ОСЕЙ"
    : "ЗАЩИТА ЗАВЕРШЕНА";
  const decisionTitle = progressChoicePending
    ? "Выберите, что научиться видеть."
    : worldDefeated
    ? "Мир не выдержал вашего изменения."
    : reactionPending
    ? "Дайте Миру ответить."
    : status === "awaiting_tick" ? "Сделайте один тик."
    : status === "awaiting_spell" ? "Снимите фрагмент заклятия сами."
    : status === "awaiting_defense_roll" ? "Бросьте куб в четырёх осях."
    : status === "awaiting_plane" ? "Спроецируйте бросок в плоскость."
    : "Примите остаточное пробитие.";
  const decisionCopy = progressChoicePending
    ? "Это горизонтальный рост: Протокол открывает новую информацию, но не добавляет скрытой силы и не отменяет риск. Выбор постоянен для Хроники."
    : worldDefeated
    ? "Цель — не уничтожить другую сторону, а пройти через взаимодействие, сохранив жизнь Ворона и живого Мира. Сбросьте код и попробуйте удержать равновесие."
    : reactionPending
    ? "Контакт уже имеет сертификат и точного родителя, но изменение ещё не применено. Только соседняя реакция Мира завершит пару и зафиксирует результат."
    : status === "awaiting_tick" ? "Ничего не проявляется само: один ввод создаёт ровно один ожидающий тик."
    : status === "awaiting_spell" ? "Выберите источник, намерение и путь. Lean проверит морфизм; только допустимая формула станет Imba + 1 и шагом по зелёной дороге."
    : status === "awaiting_defense_roll" ? "Перебитая фишка уже ушла обратно в Тень. Lean-ядро выдаст координаты защиты X, Y, Z, W."
    : status === "awaiting_plane" ? "Выбранная плоскость поглощает свои две оси. Дополнительная плоскость остаётся открытой и формирует урон и память."
    : `Плоскость ${world?.defense?.plane} поглотила ${world?.defense?.absorbed}; открытая ${world?.defense?.complementPlane} оставила пробитие ${world?.defense?.damage}. После сдачи вся линия уйдёт в Тень.`;
  const playerActor = world?.actors.player ?? { life: 100, maxLife: 100, damageTaken: 0, condition: "READY" };
  const worldActor = world?.actors.world ?? { life: 100, maxLife: 100, reserve: 30, load: 0, shield: 0, condition: "HOMEOSTASIS" };
  const worldEvent = world?.worldEvent ?? null;
  const worldForm = worldEvent?.form ?? "HOMEOSTASIS";
  const shownAttack = world?.continuity.pendingAttack ?? world?.continuity.lastAttack ?? null;
  const shownReaction = world?.continuity.lastReaction ?? null;
  const reactionGlyph = WORLD_REACTION_GLYPHS[worldForm];
  const playerLifePercent = Math.max(0, Math.min(100, playerActor.maxLife ? playerActor.life / playerActor.maxLife * 100 : 0));
  const worldLifePercent = Math.max(0, Math.min(100, worldActor.maxLife ? worldActor.life / worldActor.maxLife * 100 : 0));
  const balanceIndex = Math.round(Math.max(0, Math.min(playerLifePercent, worldLifePercent) - Math.abs(playerLifePercent - worldLifePercent) * 0.5));
  const balanceState = worldDefeated || balanceIndex === 0 ? "BROKEN" : balanceIndex < 35 ? "CRITICAL" : balanceIndex < 65 ? "UNSTABLE" : "HELD";
  const balanceLabel = balanceState === "BROKEN" ? "РАЗРУШЕНО" : balanceState === "CRITICAL" ? "КРИТИЧНО" : balanceState === "UNSTABLE" ? "НЕУСТОЙЧИВО" : "УДЕРЖАНО";
  const calculationBattlePhase = calculation?.scene === "tick" ? "TICK"
    : calculation?.scene === "spell" ? "SPELL_AUDIT"
    : calculation?.scene === "manifest" ? "MANIFEST"
    : calculation?.scene === "interrupt" ? "INTERRUPT"
    : calculation?.scene === "axes" ? "AXES"
    : calculation?.scene === "projection" ? "PROJECTION"
    : calculation?.scene === "conservation" ? "CONSERVATION"
    : calculation?.scene === "memory" ? "MEMORY"
    : calculation?.scene === "attack" ? "RAVEN_ATTACK"
    : calculation?.scene === "reaction" ? "WORLD_REACTION"
    : calculation?.scene === "progress" ? "PROGRESS"
    : calculation?.scene === "reset" ? "RESET"
    : calculation?.scene === "transition" ? "TRANSITION"
    : null;
  const battlePhase = worldDefeated
    ? "END"
    : spellVisualPhase === "PROJECT"
      ? "CAST"
      : spellVisualPhase === "CONTACT"
        ? "IMPACT"
        : spellVisualPhase === "REJECT"
          ? "HOLD"
          : calculationBattlePhase
            ? calculationBattlePhase
            : status === "awaiting_spell"
            ? "FORMULA"
            : reactionPending
                ? "COUNTER_WINDOW"
                : status === "awaiting_defense_roll"
                    ? "WORLD_ATTACK"
                    : status === "awaiting_plane"
                      ? "DEFENSE"
                      : status === "defended"
                        ? "AFTERMATH"
                        : "IDLE";
  const battlePhaseLabel = battlePhase === "FORMULA" ? "СБОРКА ФОРМУЛЫ"
    : battlePhase === "TICK" ? "ТИК ВХОДИТ В СОСТОЯНИЕ"
    : battlePhase === "SPELL_AUDIT" ? "LEAN ПРОВЕРЯЕТ ФОРМУЛУ"
    : battlePhase === "MANIFEST" ? "ФИШКА ПРОЯВЛЯЕТСЯ ИЗ ТЕНИ"
    : battlePhase === "INTERRUPT" ? "ПРИРОДА ПЕРЕБИВАЕТ ЛИНИЮ"
    : battlePhase === "AXES" ? "БРОСОК В ЧЕТЫРЁХ ОСЯХ"
    : battlePhase === "PROJECTION" ? "ПРОЕКЦИЯ В ПЛОСКОСТЬ"
    : battlePhase === "CONSERVATION" ? "ЗАЩИТА ПОГЛОЩАЕТ ИМПУЛЬС"
    : battlePhase === "MEMORY" ? "ЛИНИЯ УХОДИТ В ТЕНЬ"
    : battlePhase === "PROGRESS" ? "ОТКРЫТ НОВЫЙ ПРОТОКОЛ"
    : battlePhase === "RESET" ? "РОЖДАЕТСЯ НОВЫЙ МИР"
    : battlePhase === "TRANSITION" ? "СОСТОЯНИЕ ПЕРЕХОДИТ ГРАНИЦУ"
    : battlePhase === "CAST" ? "МАГИЯ ИДЁТ К МИРУ"
    : battlePhase === "IMPACT" ? "КОНТАКТ С МИРОМ"
    : battlePhase === "HOLD" ? "ФОРМУЛА НЕ ДОПУЩЕНА"
    : battlePhase === "WORLD_ATTACK" ? "МИР ПОСЫЛАЕТ ИМПУЛЬС"
    : battlePhase === "DEFENSE" ? "ВОРОН СТРОИТ ЗАЩИТУ"
    : battlePhase === "AFTERMATH" ? "ОСТАТОЧНОЕ ПРОБИТИЕ"
    : battlePhase === "RAVEN_ATTACK" ? "КОНТАКТ ВОРОНА"
    : battlePhase === "COUNTER_WINDOW" ? "МИР ГОТОВИТ ОТВЕТ"
    : battlePhase === "WORLD_REACTION" ? "МИР ОТВЕЧАЕТ"
    : battlePhase === "END" ? "РАВНОВЕСИЕ РАЗРУШЕНО"
    : "СРЕЗ РЕАЛЬНОСТИ";
  const battlePhaseDetail = battlePhase === "FORMULA"
    ? spellPhrase || `РУНА ${selectedSpellTerms.length + 1}/${spellSlots.length}`
    : battlePhase === "TICK"
      ? `ТИК ${world?.pendingTick ?? nextTick} · РУЧНОЕ ПОДТВЕРЖДЕНИЕ`
      : battlePhase === "AXES"
        ? world?.defenseRoll ? `X${world.defenseRoll.axes.X} · Y${world.defenseRoll.axes.Y} · Z${world.defenseRoll.axes.Z} · W${world.defenseRoll.axes.W}` : calculation?.result ?? "X · Y · Z · W"
        : battlePhase === "PROJECTION"
          ? `${world?.selectedPlane ?? "?"} → ${world?.defense?.complementPlane ?? "?"}`
          : battlePhase === "CONSERVATION"
            ? `ПОГЛОЩЕНО ${world?.defense?.absorbed ?? 0} · ПРОБИТИЕ ${world?.defense?.damage ?? 0}`
            : battlePhase === "MEMORY"
              ? `Σ${world?.shadow?.sliceDepth ?? 0} · СЛЕД СОХРАНЁН`
              : battlePhase === "PROGRESS"
                ? world?.progression.activeProtocol?.title ?? calculation?.result ?? "ГОРИЗОНТ РАСШИРЕН"
                : battlePhase === "RESET"
                  ? `КОД МИРА ${seed}`
                  : battlePhase === "MANIFEST"
                    ? `R${current.rank} · ${current.name}`
                    : battlePhase === "INTERRUPT"
                      ? `ПРЕРВАНО НА ТИКЕ ${world?.interruptedLayer?.tick ?? nextTick}`
                      : battlePhase === "TRANSITION"
                        ? calculation?.relation ?? "σ → σ′"
    : battlePhase === "DEFENSE"
      ? world?.selectedPlane ? `ПЛОСКОСТЬ ${world.selectedPlane}` : "ВЫБОР ПЛОСКОСТИ"
      : battlePhase === "AFTERMATH"
        ? `ПРОБИТИЕ ${world?.defense?.damage ?? 0}`
        : battlePhase === "COUNTER_WINDOW"
          ? `КОНТАКТ ${world?.continuity.pendingAttack?.payload ?? 0} · ИЗМЕНЕНИЕ УДЕРЖАНО`
          : battlePhase === "WORLD_REACTION"
            ? `${worldEvent?.form ?? "HOMEOSTASIS"} · ${shownReaction?.payload ?? 0}`
            : battlePhase === "IDLE"
                ? `ВОРОН ${playerActor.life} · МИР ${worldActor.life}`
                : calculation?.result ?? battlePhaseLabel;
  const battleGlyph = battlePhase === "FORMULA" ? "◇"
    : battlePhase === "TICK" ? "+1"
    : battlePhase === "SPELL_AUDIT" ? "λ"
    : battlePhase === "MANIFEST" ? "↥"
    : battlePhase === "INTERRUPT" ? "⊥"
    : battlePhase === "AXES" ? "✣"
    : battlePhase === "PROJECTION" ? "⊿"
    : battlePhase === "CONSERVATION" ? "∥"
    : battlePhase === "MEMORY" ? "Σ"
    : battlePhase === "PROGRESS" ? "⌁"
    : battlePhase === "RESET" ? "↺"
    : battlePhase === "TRANSITION" ? "⇢"
    : battlePhase === "CAST" ? "➜"
    : battlePhase === "IMPACT" ? "✦"
    : battlePhase === "HOLD" ? "⊘"
    : battlePhase === "WORLD_ATTACK" ? "≋"
    : battlePhase === "DEFENSE" ? "⬡"
    : battlePhase === "AFTERMATH" ? "Δ"
    : battlePhase === "RAVEN_ATTACK" ? "✧"
    : battlePhase === "COUNTER_WINDOW" ? "?"
    : battlePhase === "WORLD_REACTION" ? reactionGlyph
    : battlePhase === "END" ? "∅"
    : "·";
  const battleRavenState = battlePhase === "DEFENSE" || battlePhase === "CONSERVATION" ? "GUARD"
    : battlePhase === "AFTERMATH" && (world?.defense?.damage ?? 0) > 0 ? "HIT"
    : "STILL";
  const battleWorldState = battlePhase === "CAST" ? "WARN"
    : battlePhase === "IMPACT" ? "RECEIVE"
    : battlePhase === "HOLD" ? "RESIST"
    : battlePhase === "COUNTER_WINDOW" || battlePhase === "WORLD_REACTION" || battlePhase === "AXES" || battlePhase === "PROJECTION" ? "COMPENSATE"
    : battlePhase === "END" || battlePhase === "RESET" ? "COLLAPSE"
    : "STILL";
  const buildingFreshFormula = status === "awaiting_spell" && !spellPerformance;
  const battleFormulaSource = buildingFreshFormula ? displayedSpellChoices.SOURCE ?? "NONE" : spellPerformance?.source ?? lastSpell?.source ?? "NONE";
  const battleFormulaIntent = buildingFreshFormula ? displayedSpellChoices.INTENT ?? "NONE" : spellPerformance?.intent ?? lastSpell?.intent ?? "NONE";
  const battleFormulaPath = buildingFreshFormula ? displayedSpellChoices.PATH ?? "NONE" : spellPerformance?.path ?? lastSpell?.path ?? "NONE";
  const battleFormulaForm = buildingFreshFormula ? displayedSpellChoices.FORM ?? "DORMANT" : spellPerformance?.form ?? lastSpell?.form ?? "DORMANT";
  const battleFormulaSynergy = buildingFreshFormula ? activeSynergy?.id ?? "NONE" : spellPerformance?.synergy ?? lastSpell?.synergy ?? "NONE";
  const battleFormulaNodes = [
    ["SOURCE", battleFormulaSource],
    ["INTENT", battleFormulaIntent],
    ["PATH", battleFormulaPath],
    ["FORM", battleFormulaForm],
    ["SYNERGY", battleFormulaSynergy],
  ] as const;
  const formulaEntityOrgans: FormulaEntityOrgan[] = battleFormulaNodes.map(([slot, term], index) => ({
    slot,
    term,
    glyph: slot === "SYNERGY" ? SYNERGY_GLYPHS[term] ?? "○" : SPELL_TERM_GLYPHS[term] ?? String(index + 1),
    filled: term !== "NONE" && term !== "DORMANT",
    current: status === "awaiting_spell" && slot !== "SYNERGY" && nextSpellSlot === slot,
  }));
  const formulaEntityBorn = formulaEntityOrgans.filter((organ) => organ.filled).length;
  const liveFormulaIndividual: FormulaIndividualModel = {
    identity: world?.living.identity ?? seed,
    tick: world?.pendingTick ?? nextTick,
    source: displayedSpellChoices.SOURCE ?? "NONE",
    intent: displayedSpellChoices.INTENT ?? "NONE",
    path: displayedSpellChoices.PATH ?? "NONE",
    form: spellLaw?.formRequired ? displayedSpellChoices.FORM ?? "NONE" : "DORMANT",
    synergy: activeSynergy?.id ?? "NONE",
    topology: spellLaw?.lexiconVariant ?? 0,
    complexity: spellLaw?.complexity ?? 1,
    metaTier: spellLaw?.metaTier ?? 0,
    pressure: spellLaw?.pressure ?? "NONE",
    quality: spellQuality.state,
    score: spellScore,
    need: {
      force: spellLaw?.forceNeed ?? 0,
      coherence: spellLaw?.coherenceNeed ?? 0,
      resonance: spellLaw?.resonanceNeed ?? 0,
    },
    phrase: spellPhrase,
  };
  const rememberedFormulaIndividual: FormulaIndividualModel = formulaSnapshot ?? {
    identity: world?.living.identity ?? seed,
    tick: current.tick,
    source: lastSpell?.source ?? "NONE",
    intent: lastSpell?.intent ?? "NONE",
    path: lastSpell?.path ?? "NONE",
    form: lastSpell?.form ?? "DORMANT",
    synergy: lastSpell?.synergy ?? "NONE",
    topology: 0,
    complexity: lastSpell?.form && lastSpell.form !== "DORMANT" ? 2 : 1,
    metaTier: lastSpell?.synergy && lastSpell.synergy !== "NONE" ? 1 : 0,
    pressure: "NONE",
    quality: lastSpell?.outcome === "HOLD" ? "fractured" : lastSpell?.outcome === "APPEND_WITH_COST" ? "strained" : lastSpell ? "stable" : "building",
    score: {
      force: lastSpell?.force ?? 0,
      coherence: lastSpell?.coherence ?? 0,
      resonance: lastSpell?.resonance ?? 0,
    },
    need: {
      force: lastSpell?.force ?? 0,
      coherence: lastSpell?.coherence ?? 0,
      resonance: lastSpell?.resonance ?? 0,
    },
    phrase: lastSpell ? [lastSpell.sourcePhrase, lastSpell.intentPhrase, lastSpell.pathPhrase, lastSpell.formPhrase].filter(Boolean).join(" → ") : "",
  };
  const realityFormulaIndividual = buildingFreshFormula ? liveFormulaIndividual : rememberedFormulaIndividual;
  const castConfiguredSpell = useCallback(() => {
    if (!spellChoices.SOURCE || !spellChoices.INTENT || !spellChoices.PATH) return;
    setFormulaSnapshot(liveFormulaIndividual);
    setSpellPerformance({
      phase: "PROJECT",
      source: spellChoices.SOURCE,
      intent: spellChoices.INTENT,
      path: spellChoices.PATH,
      form: spellLaw?.formRequired ? spellChoices.FORM ?? "DORMANT" : "DORMANT",
      synergy: committedSynergy?.id ?? "NONE",
      verdict: "RUNNING",
    });
    setSpellResolution(null);
    void actWorld("cast_spell", {
      source: spellChoices.SOURCE,
      intent: spellChoices.INTENT,
      path: spellChoices.PATH,
      form: spellLaw?.formRequired ? spellChoices.FORM ?? "DORMANT" : "DORMANT",
    });
  }, [actWorld, committedSynergy?.id, liveFormulaIndividual, spellChoices, spellLaw?.formRequired]);
  const triggerFieldReaction = useCallback(() => {
    if (!reactionPending || actionDisabled) return;
    void actWorld("world_reaction");
  }, [actWorld, actionDisabled, reactionPending]);

  const handleFieldReactionKey = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    triggerFieldReaction();
  }, [triggerFieldReaction]);

  const selectChapter = useCallback((chapterId: string) => {
    if (!isChapterUnlocked(chapterId)) return;
    const chapter = getStoryChapter(chapterId);
    setSelectedChapterId(chapter.id);
    window.localStorage.setItem(ACTIVE_CHAPTER_MEMORY_KEY, chapter.id);
    emitSoundCue("MENU_SELECT");
  }, [completedChapterIds]);

  const advanceStory = useCallback(() => {
    setStoryPlayback((playback) => {
      if (!playback) return null;
      const chapter = getStoryChapter(playback.chapterId);
      const scene = getStoryScene(chapter, playback.sceneId);
      if (playback.beat < scene.beats.length - 1) return { ...playback, beat: playback.beat + 1 };
      window.localStorage.setItem(storySceneMemoryKey(chapter.id, scene.id), "complete");
      return null;
    });
  }, []);

  const continueWorld = useCallback(() => {
    emitSoundCue("MENU_SELECT");
    window.localStorage.setItem(ACTIVE_CHAPTER_MEMORY_KEY, selectedChapter.id);
    setStoryPlayback(null);
    setMenuOpen(false);
  }, [selectedChapter.id]);

  const startSelectedChapter = useCallback(async () => {
    emitSoundCue("MENU_SELECT");
    window.localStorage.setItem(ACTIVE_CHAPTER_MEMORY_KEY, selectedChapter.id);
    window.localStorage.removeItem(storySceneMemoryKey(selectedChapter.id, selectedChapter.openingSceneId));
    if (selectedChapter.tutorial) {
      window.localStorage.removeItem(tutorialMemoryKey(selectedChapter));
      setTutorialMarks([]);
    }
    setMenuOpen(false);
    const ready = await resetWorld();
    if (!ready) {
      setMenuOpen(true);
      return;
    }
    if (selectedChapter.tutorial) setTutorialMarks([]);
    setStoryPlayback({ chapterId: selectedChapter.id, sceneId: selectedChapter.openingSceneId, beat: 0 });
  }, [resetWorld, selectedChapter]);

  const openSelectedOpening = useCallback(() => {
    emitSoundCue("MENU_SELECT");
    window.localStorage.setItem(ACTIVE_CHAPTER_MEMORY_KEY, selectedChapter.id);
    setMenuOpen(false);
    setStoryPlayback({ chapterId: selectedChapter.id, sceneId: selectedChapter.openingSceneId, beat: 0 });
  }, [selectedChapter]);

  const changeLocale = useCallback((nextLocale: Locale) => {
    setLocale(nextLocale);
    window.localStorage.setItem(LOCALE_MEMORY_KEY, nextLocale);
    document.documentElement.lang = nextLocale;
    emitSoundCue("MENU_SELECT");
  }, []);

  return (
    <LocalizedTree locale={locale}>
    <main className={`world-shell state-${status}`} lang={locale} data-locale={locale}>
      {menuOpen && (
        <section className="game-menu" role="dialog" aria-modal="true" aria-labelledby="game-menu-title">
          <div className="game-menu-atmosphere" aria-hidden="true">
            <div className="menu-sky-layer">
              <img src="/menu-virtual-storm-v1.webp" alt="" width={1600} height={900} decoding="async" fetchPriority="high" />
              <i className="menu-storm-front" />
              <i className="menu-lightning" />
            </div>
            <div className="menu-castle-layer">
              <img src="/menu-emerald-castle-v1.webp" alt="" width={1280} height={720} decoding="async" />
              <i />
            </div>
            <div className="menu-journey-layer">
              <div className="menu-green-road"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
              <div className="game-menu-raven" aria-hidden="true">
                <img src="/hero-crow-v2.webp" alt="" width={1024} height={683} decoding="async" />
                <i className="menu-raven-eye" />
              </div>
              <img className="game-menu-shadow" src="/hero-shadow-v1.webp" alt="" width={1024} height={683} decoding="async" />
              <span className="menu-boundary-signal"><i />Sh(D) ⇄ R<sub>D</sub></span>
            </div>
          </div>
          <header>
            <span>IMBA / МИР</span>
            <div className="game-menu-head-tools">
              <b>ГЛАВА {selectedChapter.numeral} · {selectedChapter.title}</b>
              <div className="game-menu-language" role="group" aria-label="Выбор языка">
                <span>ЯЗЫК</span>
                <button type="button" data-active={locale === "ru"} aria-pressed={locale === "ru"} onClick={() => changeLocale("ru")}><b>RU</b><small>Русский</small></button>
                <button type="button" data-active={locale === "en"} aria-pressed={locale === "en"} onClick={() => changeLocale("en")}><b>EN</b><small>English</small></button>
              </div>
              <button className="menu-metaphysics-trigger" type="button" onClick={() => { emitSoundCue("MENU_SELECT"); setSourcesOpen(false); setMetaphysicsOpen(true); }} aria-label="Человеческая метафизическая вычитка"><i>◇</i><span>МЕТАФИЗИКА</span></button>
            </div>
          </header>
          <div className="game-menu-copy">
            <small>{selectedChapter.menu.eyebrow}</small>
            <h1 id="game-menu-title">{selectedChapter.menu.titleLines[0]}<br />{selectedChapter.menu.titleLines[1]}</h1>
            <p>{selectedChapter.menu.synopsis}</p>
            <code>{selectedChapter.menu.formula}</code>
          </div>
          <nav className="game-menu-actions" aria-label="Главное меню">
            <div className="game-menu-chapters" role="list" aria-label="Доступные главы">
              {STORY_CHAPTERS.map((chapter) => {
                const unlocked = isChapterUnlocked(chapter.id);
                const chapterWord = locale === "en" ? "CHAPTER" : "ГЛАВА";
                return <button key={chapter.id} type="button" role="listitem" data-active={chapter.id === selectedChapter.id} data-locked={!unlocked} disabled={!unlocked} aria-label={unlocked ? `${chapterWord} ${chapter.numeral}: ${chapter.title}` : locale === "en" ? `Chapter ${chapter.numeral} is locked until the previous chapter is completed` : `Глава ${chapter.numeral} закрыта до прохождения предыдущей`} onClick={() => selectChapter(chapter.id)}>
                  <span>{String(chapter.order).padStart(2, "0")} / {chapterWord} {chapter.numeral}</span><b>{unlocked ? chapter.publication.label : locale === "en" ? "LOCKED ◇" : "ЗАКРЫТА ◇"}</b><small>{unlocked ? chapter.title : locale === "en" ? "COMPLETE THE PREVIOUS CHAPTER" : "ПРОЙДИТЕ ПРЕДЫДУЩУЮ ГЛАВУ"}</small>
                </button>;
              })}
            </div>
            <div className="author-frontier"><span>ОПУБЛИКОВАНО 0—1</span><b>ДАЛЬШЕ — ТОЛЬКО ПОСЛЕ АВТОРА</b></div>
            <button type="button" className="menu-primary" onClick={continueWorld} disabled={!connected}>
              <span>ПРОДОЛЖИТЬ</span><b>→</b><small>{connected ? `${selectedChapter.runtime.progressLabel} · ${menuProgress}` : "ЯДРО ПРОСЫПАЕТСЯ…"}</small>
            </button>
            <button type="button" onClick={() => void startSelectedChapter()} disabled={busy || !connected}>
              <span>НАЧАТЬ ГЛАВУ</span><b>↺</b><small>НОВЫЙ МИР + {getStoryScene(selectedChapter, selectedChapter.openingSceneId).indexLabel}</small>
            </button>
            <button type="button" onClick={openSelectedOpening}>
              <span>ВСТУПЛЕНИЕ</span><b>◫</b><small>{selectedChapter.subtitle}</small>
            </button>
            <button type="button" onClick={() => { emitSoundCue("MENU_SELECT"); setMetaphysicsOpen(false); setSourcesOpen(true); }}>
              <span>ИСТОЧНИКИ</span><b>⌘</b><small>АВТОР · ИИ-РОЛИ · АЛЛЮЗИЯ · МАТЕМАТИКА</small>
            </button>
          </nav>
          <footer>
            <a className="game-menu-author-link" href={AUTHOR_LINKS[0].href} target="_blank" rel="noreferrer" aria-label={`Основной сайт автора ${AUTHOR_NAME}`}>
              АВТОР / {AUTHOR_NAME.toUpperCase()} <i>↗</i>
            </a>
            <span className="game-menu-screen-note">ПОЛНЫЙ МИР РАСКРЫВАЕТСЯ НА ШИРОКОМ ЭКРАНЕ · ТЕЛЕФОН ПОКАЗЫВАЕТ ДЕМО-СРЕЗ</span>
            <span>LEAN CORE / {connected ? "ONLINE" : "CONNECTING"}</span>
          </footer>
          {sourcesOpen && (
            <section className="source-archive" role="dialog" aria-modal="true" aria-labelledby="source-archive-title">
              <header>
                <div><small>ИЗУМРУДНЫЙ АРХИВ / ДОКУМЕНТАЛЬНЫЙ СЛОЙ</small><h2 id="source-archive-title">ИСТОЧНИКИ МИРА</h2></div>
                <button type="button" onClick={() => setSourcesOpen(false)} aria-label="Закрыть источники"><span>ЗАКРЫТЬ</span><b>×</b><small>ESC</small></button>
              </header>
              <article className="source-author">
                <div><small>АВТОР ИГРЫ · ИССЛЕДОВАТЕЛЬ · ХРАНИТЕЛЬ КАНОНА</small><h3>{AUTHOR_NAME}</h3><p>IMBA — авторское переосмысление пути к Изумрудному городу, собранное из формальной математики, проверяемого кода и оригинального сюжета.</p></div>
                <nav aria-label="Ссылки автора">
                  {AUTHOR_LINKS.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noreferrer"><span>{link.label}</span><b>{link.title}</b><small>{link.note}</small><i>↗</i></a>)}
                </nav>
              </article>
              <div className="source-ledger" aria-label="Документальные источники игры">
                {ARCHIVE_GROUPS.map((group, groupIndex) => (
                  <section key={group.id} className="source-group">
                    <header><i>{group.glyph}</i><span><small>{String(groupIndex + 1).padStart(2, "0")} / КОНТУР</small><h3>{group.title}</h3><p>{group.subtitle}</p></span></header>
                    <div>{group.links.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noreferrer"><span>{link.label}</span><b>{link.title}</b><p>{link.note}</p><i>↗</i></a>)}</div>
                  </section>
                ))}
              </div>
              <footer><span>АЛЛЮЗИЯ ≠ АДАПТАЦИЯ</span><b>ВСЕ ССЫЛКИ ВЕДУТ К РЕАЛЬНЫМ ДОКУМЕНТАМ И ПРОФИЛЯМ</b><span>ESC / ВЕРНУТЬСЯ К ДОРОГЕ</span></footer>
            </section>
          )}
          {metaphysicsOpen && (
            <section className="metaphysics-reading" role="dialog" aria-modal="true" aria-labelledby="metaphysics-reading-title">
              <header>
                <div><small>ЧЕЛОВЕЧЕСКАЯ ВЫЧИТКА</small><h2 id="metaphysics-reading-title">ЧТО ЗДЕСЬ ПРОИСХОДИТ НА САМОМ ДЕЛЕ</h2><p>Без необходимости читать формулы</p></div>
                <button type="button" onClick={() => setMetaphysicsOpen(false)} aria-label="Закрыть метафизическую вычитку"><span>ЗАКРЫТЬ</span><b>×</b><small>ESC</small></button>
              </header>
              <div className="metaphysics-reading-grid">
                <article className="metaphysics-thesis"><i>00</i><h3>РЕАЛЬНОСТИ СТРОЯТСЯ ИЗ МАТЕМАТИКИ — РАЗВЕ ЭТО НЕ ЧИСТАЯ МАГИЯ?</h3><p>Здесь математика не описывает готовый Мир со стороны. Допустимые отношения, инварианты и переходы буквально собирают наблюдаемую реальность. Если формула может породить форму, след, память и ответ живого Мира — это и есть чистая магия.</p></article>
                <article><i>01</i><h3>ВОРОН НЕ ВОЮЕТ С МИРОМ</h3><p>Он вступает с живым Миром в контакт. Хороший ход не уничтожает противника, а проводит изменение так, чтобы сохранить и Ворона, и Мир.</p></article>
                <article><i>02</i><h3>ЗАКЛИНАНИЕ — ЭТО НАМЕРЕНИЕ</h3><p>Игрок собирает понятное человеческое высказывание из рун. Под ним находится строгая формула. Если переход сохраняет нужный инвариант, Lean допускает заклинание.</p></article>
                <article><i>03</i><h3>МАГИЯ — ЭТО СЛУЧИВШЕЕСЯ ИЗМЕНЕНИЕ</h3><p>Заклинание только предлагает переход. Магия появляется, когда Мир действительно принимает, преобразует или удерживает этот переход. Поэтому одно и то же намерение может оставить разные следы.</p></article>
                <article><i>04</i><h3>ПРИРОДА НЕ НАКАЗЫВАЕТ</h3><p>Каждый тик — подтверждённый шаг. Природа может перебить бесконечную линию в неизвестный момент. Это не случайное поражение, а ответ Мира: текущая форма больше не сохраняет равновесие.</p></article>
                <article><i>05</i><h3>ТЕНЬ ХРАНИТ НЕВИДИМОЕ</h3><p>Фишки не исчезают: они продолжают жить в Тени. В реальности виден только последний честный срез из трёх. Следы прошлого возвращаются как реликты, напряжение и новые возможности.</p></article>
                <article><i>06</i><h3>ДОРОГА — ЭТО ПРОГРЕСС ПОНИМАНИЯ</h3><p>Шаг по зелёной дороге появляется не за нажатие кнопки, а за удачно сконструированный и принятый контакт. Путь к Волшебнику измеряет, насколько глубоко Ворон научился читать устройство Мира.</p></article>
              </div>
              <footer><span>КОРОТКО</span><p>Соберите намерение → увидьте формулу → наблюдайте магию → прочитайте ответ Мира → сохраните равновесие → сделайте следующий шаг по дороге.</p></footer>
            </section>
          )}
        </section>
      )}
      {!menuOpen && playbackChapter && currentStoryScene && currentStoryBeat && storyPlayback && (
        <section className="story-prologue" role="dialog" aria-modal="true" aria-labelledby="story-scene-title" data-chapter={playbackChapter.id} data-scene={currentStoryScene.id}>
          <header>
            <span>ГЛАВА {playbackChapter.numeral} / {currentStoryScene.indexLabel} / {currentStoryScene.title}</span>
            <b>ЗВУК · {currentStoryBeat.cue} · ЗАГЛУШКА</b>
          </header>
          <div className="prologue-field">
            <figure className="prologue-raven">
              <img src={currentStoryScene.left.asset} alt={currentStoryScene.left.alt} />
              <figcaption><span>{currentStoryScene.left.eyebrow}</span><b>{currentStoryScene.left.name}</b></figcaption>
            </figure>
            <div className="prologue-boundary" aria-hidden="true"><i /><strong>{currentStoryScene.boundary}</strong><small>{currentStoryScene.boundaryLabel}</small></div>
            <figure className="prologue-shadow">
              <img src={currentStoryScene.right.asset} alt={currentStoryScene.right.alt} />
              <figcaption><span>{currentStoryScene.right.eyebrow}</span><b>{currentStoryScene.right.name}</b></figcaption>
            </figure>
          </div>
          <article className="prologue-dialogue" aria-live="polite">
            <small>{String(storyPlayback.beat + 1).padStart(2, "0")} / {String(currentStoryScene.beats.length).padStart(2, "0")} · {currentStoryBeat.state}</small>
            <h2 id="story-scene-title">{currentStoryBeat.speaker}</h2>
            <p>«{currentStoryBeat.line}»</p>
            <blockquote><span>{currentStoryBeat.responseSpeaker}</span> «{currentStoryBeat.response}»</blockquote>
          </article>
          <footer>
            <span>SOUND CUE / {SOUND_CUES[currentStoryBeat.cue].bus} / SILENT PLACEHOLDER</span>
            <button type="button" onClick={advanceStory}>{storyPlayback.beat === currentStoryScene.beats.length - 1 ? currentStoryScene.exitLabel : "ДАЛЕЕ"}<b>→</b></button>
          </footer>
        </section>
      )}
      <header className="world-topbar">
        <div className="world-scene-title">
          <span>СЦЕНА / ДВА ЖИВЫХ СЛОЯ</span>
          <b>СРЕЗ РЕАЛЬНОСТИ <i>⇄</i> МАГИЯ</b>
          <small>формула становится наблюдаемым действием</small>
        </div>
        <div className="world-core" data-connected={connected}>
          <button className="story-replay" type="button" onClick={() => setMenuOpen(true)}>МЕНЮ</button>
          <span className="world-core-light" />
          <div><b>{connected ? "LEAN-ЯДРО НА СВЯЗИ" : "МИР НЕДОСТУПЕН"}</b><small>{connected ? "каждый Imba + 1 подтверждён" : "ожидаем публичное Lean-ядро"}</small></div>
        </div>
      </header>

      {error && <div className="world-error" role="alert"><span>{error}</span>{!connected && <button onClick={() => void loadWorld()}>ПОВТОРИТЬ</button>}</div>}

      <section
        className="world-layout"
        data-run-open={runPanelOpen}
        onPointerDownCapture={(event) => {
          if (!runPanelOpen) return;
          const target = event.target as HTMLElement;
          if (target.closest("#world-run-panel") || target.closest(".run-panel-toggle")) return;
          event.preventDefault();
          event.stopPropagation();
          setRunPanelOpen(false);
        }}
      >
        <button
          className="run-panel-toggle"
          type="button"
          aria-expanded={runPanelOpen}
          aria-controls="world-run-panel"
          onClick={() => setRunPanelOpen((open) => !open)}
        >
          <span>{String(world?.cycle ?? 1).padStart(2, "0")}</span>
          <b>ЦИКЛ</b>
          <i>{runPanelOpen ? "←" : "→"}</i>
        </button>
        <button className="run-panel-scrim" type="button" tabIndex={runPanelOpen ? 0 : -1} aria-label="Закрыть состояние цикла" onPointerDown={() => setRunPanelOpen(false)} onClick={() => setRunPanelOpen(false)} />
        <aside id="world-run-panel" className="world-side world-run" data-open={runPanelOpen} aria-hidden={!runPanelOpen} aria-label="Состояние цикла и живой модели">
          <div className="world-label"><span>01</span><b>ЦИКЛ МИРА</b><button type="button" tabIndex={runPanelOpen ? 0 : -1} onClick={() => setRunPanelOpen(false)}>СВЕРНУТЬ <i>←</i></button></div>
          <div className="cycle-number"><small>ТЕКУЩИЙ ЦИКЛ</small><strong>{String(world?.cycle ?? 1).padStart(2, "0")}</strong></div>
          <dl className="world-facts">
            <div><dt>ПОДТВЕРЖДЕНО ТИКОВ</dt><dd>{world?.confirmedTicks ?? 0}</dd></div>
            <div><dt>ВИДИМЫЙ СРЕЗ</dt><dd>{world?.shadow?.visibleDepth ?? 1}/{world?.shadow?.sliceDepth ?? 3}</dd></div>
            <div><dt>ТЕНЕВАЯ ГРАНИЦА</dt><dd>{world?.shadow?.boundary === "opaque" ? "∂D" : "—"}</dd></div>
            <div><dt>ПОРЯДОК РЕЛИКТА</dt><dd>R{world?.shadow?.relicOrder ?? 0}</dd></div>
            <div><dt>ТЕКУЩИЙ РАНГ</dt><dd>r{current.rank}</dd></div>
            <div><dt>СЛЕД ПРИРОДЫ</dt><dd>{world?.totalDamage ?? 0}</dd></div>
            <div><dt>ВНУТРЕННЕЕ НАПРЯЖЕНИЕ</dt><dd>{world?.internalTension ?? 0}</dd></div>
            <div><dt>ГЛУБИНА РЕФЛЕКСИИ</dt><dd>{world?.living.reflection ?? 0}</dd></div>
            <div><dt>СЕРТИФИКАТ ТИКОВ</dt><dd>{world?.living.certificate ?? 0}</dd></div>
            <div><dt>ЭПОХА КОНТАКТА</dt><dd>Σ{world?.continuity.epoch ?? 0}</dd></div>
            <div><dt>ЖИЗНЬ ИГРОКА</dt><dd>{playerActor.life}/{playerActor.maxLife}</dd></div>
            <div><dt>ЖИЗНЬ МИРА</dt><dd>{worldActor.life}/{worldActor.maxLife}</dd></div>
            <div><dt>ОТМЕТКИ ХРОНИКИ</dt><dd>{world?.progression.masteryMarks ?? 0}</dd></div>
            <div><dt>АКТИВНЫЙ ПРОТОКОЛ</dt><dd className="fact-protocol">{world?.progression.activeProtocol?.title ?? "—"}</dd></div>
            <div><dt>ШАГИ ПО ДОРОГЕ / РУБЕЖ</dt><dd>{journey?.roadBricks ?? 0} · R{journey?.castleDistance ?? 12}</dd></div>
            <div><dt>ОСТАТОК ЗАКЛЯТИЯ</dt><dd>{journey?.curseRemaining ?? 12}</dd></div>
          </dl>
          <div className="current-imba"><span>ВЕРХ ВИДИМОГО СРЕЗА</span><strong>{current.name}</strong><small>проявлена из Тени на тике {current.tick}</small></div>
          <section className="living-card" aria-label="Живое состояние модели">
            <div className="living-head"><span>ЖИВОЕ СОСТОЯНИЕ / qₙ</span><b data-valid={world?.living.prefixGuard ?? true}>{world?.living.prefixGuard ?? true ? "PREFIX GUARD / OK" : "PREFIX GUARD / FAIL"}</b></div>
            <div className="living-identity"><small>НЕИЗМЕННАЯ ИДЕНТИЧНОСТЬ / ι</small><strong>{world?.living.identity ?? seed}</strong></div>
            <div className="memory-grid">
              {(["X", "Y", "Z", "W"] as const).map((axis) => <div key={axis}><span>{axis}</span><b>{world?.living.memory[axis] ?? 0}</b></div>)}
            </div>
            <p>Один принятый тик — один новый след. Перебитый Природой тик в историю не входит.</p>
          </section>
          <section className="continuity-card" aria-label="Непрерывность контактов и реакций">
            <div className="continuity-head"><span>КОНТАКТЫ / РЕАКЦИИ</span><b data-verdict={world?.continuity.verdict ?? "GENESIS"}>{world?.continuity.verdict ?? "GENESIS"}</b></div>
            <div className="continuity-route">
              {(world?.continuity.route ?? ["OBSERVE", "ADMIT", "CERTIFY", "APPEND"]).map((step, index) => <span key={step}><i>{index + 1}</i>{step}</span>)}
            </div>
            <p>{world?.continuity.pendingAttack
              ? `${world.continuity.pendingAttack.actor} / CONTACT / Σ${world.continuity.pendingAttack.epoch} ждёт прямую REACTION.`
              : world?.continuity.lastReaction
                ? `${world.continuity.lastAttack?.actor ?? "—"} / CONTACT → ${world.continuity.lastReaction.actor} / REACTION.`
                : "Голова взаимодействия ещё пуста: h0."}</p>
            <small>h{world?.continuity.head ?? 0} · ТОЧНЫЙ РОДИТЕЛЬ · ИГРОВОЕ ОБЯЗАТЕЛЬСТВО, НЕ КРИПТОПОДПИСЬ</small>
          </section>
          <p className="world-note">У линии нет абсолютного потолка. Момент перебития знает только Природа.</p>
        </aside>

        <section className="domain-zone" aria-label="Единое квадратное поле — Мир">
          <div className="domain-heading">
            <div><p className="world-kicker">ИГРОК ← ДОМЕН → ЖИВОЙ МИР</p><h2>{worldDefeated ? "РАВНОВЕСИЕ НАРУШЕНО" : natureActive ? "ЛИНИЯ ПЕРЕБИТА" : reactionPending ? "КОНТАКТ ЖДЁТ РЕАКЦИИ" : "ВЗАИМОДЕЙСТВИЕ / СОХРАНИТЬ ОБОИХ"}</h2></div>
            <span>{worldDefeated ? "BALANCE / BROKEN" : reactionPending ? `PLAYER CONTACT / Σ${world?.continuity.pendingAttack?.epoch ?? "—"}` : status === "awaiting_tick" ? "МИР ЖИВ · ЖДЁТ ТИК" : status === "awaiting_spell" ? `ЗАКЛЯТИЕ ГОТОВИТ ШАГ ПО ДОРОГЕ ${world?.pendingTick ?? nextTick}` : status === "defended" ? `ПРОБИТИЕ: ${world?.defense?.damage}` : "ФАЗА ЗАЩИТЫ"}</span>
          </div>
          <section className="world-law stage-world-law"><p><span>ЗАКОН</span> Тень недоступна напрямую. Граница оставляет в Мире реликт, а наблюдению открыты только три последние фишки.</p><strong>Sh(D) <i>→</i> R<sub>D</sub></strong></section>
          <div className="domain-stage-split">
            <section className="reality-stage-pane" aria-label="Живой срез реальности">
              <div className="stage-pane-label"><span>01 / СРЕЗ РЕАЛЬНОСТИ</span><b>{buildingFreshFormula ? `СУЩНОСТЬ · ${formulaEntityBorn}/5` : battlePhaseLabel}</b><small>ФОРМА → НАБЛЮДАЕМОЕ</small></div>
              <section
                className="header-battle-slice reality-stage-slice"
                data-phase={battlePhase}
                data-source={battleFormulaSource}
                data-intent={battleFormulaIntent}
                data-path={battleFormulaPath}
                data-form={battleFormulaForm}
                data-synergy={battleFormulaSynergy}
                data-projected={spellProjected}
                data-calculation={calculation?.scene ?? "NONE"}
                aria-label={`${battlePhaseLabel}: ${battlePhaseDetail}`}
              >
                <div className="infomagic-wind" aria-hidden="true">
                  <i className="infomagic-current infomagic-current--a"><b>∂D</b><b>Morᵢ</b><b>σ→σ′</b><b>F/C/R</b><b>λ</b><b>Rᴅ</b></i>
                  <i className="infomagic-current infomagic-current--b"><b>Sh(D)</b><b>ι</b><b>APPEND</b><b>qₙ</b><b>∑</b><b>∞</b></i>
                  <i className="infomagic-current infomagic-current--c"><b>OBSERVE</b><b>→</b><b>ADMIT</b><b>→</b><b>CERTIFY</b><b>→</b></i>
                  <i className="infomagic-current infomagic-current--d"><b>F</b><b>⟐</b><b>C</b><b>≋</b><b>R</b><b>◌</b><b>Φ</b></i>
                  <span className="infomagic-vortex"><i /><i /><i /></span>
                </div>
                <div className="header-combatant header-raven" data-state={battleRavenState}>
                  <img src="/hero-crow-v2.webp" alt="" decoding="async" />
                  <i><b style={{ width: `${playerLifePercent}%` }} /></i>
                  <span>ВОРОН · R{current.rank} · HP {playerActor.life}</span>
                </div>
                <div className="header-reality-lane">
                  <div className="header-formula-chain" key={`header-formula-${spellBindPulse}`} aria-label="Текущая формула заклинания">
                    {battleFormulaNodes.map(([slot, term], index) => <span key={slot} data-filled={term !== "NONE" && term !== "DORMANT"} data-current={status === "awaiting_spell" && slot !== "SYNERGY" && nextSpellSlot === slot}><i>{slot === "SYNERGY" ? SYNERGY_GLYPHS[term] ?? "○" : SPELL_TERM_GLYPHS[term] ?? String(index + 1)}</i><small>{slot === "SYNERGY" ? "⊗" : slot.slice(0, 1)}</small></span>)}
                  </div>
                  <div className="header-action-track">
                    <FormulaEntity model={realityFormulaIndividual} phase={battlePhase} organs={formulaEntityOrgans} className="header-formula-entity" />
                    <code className="header-formula-metrics">F{realityFormulaIndividual.score.force} · C{realityFormulaIndividual.score.coherence} · R{realityFormulaIndividual.score.resonance}</code>
                    <i className="header-green-road"><b /><b /><b /><b /><b /></i>
                    <i className="header-raven-guard"><b /></i>
                    <i className="header-magic-form header-magic-form--individual" aria-hidden="true">
                      <FormulaIndividual model={realityFormulaIndividual} phase={battlePhase} compact className="header-moving-individual" />
                      <b /><b />
                    </i>
                    <i className="header-world-force"><b /><b /></i>
                    <strong>{battleGlyph}</strong>
                  </div>
                  <div className="header-battle-caption"><b>{buildingFreshFormula ? `ЖИВОЕ · ${formulaEntityBorn}/5` : battlePhaseLabel}</b><span>{buildingFreshFormula ? realityFormulaIndividual.phrase || "ожидает материал" : battlePhaseDetail}</span></div>
                </div>
                <div className="header-combatant header-world" data-state={battleWorldState} data-form={worldForm}>
                  <div><i /><i /><i /><strong>{reactionGlyph}</strong></div>
                  <output className="reality-world-balance" data-state={balanceState} aria-label={`Главный критерий жизни: баланс ${balanceIndex} из 100; при нуле прохождение проиграно`}>
                    <small>КРИТЕРИЙ ЖИЗНИ</small><b>⚖ {balanceIndex}</b><span>{balanceLabel} · 0 = ПОРАЖЕНИЕ</span><i><em style={{ width: `${balanceIndex}%` }} /></i>
                  </output>
                  <i><b style={{ width: `${worldLifePercent}%` }} /></i>
                  <span>МИР · W{worldActor.shield} · HP {worldActor.life}</span>
                </div>
              </section>
              <footer className="reality-stage-ledger">
                <span>{realityFormulaIndividual.identity}</span>
                <b>{realityFormulaIndividual.phrase}</b>
                <code>F{realityFormulaIndividual.score.force}/{realityFormulaIndividual.need.force} · C{realityFormulaIndividual.score.coherence}/{realityFormulaIndividual.need.coherence} · R{realityFormulaIndividual.score.resonance}/{realityFormulaIndividual.need.resonance}</code>
              </footer>
            </section>
            <section className="magic-stage-pane" aria-label="Поле магии и контакта">
              <div className="stage-pane-label"><span>02 / МАГИЯ</span><b>{status === "awaiting_spell" ? "СБОРКА ФОРМЫ" : battlePhaseLabel}</b><small>НАБЛЮДАЕМОЕ → МИР</small></div>
              <div className="world-square">
            <span className="world-corner corner-a">МИР / 1</span><span className="world-corner corner-b">∞ НЕ ЯВЛЯЕТСЯ ЦЕЛЬЮ</span>
            <section className="progress-horizons" aria-label="Четыре горизонта прогресса">
              {(world?.progression.horizons ?? []).map((horizon) => {
                const percent = horizon.target > 0 ? Math.min(100, horizon.value / horizon.target * 100) : 0;
                return <article key={horizon.id} data-horizon={horizon.id}>
                  <span>{horizon.label}</span><b>{horizon.title}</b><small>{horizon.value}/{horizon.target}</small>
                  <i><em style={{ width: `${percent}%` }} /></i>
                </article>;
              })}
            </section>
            {tutorial && !tutorialComplete && tutorialCurrent && <section className="tutorial-compass" aria-live="polite" aria-label={`Обучение: освоено ${tutorialProgress} механик`}>
              <i aria-hidden="true">{tutorialCurrent.glyph}</i>
              <div><span>ПРОВОДНИК ОБУЧЕНИЯ · {tutorialProgress}</span><b>{tutorialCurrent.title}</b><small>{tutorialCurrent.instruction}</small></div>
              <ol aria-label="Прогресс обучения">{tutorialMilestones.map((milestone) => <li key={milestone.id} data-done={tutorialMarks.includes(milestone.id)} title={milestone.title}>{milestone.glyph}</li>)}</ol>
              <em>ШАГИ ПО ДОРОГЕ ∞ · ХОДЫ НЕ ОГРАНИЧЕНЫ</em>
            </section>}
            <section className="journey-layer" aria-label={`Путь ворона к Изумрудному замку: пройдено ${journey?.roadBricks ?? 0} шагов; первый сюжетный рубеж ${journey?.castleDistance ?? 12}`}>
              <div className="emerald-castle" aria-hidden="true"><i /><i /><i /><b>⌂</b></div>
              <div className="green-road" aria-hidden="true">
                {Array.from({ length: journey?.castleDistance ?? 12 }, (_, index) => (
                  <i key={index} data-lit={index < (journey?.roadBricks ?? 0)} />
                ))}
              </div>
              <img
                className="road-crow"
                data-form={journey?.ravenForm ?? "CURSED_WALKER"}
                src="/hero-crow-v2.webp"
                alt="Цифровой ворон идёт по зелёной дороге"
                style={{ "--road-progress": roadPercent } as React.CSSProperties}
              />
              <div className="road-meter"><span>{journey?.chapter ?? "0 / ОБУЧЕНИЕ"}</span><b>ШАГИ ПО ДОРОГЕ {journey?.roadBricks ?? 0} · ∞</b><small>РУБЕЖ R{journey?.castleDistance ?? 12} · ЗАКЛЯТИЕ {journey?.curseRemaining ?? 12}</small></div>
              {journey?.trouble.active && <div className="wizard-trouble"><span>ИЗ ЗАМКА / κ{journey.trouble.power}</span><b>{journey.trouble.title}</b><small>{journey.trouble.copy}</small></div>}
            </section>
            <div className="world-axis" aria-hidden="true"><i /><i /><i /></div><div className="infinite-mark" aria-hidden="true">∞</div>
            <section className="duel-stage" data-world-form={worldForm} aria-label="Игрок слева против живого Мира справа">
              <article className="duel-actor player-actor" data-condition={playerActor.condition} data-raven-form={journey?.ravenForm ?? "CURSED_WALKER"}>
                <div className="actor-ident"><span>01 / PLAYER</span><b>{journey?.worldTruthKnown ? "ВОРОН-МАГ" : "ВОРОН"}</b><small>{journey?.ravenFormTitle ?? playerActor.condition}</small></div>
                <div className="player-rig digital-crow-rig" data-form={journey?.ravenForm ?? "CURSED_WALKER"} aria-hidden="true"><i /><i /><i /><img src="/hero-crow-v2.webp" alt="" /><code>Mor<sub>I</sub></code></div>
                <div className="actor-life"><span>ЖИЗНЬ</span><b>{playerActor.life}<small> / {playerActor.maxLife}</small></b><div><i style={{ width: `${playerLifePercent}%` }} /></div></div>
                <p>РАНГ r{current.rank} · УРОН ПОЛУЧЕН {playerActor.damageTaken}</p>
              </article>

              <div className="exchange-lane" data-pending={reactionPending} data-spell-active={spellVisualActive}>
                <div className="balance-monitor" data-state={balanceState} aria-label={`Баланс ${balanceIndex} из 100. Формула: минимальная доля жизни минус половина разрыва между сторонами.`}>
                  <span>⚖ БАЛАНС</span><b>{balanceIndex}</b><small>{balanceLabel}</small><i><em style={{ width: `${balanceIndex}%` }} /></i>
                </div>
                <i className="spell-contact-flash" data-active={calculation?.scene === "spell" || calculation?.scene === "attack" || calculation?.scene === "reaction" || calculation?.scene === "interrupt"} aria-hidden="true" />
                {spellVisualActive && <div
                  className="spell-flight"
                  data-phase={spellVisualPhase}
                  data-source={spellVisualSource}
                  data-intent={spellVisualIntent}
                  data-path={spellVisualPath}
                  data-form={spellVisualForm}
                  data-synergy={spellVisualSynergy}
                  aria-label={`Заклинание проходит фазу ${spellVisualPhase}`}
                >
                  <i className="spell-flight-trail"><b /><b /><b /></i>
                  <strong className="spell-flight-core">{SPELL_TERM_GLYPHS[spellVisualSource] ?? "✦"}</strong>
                  <i className="spell-flight-echo"><b /><b /></i>
                  <i className="spell-flight-synergy"><b /><b /></i>
                  <span>{spellVisualPhase === "PROJECT" ? "ПРОЕКЦИЯ" : spellVisualPhase === "CONTACT" ? "КОНТАКТ" : "HOLD"}</span>
                </div>}
                <div className="combat-glyph-chain" data-state={reactionPending ? "WAITING" : worldEvent ? "RESOLVED" : "IDLE"}>
                  <div className="combat-glyph attack-glyph" data-active={Boolean(shownAttack)}>
                    <i aria-hidden="true">✦</i><span>КОНТАКТ</span><b>{shownAttack?.payload ?? 0}</b>
                  </div>
                  <em aria-hidden="true">{reactionPending ? "▶" : worldEvent ? "⇄" : "·"}</em>
                  <div className="combat-glyph reaction-glyph" data-active={Boolean(worldEvent)}>
                    <i aria-hidden="true">{reactionPending ? "?" : reactionGlyph}</i><span>{reactionPending ? "ОТВЕТ" : worldEvent?.form ?? "МИР"}</span><b>{reactionPending ? "…" : shownReaction?.payload ?? 0}</b>
                  </div>
                </div>
                <div className="combat-effects" aria-label="Итог последнего обмена">
                  <span data-kind="damage"><i>▼</i><b>−{worldEvent?.directDamage ?? 0}</b><small>HP МИРА</small></span>
                  <span data-kind="heal"><i>✚</i><b>+{worldEvent?.healing ?? 0}</b><small>ЛЕЧЕНИЕ</small></span>
                  <span data-kind="shield"><i>⬡</i><b>{worldActor.shield}</b><small>ЩИТ</small></span>
                  <span data-kind="load"><i>⌁</i><b>+{worldEvent?.backlash ?? 0}</b><small>НАГРУЗКА</small></span>
                </div>
                {spellVisualActive && <div className="spell-runtime-trace" data-phase={spellVisualPhase}>
                  <span>{spellVisualPhase === "PROJECT" ? "ПЕЧАТЬ → MORPHISM" : spellVisualPhase === "CONTACT" ? "MORPHISM → МИР" : "ИНВАРИАНТ НЕ СОХРАНЁН"}</span>
                  <code>{spellVisualSource} · {spellVisualIntent} · {spellVisualPath}</code>
                  <b>{spellPerformance?.verdict}</b>
                </div>}
                {world?.progression.forecast && <div className="protocol-forecast"><span>ПРЕДВЕСТНИК</span><b>{world.progression.forecast.form}</b><small>{world.progression.forecast.title} · κ{world.progression.forecast.power}</small></div>}
              </div>

              <article
                className="duel-actor world-actor"
                data-condition={worldActor.condition}
                data-form={worldForm}
                data-gesture={worldGesture}
                data-contact-source={spellVisualSource}
                data-reactive={reactionPending && !actionDisabled}
                role={reactionPending ? "button" : undefined}
                tabIndex={reactionPending && !actionDisabled ? 0 : undefined}
                aria-disabled={reactionPending ? actionDisabled : undefined}
                aria-label={reactionPending ? "Ответить Миром на контакт на игровом поле" : undefined}
                onClick={reactionPending ? triggerFieldReaction : undefined}
                onKeyDown={reactionPending ? handleFieldReactionKey : undefined}
              >
                <div className="actor-ident"><span>02 / WORLD</span><b>МИР</b><small>{worldActor.condition}</small></div>
                <div className="world-event-rig" aria-hidden="true"><i /><i /><i /><i /><strong>{reactionGlyph}</strong></div>
                {spellVisualActive && <div className="world-contact-language" data-phase={spellVisualPhase} aria-live="polite"><i />{spellVisualPhase === "PROJECT" ? "МИР СЧИТЫВАЕТ ФОРМУ" : spellVisualPhase === "CONTACT" ? "МИР ДОПУСТИЛ ИЗМЕНЕНИЕ" : "МИР УДЕРЖАЛ ФОРМУ"}</div>}
                {reactionPending && <div className="world-field-reaction"><b>КЛИКНИТЕ ПО МИРУ</b><small>ПРИНЯТЬ КОНТАКТ · СОЗДАТЬ РЕАКЦИЮ</small></div>}
                <div className="actor-life"><span>ЖИЗНЬ</span><b>{worldActor.life}<small> / {worldActor.maxLife}</small></b><div><i style={{ width: `${worldLifePercent}%` }} /></div></div>
                <div className="world-vitals"><span>β ЩИТ <b>{worldActor.shield}</b></span><span>R РЕЗЕРВ <b>{worldActor.reserve}</b></span><span>Λ НАГРУЗКА <b>{worldActor.load}</b></span></div>
                {worldEvent && <p className="world-event-name"><span>{reactionGlyph} {worldEvent.class}</span><b>{worldEvent.title}</b><small>▼ −{worldEvent.directDamage} HP · ✚ +{worldEvent.healing} · ⌁ +{worldEvent.backlash}</small></p>}
              </article>
            </section>
            <div className="shadow-plane" aria-label="Тень недоступна; внутри Мира наблюдается только реликт границы">
              <div className="shadow-orbit" aria-hidden="true" />
              <span>SH(D) / НЕДОСТУПНО</span><strong>R<sub>D</sub></strong><small>{world?.shadow?.lastRelic ?? "Реликт границы ещё не записан."}</small>
            </div>
            <div className="stack-stage" aria-label={`Видимый последний срез: ${world?.shadow?.visibleDepth ?? 1} из максимум 3 фишек`}>
              {world?.shadow?.hasHiddenPrefix && <span className="hidden-count">СКРЫТЫЙ ПРЕФИКС ЕСТЬ · ПРЯМОЕ НАБЛЮДЕНИЕ ЗАПРЕЩЕНО</span>}
              {visibleLayers.map((layer, index) => (
                <div className="imba-layer" key={`${layer.tick}-${layer.rank}`} style={{ "--layer": index } as React.CSSProperties}>
                  <span>T{String(layer.tick).padStart(2, "0")}</span><b>{layer.name}</b><em>r{layer.rank}</em>
                </div>
              ))}
              {status === "awaiting_spell" && <div className="pending-layer"><span>АКТ ЧИСТОГО ТВОРЕНИЯ / ТИК {world?.pendingTick}</span><b>ЗАКЛЯТИЕ → ЗАКЛИНАНИЕ → ШАГ ПО ДОРОГЕ</b><em>ФОРМУЛУ СОБИРАЕТ ИГРОК</em></div>}
              {reactionPending && <div className="pending-attack"><span>✦ PLAYER / CONTACT / Σ{world?.continuity.pendingAttack?.epoch}</span><b>✦ {world?.continuity.pendingAttack?.payload} ИМПУЛЬСА ▶ ?</b><em>ИЗМЕНЕНИЕ = 0, ПОКА МИР НЕ ОТВЕТИЛ</em></div>}
              {natureActive && world?.interruptedLayer && <div className="interrupted-layer"><span>ВОЗВРАЩАЕТСЯ В ТЕНЬ</span><b>{world.interruptedLayer.name}</b><em>r{world.interruptedLayer.rank}</em></div>}
            </div>
            {natureActive && <div className="nature-cut"><span>{status === "awaiting_defense_roll" ? `ПРИРОДА ПЕРЕБИЛА ТИК ${world?.interruptedLayer?.tick}` : status === "awaiting_plane" ? "РАЗЛОЖИТЕ БРОСОК В ПЛОСКОСТЬ" : `ОСТАТОЧНОЕ ПРОБИТИЕ ${world?.defense?.damage}`}</span></div>}
            {progressChoicePending && (
              <section className="protocol-choice" role="dialog" aria-modal="true" aria-labelledby="protocol-choice-title">
                <header><span>ХРОНИКА / РУБЕЖ 01</span><b>{world?.progression.masteryMarks ?? 0} MARK</b></header>
                <h3 id="protocol-choice-title">ВЫБЕРИТЕ ПЕРВЫЙ ПРОТОКОЛ</h3>
                <p>Не сила, а новый способ читать Мир. Выбор сохранится между циклами и новыми кодами Мира.</p>
                <div>{world?.progression.options.map((protocol) => <button key={protocol.id} disabled={busy} onClick={() => void actWorld("choose_protocol", { protocol: protocol.id })}><span>{protocol.id}</span><b>{protocol.title}</b><small>{protocol.copy}</small><i>ДОПУСТИТЬ →</i></button>)}</div>
              </section>
            )}
            {chapterFinaleReady && dismissedChapterFinale !== chapterFinaleKey && !calculation && (
              <section className="chapter-cutscene" role="dialog" aria-modal="true" aria-labelledby="chapter-conflict-title">
                <header><span>{selectedChapter.finale.header}</span><b>{selectedChapter.finale.protocol}</b></header>
                <div className="conflict-figures">
                  <div className="conflict-raven"><img src={selectedChapter.finale.left.asset} alt={selectedChapter.finale.left.alt} /><span>{selectedChapter.finale.left.eyebrow}</span><b>{selectedChapter.finale.left.name}</b></div>
                  <div className="conflict-contact"><i /><strong>{selectedChapter.finale.contactLabel}</strong><code>{selectedChapter.finale.contactFormula}</code></div>
                  <div className="conflict-wizard">
                    <img
                      className="story-wizard-portrait"
                      src={selectedChapter.finale.right.asset}
                      alt={selectedChapter.finale.right.alt}
                      width={720}
                      height={1199}
                      loading="lazy"
                      decoding="async"
                    />
                    <span>{selectedChapter.finale.right.eyebrow}</span><b>{selectedChapter.finale.right.name}</b>
                  </div>
                </div>
                <div className="conflict-story"><small>{selectedChapter.finale.kicker}</small><h3 id="chapter-conflict-title">{selectedChapter.finale.title}</h3><p>{selectedChapter.finale.trigger === "TUTORIAL_MASTERY" ? selectedChapter.finale.bodyFallback : journey?.revelation || selectedChapter.finale.bodyFallback}</p><code>{selectedChapter.finale.theorem}</code></div>
                <footer><span>{selectedChapter.finale.consequence}</span><button type="button" onClick={() => {
                  window.localStorage.setItem(chapterCompletionMemoryKey(selectedChapter.id), "complete");
                  setCompletedChapterIds((completed) => completed.includes(selectedChapter.id) ? completed : [...completed, selectedChapter.id]);
                  setDismissedChapterFinale(chapterFinaleKey);
                  if (selectedChapter.finale.exit === "CHAPTER_MENU") {
                    setStoryPlayback(null);
                    setMenuOpen(true);
                  }
                }}>{selectedChapter.finale.acceptLabel}</button></footer>
              </section>
            )}
            {status === "awaiting_spell" && spellLaw && !progressChoicePending && (
              <section
                className="spell-builder"
                role="dialog"
                aria-modal="true"
                aria-labelledby="spell-builder-title"
                data-topology={spellLaw.lexiconVariant}
                data-quality={spellQuality.state}
                data-complete={spellComplete}
                data-previewing={Boolean(spellPreview)}
              >
                <header><span>ИЗУМРУДНАЯ КНИГА / ТИК {world?.pendingTick}</span><b>{spellComplete ? "ФОРМУЛА СОБРАНА" : `РУНА ${selectedSpellTerms.length + 1} / ${spellSlots.length}`}</b></header>
                <div className="spell-builder-title">
                  <small>{spellPreview ? "ПРЕДПРОСМОТР · КЛИК — ЗАКРЕПИТЬ" : spellComplete ? `ТОПОЛОГИЯ ${SPELL_TOPOLOGIES[spellLaw.lexiconVariant]} · META ${spellLaw.metaTier}` : "ОДИН ВЫБОР — ОДНО ИЗМЕНЕНИЕ ЖИВОЙ ПЕЧАТИ"}</small>
                  <h3 id="spell-builder-title">{spellComplete ? "ПЕЧАТЬ ГОТОВА К ПРОЕКЦИИ" : `ВЫБЕРИТЕ: ${nextSpellSlot ? SPELL_SLOT_META[nextSpellSlot].label : "РУНУ"}`}</h3>
                  <p aria-live="polite">{spellPhrase || "СИЛА ЕЩЁ НЕ ИМЕЕТ ФОРМЫ"}</p>
                  <div
                    className="spell-loom"
                    data-source={displayedSpellChoices.SOURCE ?? "EMPTY"}
                    data-intent={displayedSpellChoices.INTENT ?? "EMPTY"}
                    data-path={displayedSpellChoices.PATH ?? "EMPTY"}
                    data-form={spellLaw.formRequired ? displayedSpellChoices.FORM ?? "EMPTY" : "DORMANT"}
                    data-synergy={activeSynergy?.id ?? "NONE"}
                  >
                    <FormulaIndividual key={spellBindPulse} model={liveFormulaIndividual} phase="FORMULA" className="spell-sigil" />
                    <div className="spell-bind-chain">
                      {spellSlots.map((slot, index) => {
                        const term = selectedTermFor(slot);
                        return <button
                          type="button"
                          key={slot}
                          data-filled={Boolean(term)}
                          data-current={slot === nextSpellSlot}
                          disabled={!term}
                          aria-label={term ? `Снять руну ${term.phrase} из узла ${SPELL_SLOT_META[slot].label}` : `Пустой узел ${SPELL_SLOT_META[slot].label}`}
                          onClick={term ? () => bindSpellTerm(slot, term.id) : undefined}
                        >
                          <small>{index + 1} · {SPELL_SLOT_META[slot].label}</small>
                          <i aria-hidden="true">{term ? SPELL_TERM_GLYPHS[term.id] ?? "◇" : "＋"}</i>
                          <b>{term?.phrase ?? "ПУСТОЙ УЗЕЛ"}</b>
                          {!term && slot === nextSpellSlot && <em className="spell-node-cue">ВЫБЕРИТЕ РУНУ ↓</em>}
                        </button>;
                      })}
                    </div>
                    <strong className="spell-quality" data-state={spellQuality.state}><span>{spellQuality.label}</span><small>{spellQuality.detail}</small></strong>
                  </div>
                </div>
                <div className="spell-growth" data-complexity={spellLaw.complexity} data-meta={spellLaw.metaTier}>
                  <span data-active="true"><i>Ⅰ</i><b>ОСНОВА</b><small>3 части</small></span>
                  <em>→</em>
                  <span data-active={spellLaw.formRequired}><i>Ⅱ</i><b>ФОРМА</b><small>{spellLaw.formRequired ? "открыта" : "шаг 4"}</small></span>
                  <em>→</em>
                  <span data-active={spellLaw.synergyRequired}><i>Ⅲ</i><b>СИНЕРГИЯ</b><small>{spellLaw.synergyRequired ? "обязательна" : "шаг 8"}</small></span>
                  <strong>◇ META {spellLaw.metaTier ? "×2" : "LOCK"}</strong>
                </div>
                <div
                  className="spell-rows"
                  data-complexity={spellLaw.complexity}
                  onClickCapture={(event) => {
                    const rune = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-slot][data-term]");
                    if (!rune || !event.currentTarget.contains(rune)) return;
                    const runeSlot = rune.dataset.slot as SpellSlot | undefined;
                    const termId = rune.dataset.term;
                    if (runeSlot && termId) bindSpellTerm(runeSlot, termId);
                  }}
                >
                  {spellSlots.map((slot, row) => (
                    <fieldset
                      key={slot}
                      data-state={spellChoices[slot] ? "bound" : slot === nextSpellSlot ? "current" : "open"}
                      data-visible={slot === nextSpellSlot}
                      data-label={`${SPELL_SLOT_META[slot].glyph} ${SPELL_SLOT_META[slot].label}`}
                    >
                      <legend><i>{row + 1}</i>{SPELL_SLOT_META[slot].label}</legend>
                      <div>{spellLaw.terms.filter((term) => term.slot === slot).map((term) => (
                        <button
                          type="button"
                          key={term.id}
                          data-selected={spellChoices[slot] === term.id}
                          data-preview={spellPreview?.slot === slot && spellPreview.termId === term.id}
                          data-slot={slot}
                          data-term={term.id}
                          aria-pressed={spellChoices[slot] === term.id}
                          aria-label={`${term.phrase}; сила ${term.force}, связность ${term.coherence}, резонанс ${term.resonance}`}
                          onPointerEnter={() => setSpellPreview({ slot, termId: term.id })}
                          onPointerLeave={() => setSpellPreview((current) => current?.slot === slot && current.termId === term.id ? null : current)}
                          onFocus={() => setSpellPreview({ slot, termId: term.id })}
                          onBlur={() => setSpellPreview((current) => current?.slot === slot && current.termId === term.id ? null : current)}
                        >
                          <i className="spell-term-glyph" aria-hidden="true">{SPELL_TERM_GLYPHS[term.id] ?? "◇"}</i><span>{term.id}</span><b>{term.phrase}</b><small>F{term.force} · C{term.coherence} · R{term.resonance}</small>
                        </button>
                      ))}</div>
                    </fieldset>
                  ))}
                </div>
                {spellComplete && <div className="spell-synergy" data-active={Boolean(activeSynergy)} data-required={spellLaw.synergyRequired}>
                  <i aria-hidden="true">{SYNERGY_GLYPHS[activeSynergy?.id ?? "NONE"]}</i>
                  <div><span>⊗ СИНЕРГИЯ {spellLaw.synergyRequired ? "/ ОБЯЗАТЕЛЬНА" : "/ ДОБРОВОЛЬНА"}</span><b>{activeSynergy?.title ?? (spellLaw.formRequired ? "Соедините совместимые руны" : "Откроется вместе с Формой")}</b><small>{activeSynergy ? `${activeSynergy.id} · F+${activeSynergy.force * synergyMultiplier} C+${activeSynergy.coherence * synergyMultiplier} R+${activeSynergy.resonance * synergyMultiplier}` : "◆+▰ · ◫+◒ · ◉+≋ · ⧖+≋+◫ · ✧+◌+◇ · ⇄+⫶+◆"}</small></div>
                  <strong>{spellLaw.metaTier ? "META ×2" : spellLaw.formRequired ? "META LOCK" : "TIER I"}</strong>
                </div>}
                {spellComplete && <div className="spell-audit">
                  {([
                    ["F", "СИЛА", spellScore.force, spellLaw.forceNeed],
                    ["C", "СВЯЗНОСТЬ", spellScore.coherence, spellLaw.coherenceNeed],
                    ["R", "РЕЗОНАНС", spellScore.resonance, spellLaw.resonanceNeed],
                  ] as const).map(([symbol, label, value, need]) => <div key={symbol} data-pass={value >= need}><span>{symbol} / {label}</span><b>{value}<small> / {need}</small></b><i><em style={{ width: `${Math.min(100, value / need * 100)}%` }} /></i></div>)}
                </div>}
                {spellGuide && <section className="spell-guide" data-state={spellGuide.state} aria-live="polite">
                  <i aria-hidden="true">φ</i>
                  <div><span>ИЗУМРУДНЫЙ ПРОВОДНИК / ПРОЕКЦИЯ · НЕ ВЕРДИКТ</span><b>{spellGuide.title}</b><small>{spellGuide.detail}</small></div>
                  {spellRepair && <button type="button" onClick={() => bindSpellTerm(spellRepair!.slot, spellRepair!.to.id)}><span>ПРИМЕНИТЬ 1 ЗАМЕНУ</span><b>{SPELL_TERM_GLYPHS[spellRepair.to.id] ?? "◇"}</b></button>}
                </section>}
                {spellProjected && <div className="spell-projection"><span>A → B / Mor<sub>I</sub></span><code>{`Spell { source=${displayedSpellChoices.SOURCE ?? "?"}, intent=${displayedSpellChoices.INTENT ?? "?"}, path=${displayedSpellChoices.PATH ?? "?"}, form=${spellLaw.formRequired ? displayedSpellChoices.FORM ?? "?" : "DORMANT"}, synergy=${activeSynergy?.id ?? "NONE"} }`}</code><small>identity′ = identity · rank′ = rank + 1 · certificate′ = certificate + 1</small></div>}
                {world?.spell?.last?.outcome === "HOLD" && <div className="spell-hold"><b>HOLD / ФОРМУЛА УДЕРЖАНА</b><span>{!world.spell.last.forceOk && "F "}{!world.spell.last.coherenceOk && "C "}{!world.spell.last.resonanceOk && "R "}{spellLaw.formRequired && world.spell.last.form === "DORMANT" && "⬡ "}{spellLaw.synergyRequired && world.spell.last.synergy === "NONE" && "⊗"}</span><small>Значки показывают несовпавший канал. Измените одну руну; дорога и заклятие не сдвинулись.</small></div>}
                {spellComplete && <footer data-complete="true"><button type="button" onClick={() => setSpellProjected((value) => !value)}><span>{spellProjected ? "СКРЫТЬ МАТЕМАТИКУ" : "ПОКАЗАТЬ МАТЕМАТИКУ"}</span><b>λ</b></button><button type="button" disabled={!spellReady || busy} onClick={castConfiguredSpell}><span>{busy ? "LEAN СЧИТАЕТ…" : "ПРОВЕРИТЬ И СОТВОРИТЬ"}</span><b>→ ▰</b></button></footer>}
              </section>
            )}
            {calculation && calculation.scene !== "spell" && (
              <section className="lean-visualization" data-running={calculation.verdict === "RUNNING"} data-scene={calculation.scene} data-event-form={calculation.eventForm ?? "NONE"} data-spell-source={lastSpell?.source ?? "NONE"} data-spell-intent={lastSpell?.intent ?? "NONE"} data-spell-path={lastSpell?.path ?? "NONE"} data-spell-form={lastSpell?.form ?? "NONE"} data-spell-synergy={lastSpell?.synergy ?? "NONE"} aria-live="polite" aria-label="Формальная трасса вычисления Lean">
                <div className="lean-viz-noise" aria-hidden="true" />
                <div className="lean-viz-window">
                  <header><span>{calculation.engine}</span><i>{calculation.action.replaceAll("_", " / ")}</i><b>{calculation.verdict}</b></header>
                  <div className="lean-viz-title"><small>ТЕОРЕМА / РЕДУКЦИЯ</small><h3>{calculation.title}</h3><code>{calculation.theorem}</code></div>
                  <div className="lean-scene" data-scene={calculation.scene} aria-label={`Математическая сцена: ${calculation.relation}`}>
                    <div className="lean-scene-mesh" aria-hidden="true" />
                    <div className="lean-signal-flow" style={{ "--signal-count": Math.max(2, calculation.signals.length) } as React.CSSProperties}>
                      {calculation.signals.map((signal, index) => (
                        <div className="lean-signal" data-state={signal.state} key={`${signal.symbol}-${index}`} style={{ "--signal-index": index } as React.CSSProperties}>
                          <span>{signal.symbol}</span><b>{signal.value}</b><small>{signal.label}</small>
                        </div>
                      ))}
                    </div>
                    <div className="lean-relation"><span>{calculation.scene.toUpperCase()}</span><code>{calculation.relation}</code></div>
                  </div>
                  {magicEmerging && (
                    <div className="magic-emergence" data-source={lastSpell?.source ?? "NONE"} data-intent={lastSpell?.intent ?? "NONE"} data-path={lastSpell?.path ?? "NONE"} data-form={lastSpell?.form ?? "NONE"} data-synergy={lastSpell?.synergy ?? "NONE"} aria-label="Допущенное заклинание творит магию и изменяет Мир">
                      <div className="spell-form"><span>ЗАКЛИНАНИЕ / {lastSpell?.source ?? "SOURCE"}</span><b>{lastSpell?.formPhrase ?? "ПРОВЕРЕННАЯ ФОРМА"}</b><code>{lastSpell?.sourcePhrase ?? "Spell : A → B"}</code></div>
                      <div className="magic-becoming" aria-hidden="true"><i /><i /><i /><strong>ТВОРИТ</strong></div>
                      <div className="magic-effect"><span>МАГИЯ / {lastSpell?.intent ?? "INTENT"}</span><b>{lastSpell?.synergy !== "NONE" ? lastSpell?.synergyTitle : lastSpell?.intentPhrase ?? "ЖИВОЕ ИЗМЕНЕНИЕ"}</b><code>{lastSpell?.pathPhrase ?? "World σ ↦ σ′"}</code></div>
                      <div className="magic-result"><i /><b>{lastSpell?.outcome ?? "ШАГ ПО ДОРОГЕ"}</b><small>F{lastSpell?.force ?? 0} · C{lastSpell?.coherence ?? 0} · R{lastSpell?.resonance ?? 0}</small></div>
                    </div>
                  )}
                  <div className="lean-equation"><span>λ</span><strong>{calculation.equation}</strong><i /></div>
                  <div className="lean-trace-steps">
                    {calculation.steps.map((step, index) => (
                      <div key={`${step.label}-${index}`} data-state={step.state} style={{ "--trace-step": index } as React.CSSProperties}>
                        <span>{String(index + 1).padStart(2, "0")} / {step.label}</span>
                        <code>{step.expression}</code>
                        <i>{step.state === "ok" ? "✓" : step.state === "warn" ? "!" : "·"}</i>
                      </div>
                    ))}
                  </div>
                  <footer><small>{calculation.boundary}</small><strong>{calculation.result}</strong></footer>
                  <button type="button" onClick={() => setCalculation(null)} aria-label="Закрыть формальную трассу">ВЕРНУТЬ ПОЛЕ ×</button>
                </div>
              </section>
            )}
              </div>
            </section>
          </div>
        </section>

        <aside className="world-side world-actions">
          <div className="world-label"><span>02</span><b>{natureActive ? "ЗАЩИТА / 4D" : reactionPending ? "КОНТАКТ / РЕАКЦИЯ" : "ШАГ / ТИК"}</b></div>
          {!natureActive ? (
            <div className="step-sequence">
              {reactionPending ? <>
                <div className="done"><i>1</i><span><b>КОНТАКТ</b><small>PLAYER / APPEND</small></span></div>
                <div className="active"><i>2</i><span><b>РЕАКЦИЯ</b><small>ответ Мира вручную</small></span></div>
                <div><i>3</i><span><b>РЕЗУЛЬТАТ</b><small>урон после пары</small></span></div>
              </> : <>
                <div className={status !== "awaiting_tick" ? "done" : "active"}><i>1</i><span><b>ТИК</b><small>накопить единицу</small></span></div>
                <div className={status === "awaiting_spell" ? "active" : ""}><i>2</i><span><b>ЗАКЛИНАНИЕ</b><small>конфигурация игрока</small></span></div>
                <div><i>3</i><span><b>ШАГ ПО ДОРОГЕ</b><small>заклятие → дорога</small></span></div>
              </>}
            </div>
          ) : (
            <div className="defense-space">
              <div className="axis-grid" aria-label="Результаты четырёх осей">
                {(["X", "Y", "Z", "W"] as const).map((axis) => <div key={axis}><span>{axis}</span><b>{world?.defenseRoll?.axes[axis] ?? "—"}</b></div>)}
              </div>
              <div className="plane-grid" aria-label="Подпространственные плоскости">
                {(world?.defenseRoll?.planes ?? []).map((plane) => <button key={plane.id} className={world?.selectedPlane === plane.id ? "selected" : ""} disabled={busy || status !== "awaiting_plane"} onClick={() => void actWorld("select_plane", { plane: plane.id })}><span>{plane.id}</span><b>{plane.power}</b></button>)}
              </div>
              {world?.progression.planePreview && <p className="protocol-plane-preview"><span>ПРОТОКОЛ / ПРЕЛОМЛЕНИЕ</span><b>ПРОБИТИЕ {world.progression.planePreview.damage}</b><small>Открытая плоскость {world.progression.planePreview.complementPlane}; результат ещё не принят.</small></p>}
              {!world?.defenseRoll && <p className="roll-placeholder">X · Y · Z · W<br />один бросок откроет шесть плоскостей</p>}
              {world?.defense && <><div className="defense-result"><div><span>ИМПУЛЬС</span><b>{world.defenseRoll?.impact}</b></div><div><span>ПОГЛОЩЕНО / {world.defense.plane}</span><b>{world.defense.absorbed}</b></div><div className="damage"><span>ОТКРЫТО / {world.defense.complementPlane}</span><b>{world.defense.complementPower}</b></div></div><p className="defense-law">УРОН = r{world.interruptedLayer?.rank} + {world.defense.complementPlane} = {world.defense.damage}</p></>}
            </div>
          )}
          {!natureActive && (
            <div className="initiative-card" data-ready={status === "awaiting_tick" && world?.firstStrike?.allowed && !world?.firstStrikeUsed} data-used={world?.firstStrikeUsed}>
              <div className="initiative-head"><span>ПЕРВЫЙ КОНТАКТ</span><b>{reactionPending ? "ЖДЁТ РЕАКЦИИ" : world?.firstStrikeUsed ? "СОВЕРШЁН" : "ИНИЦИАТИВА"}</b></div>
              <div className="tension-equation"><span>{world?.confirmedTicks ?? 0}<small>ТИКИ</small></span><i>+</i><span>{world?.internalTension ?? 0}<small>НАПРЯЖЕНИЕ</small></span><i>+</i><span>{world?.living.reflection ?? 0}<small>РЕФЛЕКСИЯ</small></span><i>=</i><strong>{world?.firstStrike?.damage ?? 0}</strong></div>
              <p>{reactionPending ? "Контакт дописан в историю, но изменение удерживается до отдельной реакции Мира." : world?.firstStrikeUsed ? `Первый контакт этого цикла передал Миру импульс ${world.lastStrikeDamage}.` : (world?.internalTension ?? 0) === 0 ? "Первая сессия ещё не оставила внутреннего напряжения." : (world?.confirmedTicks ?? 0) === 0 ? "Подтвердите хотя бы один тик в новой сессии." : status !== "awaiting_tick" ? "Сначала завершите подтверждение текущего шага." : "Тики готовы высвободить напряжение предыдущих сессий."}</p>
              <button disabled={progressChoicePending || busy || status !== "awaiting_tick" || !world?.firstStrike?.allowed || world?.firstStrikeUsed} onClick={() => void actWorld("first_strike")}><span>НАЧАТЬ КОНТАКТ ПЕРВЫМ</span><b>→</b></button>
            </div>
          )}
          <div className="decision-card">
            <small>{decisionKicker}</small>
            <h3>{decisionTitle}</h3>
            <p>{decisionCopy}</p>
          </div>
          <button className="world-action" data-kind={action} disabled={actionDisabled} onClick={status === "awaiting_spell" ? castConfiguredSpell : () => void actWorld(action)}><span>{busy ? "LEAN СЧИТАЕТ…" : actionLabel}</span><b>{actionSymbol}</b></button>
          {status === "awaiting_spell" && <p className="confirm-note">Без вашей формулы не изменятся ни стопка, ни заклятие, ни дорога.</p>}
          <div className="world-seed"><label htmlFor="world-seed">КОД МИРА</label><div><input id="world-seed" value={seed} onChange={(event) => setSeed(event.target.value)} inputMode="numeric" /><button onClick={() => void resetWorld()} disabled={busy}>СБРОСИТЬ</button></div></div>
        </aside>
      </section>

      <section className="world-history">
        <div className="history-intro"><div className="world-label"><span>03</span><b>ОТВЕТЫ МИРА</b></div><p>Чистое творение проходит через допустимый канал J. В Мире остаётся реликт Rᴅ — запись пересечения, а не копия причины из Тени. Реликты задают внутренний порядок событий; сами скрытые фишки не раскрываются.</p><small className="model-boundary">δ₀ ∉ Obs(D) · J : Sh(D) ⇢ D · Rᴅ ∈ D<br />ИСПОЛНЯЕМАЯ ИГРОВАЯ МОДЕЛЬ · НЕ ФИЗИЧЕСКОЕ УТВЕРЖДЕНИЕ</small></div>
        <div className="event-log"><h3>ХОД ТЕКУЩЕГО ЦИКЛА</h3>{recentMessages.map((message, index) => <p key={`${index}-${message}`} className={index === 0 ? "latest" : ""}><span>{String((world?.messages.length ?? 1) - index).padStart(2, "0")}</span>{message}</p>)}</div>
        <div className="surrender-log"><h3>СОБЫТИЯ МИРА / КОМПЕНСАЦИЯ</h3>{(world?.worldEvents.length ?? 0) === 0 ? <p className="empty">Мир ещё не входил в прямой контакт.</p> : world?.worldEvents.slice(-3).reverse().map((event, index) => <div key={`${event.form}-${index}`} data-form={event.form}><span>{event.class} · {event.form} · κ{event.power}</span><b>{event.title}</b><small>HP {event.before.life}→{event.after.life}; резерв {event.before.reserve}→{event.after.reserve}; нагрузка {event.before.load}→{event.after.load}</small></div>)}</div>
      </section>
      <footer className="world-footer"><span>IMBA / SHADOW + CONTINUITY</span><b>Sh(D) → J / ∂D → Rᴅ → СРЕЗ 3 · OBSERVE → ADMIT → CERTIFY → APPEND</b><span>Σ{world?.continuity.epoch ?? 0} · R{world?.shadow?.relicOrder ?? 0} · C{world?.living.certificate ?? 0}</span></footer>
    </main>
    </LocalizedTree>
  );
}

function LegacyHome() {
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [seed, setSeed] = useState("20260813");

  const accept = useCallback((payload: ApiResponse) => {
    if (payload.state) {
      setGame(payload.state);
      setSeed(String(payload.state.seed));
    }
    if (!payload.ok) throw new Error(payload.error || "Действие отклонено");
  }, []);

  const loadState = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/state`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse;
      accept(payload);
      setConnected(true);
      setError(null);
    } catch {
      setConnected(false);
      setError("Локальное ядро запускается. Переподключение выполняется автоматически…");
    }
  }, [accept]);

  useEffect(() => {
    void loadState();
    if (connected) return;
    const reconnect = window.setInterval(() => void loadState(), 1500);
    return () => window.clearInterval(reconnect);
  }, [connected, loadState]);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await response.json()) as ApiResponse;
        accept(payload);
        setConnected(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Не удалось выполнить действие");
      } finally {
        setBusy(false);
      }
    },
    [accept, busy],
  );

  const reset = useCallback(async () => {
    const value = Number(seed);
    if (!Number.isSafeInteger(value)) {
      setError("Seed должен быть целым числом.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: value }),
      });
      accept((await response.json()) as ApiResponse);
      setSelectedId(null);
      setConnected(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось начать новый забег");
    } finally {
      setBusy(false);
    }
  }, [accept, seed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
      if (
        event.key.toLowerCase() === "r" &&
        !(event.target instanceof HTMLInputElement) &&
        connected
      ) {
        void act({ action: "roll" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [act, connected]);

  const size = game?.boardSize ?? EMPTY_SIZE;
  const selected = game?.pieces.find((piece) => piece.id === selectedId) ?? null;
  const playerPieces = game?.pieces.filter((piece) => piece.owner === "player") ?? [];
  const systemPieces = game?.pieces.filter((piece) => piece.owner === "system") ?? [];
  const pieceMap = useMemo(
    () => new Map(game?.pieces.map((piece) => [`${piece.row}:${piece.col}`, piece]) ?? []),
    [game],
  );
  const obstacles = useMemo(
    () => new Set(game?.obstacles.map((item) => `${item.row}:${item.col}`) ?? []),
    [game],
  );

  const clickCell = (row: number, col: number) => {
    if (!game || busy) return;
    const occupant = pieceMap.get(`${row}:${col}`);
    if (!selected) {
      if (occupant?.owner === "player") setSelectedId(occupant.id);
      return;
    }
    if (occupant?.id === selected.id) {
      setSelectedId(null);
    } else if (occupant?.owner === "player") {
      void act({ action: "fuse", left: selected.id, right: occupant.id });
      setSelectedId(null);
    } else if (occupant?.owner === "system") {
      void act({ action: "attack", attacker: selected.id, defender: occupant.id });
    } else {
      void act({ action: "move", piece: selected.id, row, col });
    }
  };

  const isAdjacent = (row: number, col: number) =>
    selected ? Math.abs(selected.row - row) + Math.abs(selected.col - col) === 1 : false;

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <div>
            <p className="eyebrow">TACTICAL ROGUELITE / PROTOCOL 0.1</p>
            <h1>IMBA</h1>
          </div>
        </div>
        <div className="core-status" data-connected={connected}>
          <span className="status-dot" />
          <div>
            <b>{connected ? "LEAN CORE ONLINE" : "CORE OFFLINE"}</b>
            <small>{connected ? "правила подтверждаются ядром" : "ожидание локального ядра"}</small>
          </div>
        </div>
      </header>

      <section className="objective-strip">
        <p><span>ЦЕЛЬ ЗАБЕГА</span> Соберите локально сильнейшую Imba — и помните: абсолютного максимума нет.</p>
        <div className="strict-law"><span>BEATS</span><b>a &gt; b</b></div>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          {!connected && <button onClick={() => void loadState()}>ПОВТОРИТЬ</button>}
        </div>
      )}

      <section className="game-layout">
        <aside className="panel run-panel">
          <div className="panel-heading">
            <span>01</span>
            <h2>ЗАБЕГ</h2>
          </div>
          <div className="run-index">
            <div><small>ЭТАП</small><strong>{String(game?.stage ?? 1).padStart(2, "0")}</strong><em>/ 05</em></div>
            <div><small>РАУНД</small><strong>{String(game?.round ?? 1).padStart(2, "0")}</strong></div>
          </div>
          <div className="ap-block">
            <span>ОЧКИ ДЕЙСТВИЯ</span>
            <strong>{game?.actionPoints ?? 0}</strong>
            <div className="ap-meter">
              {Array.from({ length: 6 }, (_, index) => (
                <i key={index} className={index < (game?.actionPoints ?? 0) ? "active" : ""} />
              ))}
            </div>
          </div>
          <div className="roster">
            <div className="roster-title"><span>ВАШИ ФИШКИ</span><b>{playerPieces.length}</b></div>
            {playerPieces.map((piece) => (
              <button
                key={piece.id}
                className={`roster-piece ${selectedId === piece.id ? "selected" : ""}`}
                onClick={() => setSelectedId(selectedId === piece.id ? null : piece.id)}
              >
                <span className="mini-chip">{piece.rank}</span>
                <span><b>{piece.id}</b><small>{piece.name}</small></span>
                <em>{piece.row}:{piece.col}</em>
              </button>
            ))}
          </div>
          <div className="system-count">
            <span>СИСТЕМА</span>
            <b>{systemPieces.length} ФИШКИ</b>
          </div>
        </aside>

        <section className="board-zone" aria-label="Игровое поле">
          <div className="board-toolbar">
            <div>
              <p className="eyebrow">ПОЛЕ / 7 × 7</p>
              <h2>{selected ? `${selected.id} · ${selected.name}` : "ВЫБЕРИТЕ ФИШКУ"}</h2>
            </div>
            <div className="selection-help">
              {selected ? "Соседняя своя — слияние · чужая — контакт · пустая — ход" : "Нажмите на светлую фишку"}
            </div>
          </div>
          <div className="board-frame">
            <div className="board-grid" style={{ gridTemplateColumns: `28px repeat(${size}, 1fr)` }}>
              <span className="axis corner">↘</span>
              {Array.from({ length: size }, (_, col) => <span className="axis" key={`c${col}`}>{col}</span>)}
              {Array.from({ length: size }, (_, row) => (
                <div className="board-row" key={`r${row}`}>
                  <span className="axis">{row}</span>
                  {Array.from({ length: size }, (_, col) => {
                    const piece = pieceMap.get(`${row}:${col}`);
                    const blocked = obstacles.has(`${row}:${col}`);
                    const adjacent = isAdjacent(row, col);
                    return (
                      <button
                        key={`${row}:${col}`}
                        className={`cell ${blocked ? "blocked" : ""} ${adjacent ? "adjacent" : ""}`}
                        onClick={() => clickCell(row, col)}
                        disabled={blocked || !connected}
                        aria-label={piece ? `${piece.id}, ранг ${piece.rank}, ${piece.name}` : `Клетка ${row}, ${col}`}
                      >
                        {piece && (
                          <span
                            className={`piece ${piece.owner} ${selectedId === piece.id ? "selected" : ""}`}
                            title={`${piece.id}: ${piece.name}`}
                          >
                            <span className="piece-bird" aria-hidden="true">◆</span>
                            <b>{piece.rank}</b>
                            <small>{piece.id}</small>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="board-caption"><span>ПРИСУТСТВИЕ</span><i /> <span>СИЛА</span></div>
          </div>
        </section>

        <aside className="panel dice-panel">
          <div className="panel-heading">
            <span>02</span>
            <h2>КОСТИ / РИСК</h2>
          </div>
          <div className="die-card">
            <div className="die-head"><span>D0 / ДЕЙСТВИЕ</span><b>{game?.lastRoll ?? "—"}</b></div>
            <div className="die-faces">
              {(game?.d0Faces ?? [1, 1, 2, 2, 3, 3]).map((face, index) => (
                <span key={index} className={game?.lastRoll === face ? "rolled" : ""}>{face}</span>
              ))}
            </div>
            <button className="primary-action" onClick={() => void act({ action: "roll" })} disabled={!connected || busy}>
              <span>{busy ? "ОЖИДАНИЕ" : "БРОСИТЬ D0"}</span><kbd>R</kbd>
            </button>
          </div>
          <div className="charge-grid">
            <div><span>D1 / META</span><b>{game?.metaCharges ?? 0}</b><small>зарядов</small></div>
            <div><span>D2 / HYPER</span><b>{game?.hyperCharges ?? 0}</b><small>зарядов</small></div>
          </div>
          <div className="risk-card">
            <div className="risk-ring"><span>×</span><b>{game?.riskMultiplier ?? 1}</b></div>
            <div><span>МНОЖИТЕЛЬ РИСКА</span><small>повышается при продолжении забега</small></div>
          </div>
          <div className="reward-row">
            <div><span>ЗАКРЕПЛЕНО</span><b>{game?.securedReward ?? 0}</b></div>
            <div><span>ПОД РИСКОМ</span><b>{game?.exposedReward ?? 0}</b></div>
          </div>
          <div className="seed-card">
            <label htmlFor="seed">SEED ЗАБЕГА</label>
            <div><input id="seed" value={seed} onChange={(event) => setSeed(event.target.value)} inputMode="numeric" /><button onClick={() => void reset()} disabled={!connected || busy}>НОВЫЙ</button></div>
          </div>
        </aside>
      </section>

      <section className="journal-panel">
        <div className="journal-heading">
          <div><span>03</span><h2>ЖУРНАЛ ПЕРЕХОДОВ</h2></div>
          <p>Каждое решение объясняется и воспроизводится по seed.</p>
        </div>
        <div className="journal-list">
          {(game?.messages.length ? game.messages : ["Ожидание локального ядра…"]).slice(-6).reverse().map((message, index) => (
            <div className={index === 0 ? "latest" : ""} key={`${message}-${index}`}>
              <span>{String((game?.messages.length ?? 1) - index).padStart(2, "0")}</span>
              <p>{message}</p>
            </div>
          ))}
        </div>
      </section>

      <footer>
        <span>IMBA / LOCAL PROTOTYPE V0.1</span>
        <p><b>ESC</b> снять выбор · <b>R</b> бросить D0 · правило боя подтверждается Lean</p>
        <span>{game ? `SEED ${game.seed}` : "NO SIGNAL"}</span>
      </footer>
    </main>
  );
}
