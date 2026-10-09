export type VideoNumber = 1 | 2 | 3;
export type WorkContext = { company: string; worksite: string; task: string };
export type Evaluation = {
  id: string;
  name: string;
  createdAt: string;
  lastPath: string;
  work: WorkContext;
  selectedTimes: Record<VideoNumber, number | null>;
  answers: Record<VideoNumber, Record<string, string>>;
  skipped: Record<VideoNumber, boolean>;
  fileKeys: Record<VideoNumber, string | null>;
};
export type DashboardState = {
  evaluatorName: string;
  activeId: string | null;
  evaluations: Evaluation[];
};

export const dashboardStorageKey = "safeangle.dashboard.v1";

export function fileIdentity(file: Pick<File, "name" | "size" | "lastModified">): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function createDashboardState(evaluatorName = ""): DashboardState {
  return { evaluatorName, activeId: null, evaluations: [] };
}

export function addEvaluation(state: DashboardState, name: string, id: string): DashboardState {
  const trimmed = name.trim();
  if (!trimmed || !id || state.evaluations.some((item) => item.id === id)) return state;
  const evaluation: Evaluation = {
    id,
    name: trimmed,
    createdAt: new Date().toISOString(),
    lastPath: "/evaluation",
    work: { company: "", worksite: "", task: "" },
    selectedTimes: { 1: null, 2: null, 3: null },
    answers: { 1: {}, 2: {}, 3: {} },
    skipped: { 1: false, 2: false, 3: false },
    fileKeys: { 1: null, 2: null, 3: null },
  };
  return { ...state, activeId: id, evaluations: [evaluation, ...state.evaluations] };
}

export type StoredPerson = { id: string; name: string; created_at: string };

export function mergeStoredPeople(state: DashboardState, evaluatorName: string, people: StoredPerson[]): DashboardState {
  const local = new Map(state.evaluations.map((item) => [item.id, item]));
  const evaluations = people.map((person) => local.get(person.id)
    ? { ...local.get(person.id)!, name: person.name, createdAt: person.created_at }
    : addEvaluation(createDashboardState(), person.name, person.id).evaluations[0]);
  return {
    evaluatorName,
    activeId: state.activeId && evaluations.some((item) => item.id === state.activeId) ? state.activeId : null,
    evaluations,
  };
}

export function updateEvaluation(
  state: DashboardState,
  id: string,
  change: (evaluation: Evaluation) => Evaluation,
): DashboardState {
  return {
    ...state,
    evaluations: state.evaluations.map((item) => item.id === id ? change(item) : item),
  };
}

export function readDashboardState(raw: string | null): DashboardState | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<DashboardState>;
    if (typeof candidate.evaluatorName !== "string" || !Array.isArray(candidate.evaluations)) return null;
    const evaluations = candidate.evaluations.filter((item): item is Evaluation =>
      Boolean(item && typeof item.id === "string" && typeof item.name === "string" &&
      typeof item.lastPath === "string" && item.work && typeof item.work.company === "string" &&
      item.selectedTimes && item.answers && item.fileKeys && item.skipped),
    );
    return {
      evaluatorName: candidate.evaluatorName,
      activeId: typeof candidate.activeId === "string" && evaluations.some((item) => item.id === candidate.activeId)
        ? candidate.activeId : null,
      evaluations,
    };
  } catch {
    return null;
  }
}
