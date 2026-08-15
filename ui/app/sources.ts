export type ArchiveLink = {
  label: string;
  title: string;
  href: string;
  note: string;
};

export type ArchiveGroup = {
  id: string;
  glyph: string;
  title: string;
  subtitle: string;
  links: ArchiveLink[];
};

export const AUTHOR_NAME = "Aleksey Salkutsan";

export const AUTHOR_LINKS: ArchiveLink[] = [
  {
    label: "САЙТ",
    title: "Чертоги разума / Research",
    href: "https://chertogi-razuma-research.kernelpanic888.chatgpt.site/",
    note: "Основной публичный корпус исследований и читательских карт.",
  },
  {
    label: "GIT",
    title: "github.com/kernelpanic888",
    href: "https://github.com/kernelpanic888",
    note: "Код, формализации, выпуски и проверяемая история работы.",
  },
  {
    label: "ORCID",
    title: "0009-0006-8717-0492",
    href: "https://orcid.org/0009-0006-8717-0492",
    note: "Постоянный идентификатор автора и связанный реестр публикаций.",
  },
  {
    label: "LINKEDIN",
    title: "Aleksey Salkutsan",
    href: "https://www.linkedin.com/in/oleksiy-salkutsan-276a40184/",
    note: "Профессиональный профиль, статьи и текущие исследовательские проекты.",
  },
];

