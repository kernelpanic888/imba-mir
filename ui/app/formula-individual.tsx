export type FormulaChannels = {
  force: number;
  coherence: number;
  resonance: number;
};

export type FormulaIndividualModel = {
  identity: number | string;
  tick: number;
  source: string;
  intent: string;
  path: string;
  form: string;
  synergy: string;
  topology: number;
  complexity: number;
  metaTier: number;
  pressure: string;
  quality: string;
  score: FormulaChannels;
  need: FormulaChannels;
  phrase: string;
};

type FormulaIndividualProps = {
  model: FormulaIndividualModel;
  phase: string;
  className?: string;
  compact?: boolean;
  locale?: "ru" | "en";
};

export type FormulaEntityOrgan = {
  slot: string;
  term: string;
  glyph: string;
  filled: boolean;
  current: boolean;
};

type FormulaEntityProps = {
  model: FormulaIndividualModel;
  phase: string;
  organs: FormulaEntityOrgan[];
  className?: string;
  locale?: "ru" | "en";
};

type FormulaGeometry = {
  code: string;
  outer: string;
  trace: string;
  nodes: Array<{ x: number; y: number; radius: number }>;
  satellites: Array<{ x: number; y: number }>;
};

function hashFormula(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function point(radius: number, angle: number): { x: number; y: number } {
  const radians = angle * Math.PI / 180;
  return {
    x: 50 + Math.cos(radians) * radius,
    y: 50 + Math.sin(radians) * radius,
  };
}

function pointsAttribute(points: Array<{ x: number; y: number }>): string {
  return points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

export function formulaIndividualGeometry(model: FormulaIndividualModel): FormulaGeometry {
  const genome = [
    model.identity,
    model.tick,
    model.source,
    model.intent,
    model.path,
    model.form,
    model.synergy,
    model.topology,
    model.complexity,
    model.metaTier,
    model.pressure,
    model.score.force,
    model.score.coherence,
    model.score.resonance,
    model.need.force,
    model.need.coherence,
    model.need.resonance,
  ].join("|");
  const hash = hashFormula(genome);
  const code = `Φ-${hash.toString(16).toUpperCase().padStart(8, "0").slice(0, 4)}-${(hash ^ (hash >>> 13)).toString(16).toUpperCase().padStart(8, "0").slice(-4)}`;
  const outerCount = 4 + ((model.topology + model.complexity + (hash & 1)) % 5);
  const outerOffset = (hash % 37) - 18;
  const outer = Array.from({ length: outerCount }, (_, index) => {
    const variance = ((hash >>> ((index * 3) % 24)) & 7) - 3;
    return point(37 + variance, outerOffset + index * 360 / outerCount);
  });
  const nodeCount = 3 + model.complexity + (model.form !== "DORMANT" && model.form !== "NONE" ? 1 : 0);
  const nodes = Array.from({ length: nodeCount }, (_, index) => {
    const angle = outerOffset + 19 + index * (360 / nodeCount) + ((hash >>> ((index * 4) % 24)) & 15) - 7;
    const radius = 15 + ((hash >>> ((index * 5 + 2) % 24)) & 15);
    const position = point(radius, angle);
    return { ...position, radius: 1.7 + ((hash >>> ((index * 2 + 5) % 24)) & 3) * .38 };
  });
  const traceOrder = nodes.map((_, index) => (index * ((hash % Math.max(2, nodeCount - 1)) + 1)) % nodeCount);
  const uniqueTrace = [...new Set(traceOrder)].map((index) => nodes[index]);
  const trace = pointsAttribute(uniqueTrace.length > 2 ? [...uniqueTrace, uniqueTrace[0]] : [...nodes, nodes[0]]);
  const satellites = model.synergy === "NONE"
    ? []
    : Array.from({ length: model.metaTier ? 4 : 2 }, (_, index) => point(44, outerOffset + 45 + index * (360 / (model.metaTier ? 4 : 2))));
  return { code, outer: pointsAttribute(outer), trace, nodes, satellites };
}

function channelPercent(value: number, need: number): number {
  if (need <= 0) return value > 0 ? 100 : 0;
  return Math.max(4, Math.min(100, Math.round(value / need * 100)));
}

export function FormulaIndividual({ model, phase, className = "", compact = false, locale = "ru" }: FormulaIndividualProps) {
  const geometry = formulaIndividualGeometry(model);
  const force = channelPercent(model.score.force, model.need.force);
  const coherence = channelPercent(model.score.coherence, model.need.coherence);
  const resonance = channelPercent(model.score.resonance, model.need.resonance);
  const sourceGlyph = ({ WILL: "▲", SHADOW: "◒", MEMORY: "⧖", SPARK: "✧" } as Record<string, string>)[model.source] ?? "·";
  const label = (locale === "en" ? [
    `Formula individual ${geometry.code}`,
    `source ${model.source}`,
    `intention ${model.intent}`,
    `path ${model.path}`,
    `form ${model.form}`,
    `synergy ${model.synergy}`,
    `channels F${model.score.force} C${model.score.coherence} R${model.score.resonance}`,
    `requirements F${model.need.force} C${model.need.coherence} R${model.need.resonance}`,
    `topology ${model.topology}`,
    `meta ${model.metaTier}`,
    `quality ${model.quality}`,
  ] : [
    `Индивидуал формулы ${geometry.code}`,
    `источник ${model.source}`,
    `намерение ${model.intent}`,
    `путь ${model.path}`,
    `форма ${model.form}`,
    `синергия ${model.synergy}`,
    `каналы F${model.score.force} C${model.score.coherence} R${model.score.resonance}`,
    `требования F${model.need.force} C${model.need.coherence} R${model.need.resonance}`,
    `топология ${model.topology}`,
    `мета ${model.metaTier}`,
    `качество ${model.quality}`,
  ]).join(", ");

  return <div
    className={`formula-individual ${compact ? "formula-individual--compact" : ""} ${className}`.trim()}
    data-source={model.source}
    data-intent={model.intent}
    data-path={model.path}
    data-form={model.form}
    data-synergy={model.synergy}
    data-quality={model.quality}
    data-pressure={model.pressure}
    data-meta={model.metaTier}
    data-phase={phase}
    role="img"
    aria-label={label}
  >
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle className="formula-channel formula-channel--force" cx="50" cy="50" r="46" pathLength="100" strokeDasharray={`${force} ${100 - force}`} />
      <circle className="formula-channel formula-channel--coherence" cx="50" cy="50" r="42" pathLength="100" strokeDasharray={`${coherence} ${100 - coherence}`} />
      <circle className="formula-channel formula-channel--resonance" cx="50" cy="50" r="38" pathLength="100" strokeDasharray={`${resonance} ${100 - resonance}`} />
      <polygon className="formula-outer" points={geometry.outer} />
      <polyline className="formula-trace" points={geometry.trace} />
      {geometry.nodes.map((node, index) => <g className="formula-node" key={`${geometry.code}-node-${index}`}>
        <line x1="50" y1="50" x2={node.x} y2={node.y} />
        <circle cx={node.x} cy={node.y} r={node.radius} />
      </g>)}
      <g className="formula-satellites">
        {geometry.satellites.map((satellite, index) => <circle key={`${geometry.code}-satellite-${index}`} cx={satellite.x} cy={satellite.y} r={model.metaTier ? 2.5 : 1.9} />)}
      </g>
      <circle className="formula-core" cx="50" cy="50" r={model.metaTier ? 9 : 7} />
      <text className="formula-core-glyph" x="50" y="53.5" textAnchor="middle">{sourceGlyph}</text>
    </svg>
    <small className="formula-individual-code">{geometry.code}</small>
  </div>;
}

const ENTITY_ORGAN_POSITIONS = [
  { x: 50, y: 10 },
  { x: 86, y: 34 },
  { x: 74, y: 82 },
  { x: 27, y: 82 },
  { x: 14, y: 34 },
] as const;

/** Every accepted rune grows a new organ and changes one living body. */
export function FormulaEntity({ model, phase, organs, className = "", locale = "ru" }: FormulaEntityProps) {
  const geometry = formulaIndividualGeometry(model);
  const born = organs.filter((organ) => organ.filled).length;
  const shell = ENTITY_ORGAN_POSITIONS.map((position, index) => {
    const growth = organs[index]?.filled ? 1 : .23;
    return { x: 50 + (position.x - 50) * growth, y: 50 + (position.y - 50) * growth };
  });
  const organSummary = organs
    .filter((organ) => organ.filled)
    .map((organ) => `${organ.slot} ${organ.term}`)
    .join(", ");
  const label = locale === "en"
    ? `Living entity ${geometry.code}: ${born} of ${organs.length} organs born. ${organSummary || "awaiting the first rune"}`
    : `Живая сущность ${geometry.code}: рождено ${born} из ${organs.length} органов. ${organSummary || "ожидает первую руну"}`;

  return <figure
    className={`formula-entity ${className}`.trim()}
    data-born={born}
    data-source={model.source}
    data-intent={model.intent}
    data-path={model.path}
    data-form={model.form}
    data-synergy={model.synergy}
    data-quality={model.quality}
    data-phase={phase}
    role="img"
    aria-label={label}
  >
    <i className="formula-entity-aura" aria-hidden="true" />
    <svg className="formula-entity-body" viewBox="0 0 100 100" aria-hidden="true">
      <polygon className="formula-entity-membrane" points={pointsAttribute(shell)} />
      <circle className="formula-entity-womb" cx="50" cy="50" r={12 + born * 1.2} />
      <g className="formula-entity-veins">
        {organs.map((organ, index) => {
          const position = ENTITY_ORGAN_POSITIONS[index];
          return <path
            key={`vein-${organ.slot}`}
            data-filled={organ.filled}
            data-current={organ.current}
            d={`M50 50 Q${50 + (position.x - 50) * .24} ${50 + (position.y - 50) * .62} ${position.x} ${position.y}`}
          />;
        })}
      </g>
      <g className="formula-entity-organs">
        {organs.map((organ, index) => {
          const position = ENTITY_ORGAN_POSITIONS[index];
          return <g
            className="formula-entity-organ"
            key={organ.slot}
            data-filled={organ.filled}
            data-current={organ.current}
            transform={`translate(${position.x} ${position.y})`}
          >
            <circle r="7" />
            <circle className="formula-entity-organ-pulse" r="10" />
            <text textAnchor="middle" y="2.5">{organ.glyph}</text>
          </g>;
        })}
      </g>
    </svg>
    <FormulaIndividual model={model} phase={phase} compact className="formula-entity-heart" locale={locale} />
    <span className="formula-entity-birth" aria-hidden="true">
      {organs.map((organ) => <i key={`birth-${organ.slot}`} data-alive={organ.filled} />)}
    </span>
  </figure>;
}
