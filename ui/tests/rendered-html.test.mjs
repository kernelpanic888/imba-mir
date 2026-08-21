import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function publicApiWithoutRuntime() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("api-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("https://example.test/api/state"),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

function aggregateMetricDb(recordedKeys) {
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              assert.match(sql, /INSERT INTO author_metrics/);
              recordedKeys.push(values[0]);
            },
          };
        },
        async run() {
          assert.match(sql, /CREATE TABLE IF NOT EXISTS author_metrics/);
        },
      };
    },
    async batch(statements) {
      for (const statement of statements) await statement.run();
    },
  };
}

async function proxyWithMetrics(request, recordedKeys) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("metric-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  const pending = [];
  const response = await worker.fetch(request, {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    DB: aggregateMetricDb(recordedKeys),
    IMBA_API_ORIGIN: "https://runtime.example.test",
  }, {
    waitUntil(promise) { pending.push(promise); },
    passThroughOnException() {},
  });
  await Promise.all(pending);
  return response;
}

test("server-renders the Imba game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>IMBA \/ MIR — One Tick, One World<\/title>/i);
  assert.match(html, /IMBA/);
  assert.match(html, /PLAYER ← DOMAIN → LIVING WORLD/);
  assert.match(html, /Player on the left and living World on the right/);
  assert.match(html, /PLAYER LIFE/);
  assert.match(html, /WORLD LIFE/);
  assert.match(html, /WORLD EVENTS \/ COMPENSATION/);
  assert.match(html, /ACCUMULATE TICK/);
  assert.match(html, /ROAD STEPS/i);
  assert.match(html, /CURSE REMAINING/i);
  assert.match(html, /road to the Emerald Castle/i);
  assert.match(html, /WORLD RESPONSES/);
  assert.match(html, /REALITY SLICE/);
  assert.match(html, /FORM → OBSERVABLE/);
  assert.match(html, /OBSERVABLE → WORLD/);
  assert.match(html, /Shadow/i);
  assert.match(html, /aria-label="Game version v[\d.]+"/);
  assert.doesNotMatch(html, /[А-Яа-яЁё]/u);
  assert.match(html, /class="menu-primary" disabled/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
});

test("initiative is presented as bounded balance capacity, never damage", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /firstStrike\?\.capacity/);
  assert.match(source, /ЁМКОСТЬ БАЛАНСА \/ 12/);
  assert.match(source, /УРОН 0/);
  assert.match(source, /lastBalanceCapacity/);
  assert.doesNotMatch(source, /firstStrike\?\.damage|lastStrikeDamage/);
});

test("mobile menu keeps every published chapter visible without a hidden horizontal strip", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.game-menu-chapters \{ display: grid; grid-template-columns: repeat\(3,minmax\(0,1fr\)\);[^}]*overflow: visible/);
  assert.match(styles, /\.game-menu-actions \.game-menu-chapters button \{ min-width: 0; min-height: 46px/);
  assert.match(styles, /\.game-menu-actions \.game-menu-chapters button b \{ grid-row: 2; grid-column: 1;/);
});

test("completed spell books allocate space only to sections that actually exist", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /\.state-awaiting_spell \.magic-stage-pane \.spell-builder\[data-complete="true"\] \{\s*grid-template-rows: auto minmax\(250px,1fr\);\s*grid-auto-rows: max-content;/);
  assert.match(styles, /@media \(max-height: 760px\)[\s\S]*?\.spell-builder\[data-complete="true"\] \{\s*grid-template-rows: auto minmax\(118px,1fr\);\s*grid-auto-rows: max-content;/);
  assert.doesNotMatch(styles, /\.spell-builder\[data-complete="true"\][^{]*\{[^}]*grid-template-rows:[^;}]*minmax\(104px/);
});

test("required defense choices call for attention without moving the interface", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /\.defense-methods button:not\(:disabled\) \{ animation: defense-choice-call 2\.25s ease-in-out infinite; \}/);
  assert.match(styles, /\.defense-methods button:nth-child\(2\) \{ animation-delay: -\.75s; \}\.defense-methods button:nth-child\(3\) \{ animation-delay: -1\.5s; \}/);
  assert.match(styles, /@keyframes defense-choice-call \{[\s\S]*?border-color: currentColor;[\s\S]*?box-shadow:/);
  assert.match(styles, /\.defense-methods button:hover:not\(:disabled\),\.defense-methods button:focus-visible \{ animation: none;/);
  assert.match(styles, /\.defense-methods button:disabled \{ animation: none;/);
  const pulse = styles.slice(
    styles.indexOf("@keyframes defense-choice-call"),
    styles.indexOf(".defense-methods i"),
  );
  assert.doesNotMatch(pulse, /transform:/);
});

test("the reality slice mirrors player input and Lean-backed state transitions", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /onClickCapture=\{captureRealityClick\}/);
  assert.match(source, /OBSERVE \/ PLAYER INPUT/);
  assert.match(source, /LEAN \/ TRANSITION REQUEST/);
  assert.match(source, /"PLAYER" \| "FORMULA" \| "SYSTEM" \| "WORLD" \| "BALANCE"/);
  assert.match(source, /previous\.balance !== nextSnapshot\.balance/);
  assert.match(source, /className="reality-event-manifest"/);
  assert.match(source, /className="reality-causality-track"/);
  assert.match(source, /className="reality-delta-flash"/);
  assert.match(source, /className="reality-vital-delta"/);
  assert.match(source, /data-change=\{latestBalanceEvent\?\.trend/);
  assert.match(styles, /\.reality-event-manifest/);
  assert.match(styles, /@keyframes reality-event-wave/);
  assert.match(styles, /@keyframes balance-panel-loss/);
  assert.match(styles, /@keyframes balance-panel-gain/);
});

test("public API fails honestly when the Lean runtime is not configured", async () => {
  const response = await publicApiWithoutRuntime();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "The public Lean runtime is not configured yet.",
  });
});

