export const ALL_MANEUVERS = ['inspection', 'palpation', 'percussion', 'auscultation'] as const;
export type ManeuverId = (typeof ALL_MANEUVERS)[number];

export const MAIN_STAGES = ['history', 'examination', 'investigations', 'diagnosis'] as const;
export type MainStageId = (typeof MAIN_STAGES)[number];
export type SimulationStageId = MainStageId | 'feedback';

export interface StationConfig {
  enabledManeuvers: ManeuverId[];
  enableHistoryExaminer: boolean;
  enableInvestigations: boolean;
  stageOrder: MainStageId[];
  maneuverOpeningMessages: Partial<Record<ManeuverId, string>>;
  maneuverLabels: Partial<Record<ManeuverId, { en: string; ar: string }>>;
}

export const DEFAULT_MANEUVER_OPENING_TEMPLATE =
  'I am evaluating your clinical {{maneuver}}. Take a close look at the clinical presentation and images provided. Describe your findings systematically and explain what you would look for during {{maneuver}}, including any scars, deformities, or visible abnormalities.';

export const MANEUVER_LABELS: Record<ManeuverId, { en: string; ar: string }> = {
  inspection: { en: 'Inspection', ar: 'الفحص البصري' },
  palpation: { en: 'Palpation', ar: 'الجس' },
  percussion: { en: 'Percussion', ar: 'النقر' },
  auscultation: { en: 'Auscultation', ar: 'الاستماع' },
};

export const DEFAULT_STATION_CONFIG: StationConfig = {
  enabledManeuvers: [...ALL_MANEUVERS],
  enableHistoryExaminer: true,
  enableInvestigations: true,
  stageOrder: [...MAIN_STAGES],
  maneuverOpeningMessages: {},
  maneuverLabels: {},
};

function isManeuverId(value: unknown): value is ManeuverId {
  return typeof value === 'string' && (ALL_MANEUVERS as readonly string[]).includes(value);
}

function isMainStage(value: unknown): value is MainStageId {
  return typeof value === 'string' && (MAIN_STAGES as readonly string[]).includes(value);
}

function normalizeStageOrder(order: MainStageId[] | undefined): MainStageId[] {
  const seen = new Set<MainStageId>();
  const normalized: MainStageId[] = [];
  for (const stage of order ?? MAIN_STAGES) {
    if (!isMainStage(stage) || seen.has(stage)) continue;
    seen.add(stage);
    normalized.push(stage);
  }
  for (const stage of MAIN_STAGES) {
    if (!seen.has(stage)) normalized.push(stage);
  }
  return normalized;
}

function parseManeuverOpeningMessages(raw: unknown): Partial<Record<ManeuverId, string>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Partial<Record<ManeuverId, string>> = {};
  for (const maneuver of ALL_MANEUVERS) {
    const value = (raw as Record<string, unknown>)[maneuver];
    if (typeof value === 'string' && value.trim()) result[maneuver] = value.trim();
  }
  return result;
}

function parseManeuverLabels(raw: unknown): Partial<Record<ManeuverId, { en: string; ar: string }>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Partial<Record<ManeuverId, { en: string; ar: string }>> = {};
  for (const maneuver of ALL_MANEUVERS) {
    const value = (raw as Record<string, unknown>)[maneuver];
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const en = String((value as { en?: unknown }).en ?? '').trim();
    const ar = String((value as { ar?: unknown }).ar ?? '').trim();
    if (en || ar) {
      result[maneuver] = {
        en: en || MANEUVER_LABELS[maneuver].en,
        ar: ar || MANEUVER_LABELS[maneuver].ar,
      };
    }
  }
  return result;
}

export function resolveManeuverLabel(
  maneuverId: string,
  config?: StationConfig | null,
  lang: 'en' | 'ar' = 'en',
): string {
  const id = isManeuverId(maneuverId) ? maneuverId : 'inspection';
  const custom = config?.maneuverLabels?.[id];
  if (custom) {
    const preferred = lang === 'ar' ? custom.ar : custom.en;
    if (preferred?.trim()) return preferred.trim();
    if (custom.en?.trim()) return custom.en.trim();
    if (custom.ar?.trim()) return custom.ar.trim();
  }
  return lang === 'ar' ? MANEUVER_LABELS[id].ar : MANEUVER_LABELS[id].en;
}

export function parseStationConfig(raw: string | null | undefined): StationConfig {
  if (!raw?.trim()) {
    return {
      ...DEFAULT_STATION_CONFIG,
      enabledManeuvers: [...ALL_MANEUVERS],
      stageOrder: [...MAIN_STAGES],
      maneuverOpeningMessages: {},
      maneuverLabels: {},
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StationConfig>;
    const enabled = Array.isArray(parsed.enabledManeuvers)
      ? parsed.enabledManeuvers.filter(isManeuverId)
      : [...ALL_MANEUVERS];
    return {
      enabledManeuvers: enabled.length > 0 ? enabled : [...ALL_MANEUVERS],
      enableHistoryExaminer: parsed.enableHistoryExaminer !== false,
      enableInvestigations: parsed.enableInvestigations !== false,
      stageOrder: normalizeStageOrder(
        Array.isArray(parsed.stageOrder) ? parsed.stageOrder.filter(isMainStage) : undefined,
      ),
      maneuverOpeningMessages: parseManeuverOpeningMessages(parsed.maneuverOpeningMessages),
      maneuverLabels: parseManeuverLabels(parsed.maneuverLabels),
    };
  } catch {
    return {
      ...DEFAULT_STATION_CONFIG,
      enabledManeuvers: [...ALL_MANEUVERS],
      stageOrder: [...MAIN_STAGES],
      maneuverOpeningMessages: {},
      maneuverLabels: {},
    };
  }
}

export function getEnabledMainStages(config: StationConfig): MainStageId[] {
  return config.stageOrder.filter((stage) => {
    if (stage === 'investigations') return config.enableInvestigations;
    return true;
  });
}

export function getSimulationStages(config: StationConfig): SimulationStageId[] {
  return [...getEnabledMainStages(config), 'feedback'];
}

export function getNextMainStageAfter(
  current: MainStageId,
  config: StationConfig,
): MainStageId | 'feedback' {
  const stages = getEnabledMainStages(config);
  const index = stages.indexOf(current);
  if (index === -1) return stages[0] ?? 'diagnosis';
  return stages[index + 1] ?? 'feedback';
}

export function isManeuverEnabled(config: StationConfig, maneuverId: string): boolean {
  return config.enabledManeuvers.includes(maneuverId as ManeuverId);
}

export function getSessionStationConfig(session: {
  resolvedStationConfig?: string | null;
  case: { stationConfig?: string };
}): StationConfig {
  if (session.resolvedStationConfig?.trim()) {
    return parseStationConfig(session.resolvedStationConfig);
  }
  return parseStationConfig(session.case.stationConfig);
}