export const ARCHIVE_GROUPS: ArchiveGroup[] = [
  {
    id: "ai-role",
    glyph: "AI",
    title: "РОЛЬ CHATGPT И CODEX",
    subtitle: "Инструменты совместной работы; канон и решения принадлежат автору",
    links: [
      {
        label: "CHATGPT / CONCEPT",
        title: "Диалог, исследование и развитие замысла",
        href: "https://learn.chatgpt.com/",
        note: "ChatGPT использовался как собеседник для исследования источников, развития игровой идеи, сюжета, правил и языка интерфейса. Ответы проверялись, отбирались и превращались в авторский канон Aleksey Salkutsan.",
      },
      {
        label: "CODEX / BUILD",
        title: "Реализация, проверка и локальный плейтест",
        href: "https://developers.openai.com/codex/use-cases",
        note: "Codex использовался как инженерный агент: анализировал проект, писал и редактировал код, собирал игру, запускал тесты и проверял интерфейс в браузере. Финальные требования и творческие решения задавал автор.",
      },
    ],
  },
  {
    id: "oz",
    glyph: "⌂",
    title: "ИЗУМРУДНАЯ АЛЛЮЗИЯ",
    subtitle: "Литературный первоисточник — не пересказ",
    links: [
      {
        label: "1900 / LOC",
        title: "L. Frank Baum — The Wonderful Wizard of Oz",
        href: "https://www.loc.gov/item/03032405/",
        note: "Каталог и цифровая копия первого издания в Library of Congress. IMBA использует мотив пути и Изумрудного города как свободную аллюзию, но рассказывает собственную историю.",
      },
      {
        label: "TEXT / PG55",
        title: "The Wonderful Wizard of Oz — Project Gutenberg",
        href: "https://www.gutenberg.org/ebooks/55",
        note: "Публично доступный английский текст Баума для документальной сверки мотивов.",
      },
    ],
  },
  {
    id: "math",
    glyph: "Mor",
    title: "МАТЕМАТИЧЕСКИЙ КАРКАС",
    subtitle: "Морфизмы, композиция, инварианты, доказательство",
    links: [
      {
        label: "1945 / AMS",
        title: "Eilenberg & Mac Lane — General Theory of Natural Equivalences",
        href: "https://doi.org/10.1090/S0002-9947-1945-0013131-6",
        note: "Историческая категориальная опора для языка объектов, отображений и сохраняемой структуры.",
      },
      {
        label: "MAC LANE",
        title: "Categories for the Working Mathematician",
        href: "https://doi.org/10.1007/978-1-4757-4721-8",
        note: "Систематическая опора для категорий, функторов, естественных преобразований и композиции.",
      },
      {
        label: "OPEN TEXT",
        title: "Tom Leinster — Basic Category Theory",
        href: "https://arxiv.org/abs/1612.09375",
        note: "Открытое современное введение в категориальный язык, на котором читается формула Morᵢ(A,B).",
      },
      {
        label: "LEAN 4",
        title: "The Lean Language Reference",
        href: "https://lean-lang.org/doc/reference/latest/",
        note: "Официальная документация доказательного ядра, которое допускает или удерживает переходы IMBA.",
      },
    ],
  },
  {
    id: "living",
    glyph: "∂D",
    title: "ЖИВОЙ МИР И ГРАНИЦА",
    subtitle: "Авторский исследовательский корпус и физиология устойчивости",
    links: [
      {
        label: "DL-04",
        title: "Living Model in a Virtual Domain",
        href: "https://chertogi-razuma-research.kernelpanic888.chatgpt.site/readers/digital-life-living-model/",
        note: "Идентичность, допустимая история состояний, память сессий, рефлексия и монотонный сертификат.",
      },
      {
        label: "AR-01",
        title: "Activation Relic: Shadow Boundary",
        href: "https://chertogi-razuma-research.kernelpanic888.chatgpt.site/readers/activation-relic-shadow-boundary/",
        note: "Тень, непрямая наблюдаемость, граница, реликт и честный последний срез из трёх фишек.",
      },
      {
        label: "CR-01",
        title: "Certified Continuity Protocol Candidate",
        href: "https://chertogi-razuma-research.kernelpanic888.chatgpt.site/readers/certified-continuity-protocol/",
        note: "Непрерывность контакта и реакции: OBSERVE → ADMIT → CERTIFY → APPEND/HOLD.",
      },
      {
        label: "ALLOSTASIS",
        title: "Peter Sterling — Allostasis: a model of predictive regulation",
        href: "https://pubmed.ncbi.nlm.nih.gov/21684297/",
        note: "Биологическая опора для идеи, что живой Мир не просто теряет HP, а перераспределяет ресурсы и платит цену устойчивости.",
      },
    ],
  },
  {
    id: "game",
    glyph: "◇",
    title: "ИГРОВОЙ ЯЗЫК",
    subtitle: "Авторство игрока, процедурность и значимый результат",
    links: [
      {
        label: "MDA",
        title: "Hunicke, LeBlanc & Zubek — MDA Framework",
        href: "https://www.cs.northwestern.edu/~hunicke/MDA.pdf",
        note: "Связь механики, возникающей динамики и переживания игрока.",
      },
      {
        label: "RULES",
        title: "Salen & Zimmerman — Rules of Play",
        href: "https://mitpress.mit.edu/9780262240451/rules-of-play/",
        note: "Значимое действие: игрок должен видеть связь между выбором, результатом и состоянием системы.",
      },
      {
        label: "PCG",
        title: "Procedural Content Generation in Games",
        href: "https://www.pcgbook.com/",
        note: "Процедурный словарь, ограничения, оценка генератора и проверка выразительного диапазона.",
      },
      {
        label: "MIXED",
        title: "Liapis, Yannakakis & Togelius — Mixed-initiative Content Creation",
        href: "https://www.antoniosliapis.com/articles/pcgbook_mixedinit.php",
        note: "Система предлагает пространство и проверяет ограничения; человек сохраняет авторство результата.",
      },
      {
        label: "SPELLCRAFT",
        title: "Mages of Mystralia — procedural spell-crafting process",
        href: "https://www.gamedeveloper.com/design/creative-process-of-a-procedural-spell-crafting-system",
        note: "Практический разбор конструктора заклинаний вместо каталога готовых эффектов.",
      },
      {
        label: "STORYLETS",
        title: "Kreminski & Wardrip-Fruin — Storylets: Sketching a Map",
        href: "https://mkremins.github.io/publications/Storylets_SketchingAMap.pdf",
        note: "Самодостаточные авторские сцены с условиями и эффектами для расширяемых глав.",
      },
    ],
  },
  {
    id: "perception",
    glyph: "◉",
    title: "ЧИТАЕМОСТЬ И ОПЫТ",
    subtitle: "Визуальная причинность, доступность и честная мотивация",
    links: [
      {
        label: "GAMEFLOW",
        title: "Sweetser & Wyeth — GameFlow",
        href: "https://www.valuesatplay.org/wp-content/uploads/2007/09/sweetser.pdf",
        note: "Ясные цели, управляемый вызов, обратная связь, концентрация и чувство контроля.",
      },
      {
        label: "MOTIVATION",
        title: "Ryan, Rigby & Przybylski — The Motivational Pull of Video Games",
        href: "https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf",
        note: "Компетентность, автономия и связанность как объяснение устойчивой мотивации без тёмных паттернов.",
      },
      {
        label: "PXI",
        title: "Player Experience Inventory",
        href: "https://playerexperienceinventory.org/docs",
        note: "Инструмент измерения опыта; не выдаётся за автоматическое объяснение причин.",
      },
      {
        label: "VFX",
        title: "Nguyen — VFX as a Game Design Language",
        href: "https://media.gdcvault.com/GDC%2B2022/Speaker%2BSlides/VFXasagamedesignlanguage_Nguyen_An-Tim.pdf",
        note: "Форма, ритм и движение эффекта должны сообщать функцию, а не только украшать сцену.",
      },
      {
        label: "XAG",
        title: "Xbox Accessibility Guidelines",
        href: "https://learn.microsoft.com/en-us/xbox/accessibility/guidelines",
        note: "Читаемый текст, несколько каналов смысла, управляемое движение, понятные ошибки и ввод.",
      },
      {
        label: "ETHICS",
        title: "Zagal, Björk & Lewis — Dark Patterns in the Design of Games",
        href: "https://www.diva-portal.org/smash/get/diva2:1043332/FULLTEXT01.pdf",
        note: "Граница: прогрессия должна приглашать к мастерству, а не работать против интересов игрока.",
      },
    ],
  },
];