test("records owner-only aggregate launches and players without exposing a counter", async () => {
  const recordedKeys = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    const url = new URL(request.url);
    if (url.pathname === "/api/state") {
      return Response.json(
        { ok: true, state: {} },
        { headers: { "Set-Cookie": "imba_session=runtime-session; Path=/; HttpOnly" } },
      );
    }
    return Response.json({ ok: true, state: {} });
  };

  try {
    await proxyWithMetrics(
      new Request("https://game.example.test/api/state"),
      recordedKeys,
    );
    const firstAction = await proxyWithMetrics(
      new Request("https://game.example.test/api/action", {
        method: "POST",
        headers: { cookie: "imba_session=runtime-session" },
        body: "{}",
      }),
      recordedKeys,
    );
    assert.match(firstAction.headers.get("set-cookie") ?? "", /imba_counted_player=1/);

    await proxyWithMetrics(
      new Request("https://game.example.test/api/action", {
        method: "POST",
        headers: { cookie: "imba_session=runtime-session; imba_counted_player=1" },
        body: "{}",
      }),
      recordedKeys,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(recordedKeys, [
    "launches_total",
    "actions_total",
    "players_approx",
    "actions_total",
  ]);

  const [page, workerSource] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
  ]);
  assert.doesNotMatch(page, /players_approx|launches_total|actions_total|author_metrics/);
  assert.doesNotMatch(workerSource, /\/api\/author\/stats/);
});

