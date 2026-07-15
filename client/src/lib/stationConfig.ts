export const ALL_MANEUVERS = ['inspection', 'palpation', 'percussion', 'auscultation'] as const;
export type ManeuverId = (typeof ALL_MANEUVERS)[number];

export interface StationConfig {
  enabledManeuvers: ManeuverId[];
  enableHistoryExaminer: boolean;
}

export const DEFAULT_STATION_CONFIG: StationConfig = {
  enabledManeuvers: [...ALL_MANEUVERS],
  enableHistoryExaminer: true,
};

function isManeuverId(value: unknown): value is ManeuverId {
  return typeof value === 'string' && (ALL_MANEUVERS as readonly string[]).includes(value);
}

export function parseStationConfig(raw: string | null | undefined): StationConfig {
  if (!raw?.trim()) return { ...DEFAULT_STATION_CONFIG, enabledManeuvers: [...ALL_MANEUVERS] };
  try {
    const parsed = JSON.parse(raw) as Partial<StationConfig>;
    const enabled = Array.isArray(parsed.enabledManeuvers)
      ? parsed.enabledManeuvers.filter(isManeuverId)
      : [...ALL_MANEUVERS];
    return {
      enabledManeuvers: enabled.length > 0 ? enabled : [...ALL_MANEUVERS],
      enableHistoryExaminer: parsed.enableHistoryExaminer !== false,
    };
  } catch {
    return { ...DEFAULT_STATION_CONFIG, enabledManeuvers: [...ALL_MANEUVERS] };
  }
}
