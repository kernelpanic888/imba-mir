import { CHAPTER_ZERO } from "./chapters/chapter-zero";
import { CHAPTER_ONE } from "./chapters/chapter-one";
import { CHAPTER_TWO } from "./chapters/chapter-two";
import type { StoryChapterDefinition, StorySceneDefinition } from "./types";

export const STORY_CHAPTERS: readonly StoryChapterDefinition[] = [
  CHAPTER_ZERO,
  CHAPTER_ONE,
  CHAPTER_TWO,
];

export const DEFAULT_CHAPTER_ID = CHAPTER_ZERO.id;
export const ACTIVE_CHAPTER_MEMORY_KEY = "imba:story:active-chapter:v1";

export function getStoryChapter(id: string): StoryChapterDefinition {
  return STORY_CHAPTERS.find((chapter) => chapter.id === id) ?? CHAPTER_ZERO;
}

export function getStoryScene(chapter: StoryChapterDefinition, sceneId: string): StorySceneDefinition {
  const scene = chapter.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) throw new Error(`Unknown story scene ${chapter.id}/${sceneId}`);
  return scene;
}

export function storySceneMemoryKey(chapterId: string, sceneId: string): string {
  return `imba:story:${chapterId}:${sceneId}:v1`;
}

export function tutorialMemoryKey(chapter: StoryChapterDefinition): string {
  return `imba:tutorial:${chapter.id}:v${chapter.tutorial?.memoryVersion ?? 1}`;
}

export function chapterCompletionMemoryKey(chapterId: string): string {
  return `imba:story:${chapterId}:complete:v1`;
}

function assertStoryRegistry(chapters: readonly StoryChapterDefinition[]): void {
  const chapterIds = new Set<string>();
  for (const chapter of chapters) {
    if (chapterIds.has(chapter.id)) throw new Error(`Duplicate story chapter ${chapter.id}`);
    if (chapter.publication.state !== "PUBLISHED") throw new Error(`Unpublished chapter leaked into registry ${chapter.id}`);
    chapterIds.add(chapter.id);
    if (!chapter.scenes.some((scene) => scene.id === chapter.openingSceneId)) {
      throw new Error(`Chapter ${chapter.id} has no opening scene ${chapter.openingSceneId}`);
    }
    const sceneIds = new Set<string>();
    for (const scene of chapter.scenes) {
      if (sceneIds.has(scene.id)) throw new Error(`Duplicate story scene ${chapter.id}/${scene.id}`);
      if (scene.beats.length === 0) throw new Error(`Empty story scene ${chapter.id}/${scene.id}`);
      sceneIds.add(scene.id);
    }
  }
}

assertStoryRegistry(STORY_CHAPTERS);