test("starter preview is fully removed", async () => {
  const [page, layout, styles, packageJson, sound, sources, formulaIndividual, i18n, storyTypes, storyRegistry, chapterZero, chapterOne, chapterTwo, journeyLean] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("app/sound.ts", root), "utf8"),
    readFile(new URL("app/sources.ts", root), "utf8"),
    readFile(new URL("app/formula-individual.tsx", root), "utf8"),
    readFile(new URL("app/i18n.tsx", root), "utf8"),
    readFile(new URL("app/story/types.ts", root), "utf8"),
    readFile(new URL("app/story/registry.ts", root), "utf8"),
    readFile(new URL("app/story/chapters/chapter-zero.ts", root), "utf8"),
    readFile(new URL("app/story/chapters/chapter-one.ts", root), "utf8"),
    readFile(new URL("app/story/chapters/chapter-two.ts", root), "utf8"),
    readFile(new URL("../lean/Imba/Journey.lean", root), "utf8"),
  ]);

  assert.match(page, /"use client"/);
  assert.match(page, /const API_BASE = ""/);
  assert.doesNotMatch(page, /127\.0\.0\.1:8765/);
  assert.match(page, /roll_defense/);
  assert.match(page, /choose_defense_method/);
  assert.match(page, /THROW/);
  assert.match(page, /ANCHOR/);
  assert.match(page, /RIFT/);
  assert.match(page, /defensePlaneLocked/);
  assert.match(page, /confirm_defense/);
  assert.match(page, /Результаты четырёх осей/);
  assert.match(page, /first_strike/);
  assert.match(page, /world_reaction/);
  assert.match(page, /OBSERVE/);
  assert.match(page, /ADMIT/);
  assert.match(page, /CERTIFY/);
  assert.match(page, /APPEND/);
  assert.match(page, /ИГРОВОЕ ОБЯЗАТЕЛЬСТВО, НЕ КРИПТОПОДПИСЬ/);
  assert.match(page, /ИЗМЕНЕНИЕ = 0, ПОКА МИР НЕ ОТВЕТИЛ/);
  assert.match(page, /pendingCalculation/);
  assert.match(page, /cast_spell/);
  assert.match(page, /spell-builder/);
  assert.match(page, /ИЗУМРУДНЫЙ ПРОВОДНИК \/ ПРОЕКЦИЯ · НЕ ВЕРДИКТ/);
  assert.match(page, /SpellRepairView/);
  assert.match(page, /ПРИМЕНИТЬ ШАГ LEAN/);
  assert.match(page, /Δφ \/ МИНИМАЛЬНАЯ ПЕРЕСБОРКА/);
  assert.match(page, /4⁴ ПРОВЕРЕНО/);
  assert.match(page, /ПОДТВЕРДИТЬ ПЕРЕСБОРКУ/);
  assert.doesNotMatch(page, /ПРИМЕНИТЬ 1 ЗАМЕНУ/);
  assert.match(page, /evaluateSpellFormula/);
  assert.match(page, /displayedSpellChoices/);
  assert.match(page, /committedSpellEvaluation/);
  assert.match(page, /onPointerEnter=\{\(\) => setSpellPreview/);
  assert.match(page, /onPointerLeave=\{\(\) => setSpellPreview/);
  assert.match(page, /onClickCapture=\{\(event\) =>/);
  assert.match(page, /button\[data-slot\]\[data-term\]/);
  assert.match(page, /data-slot=\{slot\}/);
  assert.match(page, /data-preview=\{spellPreview\?\.slot/);
  assert.match(page, /aria-pressed=\{spellChoices\[slot\] === term\.id\}/);
  assert.match(page, /ПРЕДПРОСМОТР · КЛИК — ЗАКРЕПИТЬ/);
  assert.match(page, /ПРОВЕРИТЬ В LEAN/);
  assert.match(page, /game-menu-version/);
  assert.match(page, /packageMetadata\.version/);
  assert.match(page, /ОДИН ВЫБОР — ОДНО ИЗМЕНЕНИЕ ЖИВОЙ ПЕЧАТИ/);
  assert.match(page, /ПЕЧАТЬ ГОТОВА К ПРОЕКЦИИ/);
  assert.match(page, /spell-loom/);
  assert.match(page, /spell-sigil/);
  assert.match(page, /spell-bind-chain/);
  assert.match(page, /data-visible=\{slot === nextSpellSlot\}/);
  assert.match(page, /spell-node-cue/);
  assert.match(page, /spell-flight/);
  assert.match(page, /spell-runtime-trace/);
  assert.match(page, /world-contact-language/);
  assert.match(page, /header-battle-slice/);
  assert.match(page, /header-formula-chain/);
  assert.match(page, /header-action-track/);
  assert.match(page, /FormulaIndividual/);
  assert.match(page, /FormulaEntity/);
  assert.match(page, /formulaEntityOrgans/);
  assert.match(page, /СУЩНОСТЬ ·/);
  assert.match(formulaIndividual, /formula-entity-organ/);
  assert.match(formulaIndividual, /data-born/);
  assert.match(formulaIndividual, /Живая сущность/);
  assert.match(formulaIndividual, /locale === "en"/);
  assert.match(formulaIndividual, /Formula individual/);
  assert.match(formulaIndividual, /Living entity/);
  assert.match(i18n, /"КРИТЕРИЙ ЖИЗНИ": "LIFE CRITERION"/);
  assert.match(i18n, /"ПРОВОДНИК ОБУЧЕНИЯ ·": "TUTORIAL GUIDE ·"/);
  assert.match(i18n, /"· ЗАКЛЯТИЕ": "· CURSE"/);
  assert.match(i18n, /"β ЩИТ": "β SHIELD"/);
  assert.match(i18n, /Main life criterion/);
  assert.match(i18n, /The Raven’s road to the Emerald Castle/);
  assert.match(i18n, /THE CURSE PREPARES ROAD STEP/);
  assert.match(i18n, /ACT OF PURE CREATION \/ TICK/);
  assert.match(i18n, /FORMULA ASSEMBLY:/);
  assert.match(i18n, /MAGIC MOVES TOWARD THE WORLD/);
  assert.match(page, /realityFormulaIndividual/);
  assert.match(page, /liveFormulaIndividual/);
  assert.match(page, /header-formula-metrics/);
  assert.match(page, /header-moving-individual/);
  assert.match(page, /runPanelOpen/);
  assert.match(page, /run-panel-toggle/);
  assert.match(page, /aria-controls="world-run-panel"/);
  assert.match(page, /domain-stage-split/);
  assert.match(page, /className="world-law stage-world-law"/);
  assert.equal((page.match(/className="world-law/g) ?? []).length, 1);
  assert.match(page, /className="spell-node-cue">ВЫБЕРИТЕ РУНУ ↓/);
  assert.doesNotMatch(page, /СЛЕДУЮЩИЙ ЖЕСТ/);
  assert.doesNotMatch(page, /ВЫБЕРИТЕ ОДНУ РУНУ ВНИЗУ/);
  assert.match(page, /reality-stage-pane/);
  assert.match(page, /magic-stage-pane/);
  assert.match(page, /infomagic-wind/);
  assert.match(page, /infomagic-current--c/);
  assert.match(page, /OBSERVE<\/b><b>→<\/b><b>ADMIT/);
  assert.match(page, /ФОРМА → НАБЛЮДАЕМОЕ/);
  assert.match(page, /НАБЛЮДАЕМОЕ → МИР/);
  assert.match(styles, /\.world-layout > \.world-run\[data-open="true"\]/);
  assert.match(styles, /grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.reality-stage-slice \.header-formula-individual/);
  assert.match(styles, /\.header-formula-entity/);
  assert.match(styles, /\.infomagic-wind/);
  assert.match(styles, /\.stage-world-law/);
  assert.match(styles, /grid-template-areas: "top" "game" "foot"/);
  assert.match(styles, /@keyframes infomagic-current-flow/);
  assert.match(styles, /\.formula-entity-veins path\[data-filled="true"\]/);
  assert.match(styles, /@keyframes entity-organ-call/);
  assert.match(page, /battlePhase/);
  assert.match(page, /data-state=\{battleRavenState\}/);
  assert.match(page, /data-state=\{battleWorldState\}/);
  assert.doesNotMatch(page, /className="world-brand"/);
  for (const phase of [
    "TICK", "SPELL_AUDIT", "MANIFEST", "INTERRUPT", "AXES", "PROJECTION",
    "CONSERVATION", "MEMORY", "RAVEN_ATTACK", "WORLD_REACTION", "PROGRESS",
    "RESET", "TRANSITION", "FORMULA", "CAST", "IMPACT", "HOLD",
    "WORLD_ATTACK", "DEFENSE", "AFTERMATH", "COUNTER_WINDOW", "END", "IDLE",
  ]) assert.match(page, new RegExp(`\\"${phase}\\"`));
  assert.match(page, /data-synergy=\{spellVisualSynergy\}/);
  assert.match(page, /setSpellPerformance\(spellResolution\)/);
  assert.match(page, /1700/);
  assert.match(page, /2600/);
  assert.doesNotMatch(page, /data-gesture=\{ravenGesture\}/);
  assert.match(page, /spellQuality/);
  assert.match(page, /lexiconVariant/);
  assert.match(page, /spell-growth/);
  assert.match(page, /spell-synergy/);
  assert.match(page, /ФОРМА КОНТАКТА/);
  assert.match(page, /СИНЕРГИЯ/);
  assert.match(page, /META ×2/);
  assert.match(page, /EDGEWAY/);
  assert.match(page, /UMBRA/);
  assert.match(page, /REVELATION/);
  assert.match(page, /REMEMBRANCE/);
  assert.match(page, /NOVA/);
  assert.match(page, /RIFTBLADE/);
  assert.match(page, /MEMORY/);
  assert.match(page, /SPARK/);
  assert.match(page, /RIFT/);
  assert.match(page, /ORBIT/);
  assert.match(page, /PRISM/);
  assert.match(page, /combat-glyph-chain/);
  assert.match(page, /combat-effects/);
  assert.match(page, /balance-monitor/);
  assert.match(page, /РАВНОВЕСИЕ РАЗРУШЕНО/);
  assert.match(page, /СОХРАНИТЬ ОБОИХ/);
  assert.doesNotMatch(page, /ЖИЗНЬ МИРА ЗАВЕРШЕНА/);
  assert.match(page, /WORLD_REACTION_GLYPHS/);
  assert.match(page, /Mor<sub>I<\/sub>/);
  assert.match(page, /journey-layer/);
  assert.match(page, /green-road/);
  assert.match(page, /emerald-castle/);
  assert.match(page, /road-crow/);
  assert.match(page, /hero-crow-v2\.webp/);
  assert.match(page, /menu-virtual-storm-v1\.webp/);
  assert.match(page, /menu-emerald-castle-v1\.webp/);
  assert.match(page, /menu-sky-layer/);
  assert.match(page, /menu-castle-layer/);
  assert.match(page, /menu-journey-layer/);
  assert.match(page, /menu-green-road/);
  assert.match(chapterOne, /emerald-wizard-portrait-v2\.webp/);
  assert.match(page, /story-wizard-portrait/);
  assert.match(page, /chapter-cutscene/);
  assert.match(chapterOne, /МИР НЕ НАЗЫВАЛ СЕБЯ МАГИЕЙ/);
  assert.match(page, /WORLD_MAGUS/);
  assert.match(chapterOne, /ПРИНЯТЬ ВТОРУЮ ФОРМУ/);
  assert.match(page, /spell-contact-flash/);
  assert.match(page, /story-prologue/);
  assert.match(chapterOne, /hero-shadow-v1\.webp/);
  assert.match(chapterOne, /Тень — прежняя информационная форма Ворона/);
  assert.match(chapterOne, /СЦЕНА 00/);
  assert.match(chapterOne, /ВОЙТИ В ГЛАВУ/);
  assert.doesNotMatch(page, /PROLOGUE_BEATS/);
  assert.match(page, /emitSoundCue/);
  assert.match(page, /game-menu/);
  assert.match(page, /game-menu-chapters/);
  assert.match(page, /STORY_CHAPTERS\.map/);
  assert.match(page, /ОПУБЛИКОВАНО 0—II/);
  assert.match(page, /ДАЛЬШЕ — ТОЛЬКО ПОСЛЕ АВТОРА/);
  assert.match(page, /game-menu-hosting-note/);
  assert.match(page, /ПУБЛИЧНЫЙ ПРОТОТИП · БЕСПЛАТНЫЙ СЕРВЕР/);
  assert.match(page, /ПОДДЕРЖАТЬ РАЗВИТИЕ — НАПИСАТЬ АВТОРУ/);
  assert.match(styles, /\.game-menu-hosting-note/);
  assert.match(page, /tutorial-compass/);
  assert.match(page, /ШАГИ ПО ДОРОГЕ ∞ · ХОДЫ НЕ ОГРАНИЧЕНЫ/);
  assert.match(page, /startSelectedChapter/);
  assert.match(page, /openSelectedOpening/);
  assert.match(page, /storySceneMemoryKey/);
  assert.match(page, /ПОЛНЫЙ МИР РАСКРЫВАЕТСЯ НА ШИРОКОМ ЭКРАНЕ/);
  assert.match(page, /ПРОДОЛЖИТЬ/);
  assert.match(page, /НАЧАТЬ ГЛАВУ/);
  assert.match(page, /ВСТУПЛЕНИЕ/);
  assert.match(page, /ИСТОЧНИКИ/);
  assert.match(page, /LocalizedTree/);
  assert.match(page, /LOCALE_MEMORY_KEY/);
  assert.match(page, /game-menu-language/);
  assert.match(page, /changeLocale\("ru"\)/);
  assert.match(page, /changeLocale\("en"\)/);
  assert.match(page, /aria-pressed=\{locale === "ru"\}/);
  assert.match(page, /data-locale=\{locale\}/);
  assert.match(page, /menu-metaphysics-trigger/);
  assert.match(page, /ЧТО ЗДЕСЬ ПРОИСХОДИТ НА САМОМ ДЕЛЕ/);
  assert.match(page, /РЕАЛЬНОСТИ СТРОЯТСЯ ИЗ МАТЕМАТИКИ/);
  assert.match(page, /МАГИЯ — ЭТО СЛУЧИВШЕЕСЯ ИЗМЕНЕНИЕ/);
  assert.match(styles, /\.metaphysics-reading-grid/);
  assert.match(i18n, /THE WORLD NEVER CALLED ITSELF MAGIC/);
  assert.match(i18n, /A spell only proposes a transition/);
  assert.match(i18n, /REALITIES ARE BUILT FROM MATHEMATICS/);
  assert.match(i18n, /ALLUSION ≠ ADAPTATION/);
  assert.match(i18n, /Aleksey Salkutsan/);
  assert.match(i18n, /"ЗАКЛИНАНИЕ": "SPELL"/);
  assert.match(i18n, /"МАГИЯ": "MAGIC"/);
  assert.match(i18n, /"МИР": "WORLD"/);
  assert.match(page, /source-archive/);
  assert.match(page, /ИСТОЧНИКИ МИРА/);
  assert.match(page, /AUTHOR_NAME\.toUpperCase/);
  assert.match(page, /className="game-menu-author-link"/);
  assert.match(page, /href=\{AUTHOR_LINKS\[0\]\.href\}/);
  assert.match(page, /Основной сайт автора/);
  assert.match(page, /setSourcesOpen\(true\)/);
  assert.match(page, /event\.key === "Escape"/);
  assert.match(sources, /Aleksey Salkutsan/);
  assert.match(sources, /github\.com\/kernelpanic888/);
  assert.match(sources, /0009-0006-8717-0492/);
  assert.match(sources, /linkedin\.com\/in\/oleksiy-salkutsan-276a40184/);
  assert.match(sources, /РОЛЬ CHATGPT И CODEX/);
  assert.match(sources, /Диалог, исследование и развитие замысла/);
  assert.match(sources, /Реализация, проверка и локальный плейтест/);
  assert.match(sources, /learn\.chatgpt\.com/);
  assert.match(sources, /developers\.openai\.com\/codex\/use-cases/);
  assert.match(sources, /Финальные требования и творческие решения задавал автор/);
  assert.match(sources, /The Wonderful Wizard of Oz/);
  assert.match(sources, /loc\.gov\/item\/03032405/);
  assert.match(sources, /General Theory of Natural Equivalences/);
  assert.match(sources, /Categories for the Working Mathematician/);
  assert.match(sources, /lean-lang\.org\/doc\/reference/);
  assert.match(sources, /Allostasis: a model of predictive regulation/);
  assert.match(sources, /VFX as a Game Design Language/);
  assert.match(formulaIndividual, /formulaIndividualGeometry/);
  assert.match(formulaIndividual, /Индивидуал формулы/);
  assert.match(formulaIndividual, /model\.source/);
  assert.match(formulaIndividual, /model\.intent/);
  assert.match(formulaIndividual, /model\.path/);
  assert.match(formulaIndividual, /model\.form/);
  assert.match(formulaIndividual, /model\.synergy/);
  assert.match(formulaIndividual, /model\.score\.force/);
  assert.match(formulaIndividual, /model\.need\.force/);
  assert.match(formulaIndividual, /model\.topology/);
  assert.match(formulaIndividual, /model\.metaTier/);
  assert.match(chapterOne, /ИДИ К/);
  assert.match(chapterOne, /ВОЛШЕБНИКУ/);
  assert.match(storyTypes, /StoryChapterDefinition/);
  assert.match(storyTypes, /StorySceneDefinition/);
  assert.match(storyTypes, /ChapterFinaleDefinition/);
  assert.match(storyTypes, /WORLD_JOURNEY_V1/);
  assert.match(storyTypes, /WORLD_JOURNEY_V2/);
  assert.match(storyRegistry, /STORY_CHAPTERS/);
  assert.match(storyRegistry, /CHAPTER_ZERO/);
  assert.match(storyRegistry, /CHAPTER_TWO/);
  assert.match(storyRegistry, /publication\.state !== "PUBLISHED"/);
  assert.match(storyRegistry, /assertStoryRegistry/);
  assert.match(storyRegistry, /Duplicate story chapter/);
  assert.match(storyRegistry, /has no opening scene/);
  assert.match(storyRegistry, /Empty story scene/);
  assert.match(chapterOne, /chapter-01-curse-road/);
  assert.match(chapterOne, /RESET_WORLD/);
  assert.match(chapterOne, /JOURNEY_CHAPTER_CONFLICT/);
  assert.match(chapterTwo, /chapter-02-three-geometries/);
  assert.match(chapterTwo, /DEFENSE_MASTERY_BALANCE/);
  assert.match(chapterTwo, /THROW ∧ ANCHOR ∧ RIFT ∧ balance ≥ 65/);
  assert.match(chapterTwo, /НУЛЕВОЙ ЩИТ/);
  assert.match(chapterTwo, /KEEPER OF BALANCE/);
  assert.match(page, /chapterTwo\.finaleAllowed/);
  assert.match(page, /chapterFinaleBeat/);
  assert.match(i18n, /Three Geometries of Response/);
  assert.match(i18n, /ZERO SHIELD/);
  assert.match(chapterZero, /chapter-00-initiation/);
  assert.match(chapterZero, /TUTORIAL_MASTERY/);
  assert.match(chapterZero, /MANUAL_TICK/);
  assert.match(chapterZero, /PROTOCOL_CHOICE/);
  assert.match(chapterZero, /не ограничено числом шагов/i);
  assert.match(journeyLean, /def roadBricks \(certificate : Nat\) : Nat :=\s*certificate/);
  assert.match(journeyLean, /АВТОРСКИЙ РУБЕЖ \/ ГЛАВА I/);
  assert.doesNotMatch(journeyLean, /II \/ МИР ПОМНИТ|III \/ ЗАМОК СМОТРИТ|IV \/ ИЗУМРУДНЫЙ ПОРОГ/);
  assert.match(page, /magic-emergence/);
  assert.match(page, /ПРОВЕРЕННАЯ ФОРМА/);
  assert.match(page, /ЖИВОЕ ИЗМЕНЕНИЕ/);
  assert.match(page, /SPELL_SEAL/);
  assert.match(page, /MAGIC_BLOOM/);
  assert.match(page, /ЗАКЛЯТИЕ → ЗАКЛИНАНИЕ → ШАГ ПО ДОРОГЕ/);
  assert.doesNotMatch(page, /кирпич/iu);
  assert.doesNotMatch(chapterZero, /кирпич/iu);
  assert.match(page, /Формальная трасса вычисления Lean/);
  assert.match(page, /FORMAL REDUCTION TRACE \/ NOT PRIVATE REASONING/);
  assert.match(page, /stagedTick_is_next/);
  assert.match(page, /lean-visualization/);
  assert.match(page, /lean-scene/);
  assert.match(page, /lean-signal-flow/);
  assert.match(page, /Математическая сцена/);
  for (const scene of [
    "tick", "spell", "manifest", "interrupt", "axes", "projection",
    "conservation", "memory", "attack", "reaction", "reset",
    "progress",
  ]) {
    assert.match(page, new RegExp(`(?:\\"|\\s)${scene}(?:\\"|\\s)`));
  }
  assert.match(page, /pendingCalculation\("reset"/);
  assert.match(page, /WorldEventForm/);
  assert.match(page, /world-event-rig/);
  assert.match(page, /data-world-form/);
  assert.match(page, /data-reactive/);
  assert.match(page, /Ответить Миром на контакт на игровом поле/);
  assert.match(page, /КЛИКНИТЕ ПО МИРУ/);
  assert.match(page, /Четыре горизонта прогресса/);
  assert.match(page, /ВЫБЕРИТЕ ПЕРВЫЙ ПРОТОКОЛ/);
  assert.match(page, /АКТИВНЫЙ ПРОТОКОЛ/);
  assert.match(page, /FORECAST/);
  assert.match(page, /REFRACTION/);
  assert.match(page, /protocol-plane-preview/);
  assert.match(page, /handleFieldReactionKey/);
  assert.match(page, /actWorld\("world_reaction"\)/);
  assert.match(page, /REGENERATION/);
  assert.match(page, /BARRIER/);
  assert.match(page, /REDISTRIBUTION/);
  assert.match(page, /SCAR/);
  assert.match(page, /OVERLOAD/);
  assert.match(page, /PREFIX GUARD \/ OK/);
  assert.match(page, /living\.reflection/);
  assert.match(page, /Sh\(D\) → J \/ ∂D → Rᴅ → СРЕЗ 3/);
  assert.match(page, /НЕ ФИЗИЧЕСКОЕ УТВЕРЖДЕНИЕ/);
  assert.match(page, /АКТ ЧИСТОГО ТВОРЕНИЯ/);
  assert.match(page, /shadow\?\.visibleDepth/);
  assert.match(page, /Видимый последний срез/);
  assert.match(page, /ПРЯМОЕ НАБЛЮДЕНИЕ ЗАПРЕЩЕНО/);
  assert.match(page, /Sh\(D\).*R/);
  assert.doesNotMatch(page, /layers\.slice\(-10\)/);
  assert.match(layout, /IMBA \/ MIR — One Tick, One World/);
  assert.match(layout, /<html lang="en">/);
  assert.match(page, /useState<Locale>\("en"\)/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(styles, /html, body\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.world-shell\s*\{[^}]*height:\s*100dvh[^}]*max-height:\s*100dvh[^}]*overflow:\s*hidden/s);
  assert.match(styles, /grid-template-areas:\s*"top"\s*"game"\s*"history"\s*"foot"/);
  assert.match(styles, /\.world-layout\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(styles, /container-type:\s*size/);
  assert.match(styles, /--world-black:\s*#06110e/);
  assert.match(styles, /--world-moss:\s*#43ba84/);
  assert.match(styles, /--world-acid:\s*#8fcda8/);
  assert.match(styles, /--world-lime:\s*#b4d77d/);
  assert.match(styles, /--world-cyan:\s*#69b2b0/);
  assert.match(styles, /--world-gold:\s*#c5aa70/);
  assert.match(styles, /--world-lilac:\s*#9187c7/);
  assert.match(styles, /Softer semantic spectrum/);
  assert.match(styles, /\.duel-stage/);
  assert.match(styles, /\.player-actor/);
  assert.match(styles, /\.digital-crow-rig/);
  assert.match(styles, /\.journey-layer/);
  assert.match(styles, /\.green-road/);
  assert.match(styles, /\.road-crow/);
  assert.match(styles, /\.chapter-cutscene/);
  assert.match(styles, /\.spell-contact-flash/);
  assert.match(styles, /spell-contact-neon/);
  assert.match(styles, /\.spell-builder/);
  assert.match(styles, /\.spell-growth/);
  assert.match(styles, /\.spell-synergy/);
  assert.match(styles, /\.spell-term-glyph/);
  assert.match(styles, /\.spell-loom/);
  assert.match(styles, /\.spell-sigil/);
  assert.match(styles, /\.spell-bind-chain/);
  assert.match(styles, /\.spell-quality/);
  assert.match(styles, /\.spell-guide/);
  assert.match(styles, /\.spell-repair-route/);
  assert.match(styles, /\.spell-repair-node/);
  assert.match(styles, /VERTICAL SPELL WORKSPACE/);
  assert.match(styles, /\.state-awaiting_spell \.magic-stage-pane \.world-square/);
  assert.match(styles, /aspect-ratio:\s*auto/);
  assert.match(styles, /\.game-menu-version/);
  assert.match(styles, /\.tutorial-compass/);
  assert.match(styles, /\.author-frontier/);
  assert.match(styles, /\.game-menu-author-link/);
  assert.match(styles, /spell-release-effect/);
  assert.match(styles, /Reality slice: every header motion is backed by game state/);
  assert.match(styles, /\.header-battle-slice/);
  assert.match(styles, /\.header-formula-chain/);
  assert.match(styles, /FORMULA INDIVIDUAL/);
  assert.match(styles, /\.formula-individual/);
  assert.match(styles, /\.formula-channel--force/);
  assert.match(styles, /\.formula-channel--coherence/);
  assert.match(styles, /\.formula-channel--resonance/);
  assert.match(styles, /\.header-formula-individual/);
  assert.match(styles, /\.header-moving-individual/);
  assert.match(styles, /\.header-magic-form/);
  assert.match(styles, /header-cast-road/);
  assert.match(styles, /header-world-attack/);
  assert.match(styles, /header-force-on-guard/);
  assert.match(styles, /header-world-answer/);
  assert.match(styles, /header-tick-commit/);
  assert.match(styles, /header-axes-roll/);
  assert.match(styles, /header-plane-fold/);
  assert.match(styles, /header-memory-shadow/);
  assert.match(styles, /header-progress-open/);
  assert.match(styles, /\.header-raven\[data-state="HIT"\] img/);
  assert.doesNotMatch(styles, /\.header-battle-slice\[data-phase="CAST"\][^}]*\.header-raven[^}]*animation/s);
  assert.match(styles, /\.combat-glyph-chain/);
  assert.match(styles, /\.combat-effects/);
  assert.match(styles, /\.balance-monitor/);
  assert.match(styles, /\.reality-world-balance/);
  assert.match(styles, /\.spell-rows button\[data-preview="true"\]/);
  assert.match(page, /chapterCompletionMemoryKey/);
  assert.match(page, /СВОБОДНЫЙ ВХОД/);
  assert.match(page, /FREE ENTRY/);
  assert.match(page, /data-complete/);
  assert.doesNotMatch(page, /ПРОЙДИТЕ ПРЕДЫДУЩУЮ ГЛАВУ/);
  assert.doesNotMatch(page, /COMPLETE THE PREVIOUS CHAPTER/);
  assert.doesNotMatch(page, /isChapterUnlocked/);
  assert.doesNotMatch(page, /rememberedUnlocked/);
  assert.match(styles, /\.story-prologue/);
  assert.match(styles, /\.game-menu/);
  assert.match(styles, /\.game-menu-chapters/);
  assert.match(styles, /\.source-archive/);
  assert.match(styles, /\.source-author/);
  assert.match(styles, /\.source-ledger/);
  assert.match(styles, /\.source-group/);
  assert.match(styles, /\.menu-sky-layer/);
  assert.match(styles, /\.menu-castle-layer/);
  assert.match(styles, /\.menu-journey-layer/);
  assert.match(styles, /menu-storm-approach/);
  assert.match(styles, /menu-castle-distance/);
  assert.match(styles, /menu-road-current/);
  assert.match(styles, /menu-green-lightning/);
  assert.doesNotMatch(styles, /wizard-singularity/);
  assert.match(styles, /\.story-wizard-portrait/);
  assert.match(styles, /\.prologue-shadow/);
  assert.match(styles, /\.magic-emergence/);
  assert.match(styles, /magic-breathe/);
  assert.match(styles, /Steam Deck \/ handheld readability profile/);
  assert.match(styles, /Compact spell book: four unlocked rune families/);
  assert.match(styles, /repeat\(4,minmax\(32px,1fr\)\)/);
  assert.match(styles, /grid-template-columns:\s*20px minmax\(0,1fr\) 48px/);
  assert.match(styles, /@media \(min-width:\s*721px\) and \(max-width:\s*1440px\) and \(min-height:\s*641px\) and \(max-height:\s*900px\)/);
  assert.match(styles, /--deck-body:\s*12px/);
  assert.match(styles, /\.spell-rows button b\s*\{\s*font-size:\s*var\(--deck-body\)/);
  assert.match(styles, /\.world-history\s*\{\s*display:\s*none/);
  assert.match(styles, /\.world-actor\[data-form="OVERLOAD"\]/);
  assert.match(styles, /\.world-event-rig/);
  assert.match(styles, /\.world-actor\[data-reactive="true"\]/);
  assert.match(styles, /\.world-field-reaction/);
  assert.match(styles, /\.progress-horizons/);
  assert.match(styles, /\.protocol-choice/);
  assert.match(styles, /@media \(max-width:\s*720px\)[\s\S]*grid-template-areas:\s*"defense defense"\s*"initiative initiative"\s*"decision action"\s*"seed seed"/);
  assert.match(packageJson, /"name": "imba-interface"/);
  assert.match(sound, /PROLOGUE_FIELD/);
  assert.match(sound, /MENU_OPEN/);
  assert.match(sound, /MENU_SELECT/);
  assert.match(sound, /SHADOW_VOICE/);
  assert.match(sound, /CURSE_PULSE/);
  assert.match(sound, /WORLD_GATE/);
  assert.match(sound, /SPELL_SEAL/);
  assert.match(sound, /MAGIC_BLOOM/);
  assert.match(sound, /placeholder:\s*true/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("public/hero-crow-v2.webp", root));
  await access(new URL("public/hero-shadow-v1.webp", root));
  await access(new URL("public/menu-virtual-storm-v1.webp", root));
  await access(new URL("public/menu-emerald-castle-v1.webp", root));
  await access(new URL("public/emerald-wizard-observer-v5.webp", root));
  await access(new URL("public/emerald-wizard-portrait-v2.webp", root));
  await access(new URL("assets/source-art/hero-crow-v2.png", root));
  await access(new URL("assets/source-art/hero-shadow-v1.png", root));
  await access(new URL("assets/source-art/emerald-dark-mage-concept-v2.png", root));
  await access(new URL("assets/source-art/emerald-wizard-observer-v5.png", root));
  await access(new URL("public/audio/PLACEHOLDERS.md", root));
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
  await assert.rejects(access(new URL("app/_sites-preview/preview.css", root)));
});
