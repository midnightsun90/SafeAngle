export type VideoNumber = 1 | 2 | 3;
export type Evaluation = {
  id: string;
  assessmentId: string | null;
  name: string;
  createdAt: string;
  lastPath: string;
  selectedTimes: Record<VideoNumber, number | null>;
  answers: Record<VideoNumber, Record<string, string>>;
  skipped: Record<VideoNumber, boolean>;
  fileKeys: Record<VideoNumber, string | null>;
  confirmedScenes: Record<VideoNumber, boolean>;
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

export function addEvaluation(state: DashboardState, name: string, id: string, assessmentId: string | null = null): DashboardState {
  const trimmed = name.trim();
  if (!trimmed || !id || state.evaluations.some((item) => item.id === id)) return state;
  const evaluation: Evaluation = {
    id,
    assessmentId,
    name: trimmed,
    createdAt: new Date().toISOString(),
    lastPath: "/upload/1",
    selectedTimes: { 1: null, 2: null, 3: null },
    answers: { 1: {}, 2: {}, 3: {} },
    skipped: { 1: false, 2: false, 3: false },
    fileKeys: { 1: null, 2: null, 3: null },
    confirmedScenes: { 1: false, 2: false, 3: false },
  };
  return { ...state, activeId: id, evaluations: [evaluation, ...state.evaluations] };
}

export type StoredPerson = { id: string; name: string; created_at: string };
export type StoredAssessment = { id: string; person_id: string; created_at: string };
export type StoredPostureInput = {
  assessment_id: string;
  posture_type: string;
  is_skipped: boolean;
  selected_time_seconds: number | null;
  answers: Record<string, string>;
};
export const postureTypes = { 1: "lift_transfer", 2: "seated_handwork", 3: "push_pull" } as const;

export function postureInputRows(evaluation: Evaluation, managerId: string) {
  if (!evaluation.assessmentId) return [];
  return ([1, 2, 3] as const).map((number) => ({
    assessment_id: evaluation.assessmentId!,
    manager_id: managerId,
    posture_type: postureTypes[number],
    is_skipped: evaluation.skipped[number],
    selected_time_seconds: evaluation.skipped[number] ? null : evaluation.selectedTimes[number],
    answers: evaluation.skipped[number] ? {} : evaluation.answers[number],
    question_schema_version: 1,
  }));
}

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

export function mergeStoredAssessments(
  state: DashboardState,
  assessments: StoredAssessment[],
  inputs: StoredPostureInput[],
  pendingLocalIds: ReadonlySet<string> = new Set(),
): DashboardState {
  const latest = new Map<string, StoredAssessment>();
  for (const assessment of assessments) {
    if (!latest.has(assessment.person_id)) latest.set(assessment.person_id, assessment);
  }
  return {
    ...state,
    evaluations: state.evaluations.map((item) => {
      const assessment = latest.get(item.id);
      if (!assessment) return item;
      if (pendingLocalIds.has(assessment.id) && item.assessmentId === assessment.id) {
        return { ...item, assessmentId: assessment.id };
      }
      const matching = inputs.filter((input) => input.assessment_id === assessment.id);
      const selectedTimes = { ...item.selectedTimes };
      const answers = { ...item.answers };
      const skipped = { ...item.skipped };
      for (const number of [1, 2, 3] as const) {
        const input = matching.find((row) => row.posture_type === postureTypes[number]);
        if (!input) continue;
        selectedTimes[number] = input.selected_time_seconds;
        answers[number] = input.answers ?? {};
        skipped[number] = input.is_skipped;
      }
      return { ...item, assessmentId: assessment.id, selectedTimes, answers, skipped };
    }),
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
      typeof item.lastPath === "string" &&
      item.selectedTimes && item.answers && item.fileKeys && item.skipped),
    );
    return {
      evaluatorName: candidate.evaluatorName,
      activeId: typeof candidate.activeId === "string" && evaluations.some((item) => item.id === candidate.activeId)
        ? candidate.activeId : null,
      evaluations: evaluations.map((item) => {
        const restored = { ...item } as Evaluation & { work?: unknown };
        delete restored.work;
        return { ...restored,
          assessmentId: typeof item.assessmentId === "string" ? item.assessmentId : null,
          lastPath: item.lastPath === "/evaluation" ? "/upload/1" : item.lastPath,
          confirmedScenes: {
            1: item.confirmedScenes?.[1] === true,
            2: item.confirmedScenes?.[2] === true,
            3: item.confirmedScenes?.[3] === true,
          },
        };
      }),
    };
  } catch {
    return null;
  }
}
