"use client";

import { useEffect, useState, type FormEvent } from "react";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";

type WorkContext = {
  company: string;
  worksite: string;
  task: string;
};

const storageKey = "safeangle.recentWorkContexts";
const emptyContext: WorkContext = { company: "", worksite: "", task: "" };

const steps = [
  { number: "01", title: "회사·작업 정보", description: "평가 대상 확인" },
  { number: "02", title: "영상 3종 올리기", description: "자세별 영상 등록" },
  { number: "03", title: "영상 확인", description: "장면과 촬영 상태 확인" },
  { number: "04", title: "확인 질문", description: "영상 밖의 조건 입력" },
  { number: "05", title: "분석", description: "장면별 REBA 계산" },
  { number: "06", title: "결과 요약", description: "점수와 근거 확인" },
];

function readRecentContexts(): WorkContext[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is WorkContext =>
        typeof item?.company === "string" &&
        typeof item?.worksite === "string" &&
        typeof item?.task === "string",
    );
  } catch {
    return [];
  }
}

export default function Home() {
  const [context, setContext] = useState<WorkContext>(emptyContext);
  const [recentContexts, setRecentContexts] = useState<WorkContext[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRecentContexts(readRecentContexts());
  }, []);

  function updateField(field: keyof WorkContext, value: string) {
    setContext((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  function saveContext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = {
      company: context.company.trim(),
      worksite: context.worksite.trim(),
      task: context.task.trim(),
    };
    if (!next.company || !next.worksite || !next.task) return;

    const updated = [
      next,
      ...recentContexts.filter(
        (item) =>
          item.company !== next.company ||
          item.worksite !== next.worksite ||
          item.task !== next.task,
      ),
    ].slice(0, 8);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setRecentContexts(updated);
    setContext(next);
    setSaved(true);
  }

  return (
    <div className="sa-shell">
      <aside className="sa-sidebar" aria-label="평가 단계">
        <div className="sa-brand">
          <span className="sa-brand-mark" aria-hidden="true">S<span>A</span></span>
          <span className="sa-brand-name">SafeAngle<span>작업 자세 평가</span></span>
        </div>

        <div className="sa-sidebar-group">
          <p className="sa-sidebar-label">새 평가</p>
          <div className="sa-nav-active"><span className="sa-nav-symbol">▦</span> 작업 평가 시작</div>
        </div>

        <div className="sa-sidebar-group sa-progress-group">
          <p className="sa-sidebar-label">진행 순서</p>
          <ol className="sa-step-list">
            {steps.map((step, index) => (
              <li key={step.number} className={index === 0 ? "sa-step sa-step-current" : "sa-step"}>
                <span className="sa-step-number">{step.number}</span>
                <span className="sa-step-copy"><strong>{step.title}</strong><small>{step.description}</small></span>
              </li>
            ))}
          </ol>
        </div>

        <div className="sa-sidebar-footer"><span className="sa-status-dot" /> 새 평가 작성 중</div>
      </aside>

      <main className="sa-main">
        <header className="sa-topbar">
          <div className="sa-breadcrumb">작업 평가 <span>/</span> 새 평가</div>
          <div className="sa-topbar-badge"><span className="sa-status-dot" /> 1단계 / 6단계</div>
        </header>

        <div className="sa-content">
          <div className="sa-page-heading">
            <div>
              <span className="sa-eyebrow">새 작업 평가 · 01</span>
              <h1>어떤 작업을 평가하나요?</h1>
              <p>회사의 작업 위치와 공정을 기록하면, 다음 단계에서 해당 작업의 영상을 확인할 수 있습니다.</p>
            </div>
            <div className="sa-heading-index" aria-hidden="true">01<span>/ 06</span></div>
          </div>

          <div className="sa-workspace">
            <section className="sa-form-card" aria-labelledby="work-context-heading">
              <div className="sa-card-head">
                <div className="sa-card-icon" aria-hidden="true">▦</div>
                <div>
                  <h2 id="work-context-heading">회사·작업 정보</h2>
                  <p>아래 세 항목을 입력해 주세요. 이전에 입력한 값은 목록에서 다시 고를 수 있습니다.</p>
                </div>
              </div>

              <form onSubmit={saveContext} className="sa-form">
                <div className="sa-field">
                  <label htmlFor="company">회사명 <span>필수</span></label>
                  <Input id="company" name="company" list="recent-companies" value={context.company}
                    onChange={(event) => updateField("company", event.target.value)}
                    placeholder="회사명을 선택하거나 직접 입력" autoComplete="organization" required />
                  <datalist id="recent-companies">
                    {[...new Set(recentContexts.map((item) => item.company))].map((value) => <option key={value} value={value} />)}
                  </datalist>
                </div>

                <div className="sa-field">
                  <label htmlFor="worksite">사업장·작업 위치 <span>필수</span></label>
                  <Input id="worksite" name="worksite" list="recent-worksites" value={context.worksite}
                    onChange={(event) => updateField("worksite", event.target.value)}
                    placeholder="예: 서울 공장 / 포장 라인" required />
                  <datalist id="recent-worksites">
                    {[...new Set(recentContexts.filter((item) => item.company === context.company).map((item) => item.worksite))]
                      .map((value) => <option key={value} value={value} />)}
                  </datalist>
                </div>

                <div className="sa-field">
                  <label htmlFor="task">공정·작업명 <span>필수</span></label>
                  <Input id="task" name="task" list="recent-tasks" value={context.task}
                    onChange={(event) => updateField("task", event.target.value)}
                    placeholder="예: 제품 포장 및 운반" required />
                  <datalist id="recent-tasks">
                    {[...new Set(recentContexts.filter((item) => item.company === context.company && item.worksite === context.worksite)
                      .map((item) => item.task))].map((value) => <option key={value} value={value} />)}
                  </datalist>
                </div>

                <div className="sa-form-actions">
                  <p>입력한 정보는 이 브라우저에 저장됩니다.</p>
                  <Button className="sa-submit" endIcon={<span aria-hidden="true">→</span>}>정보 저장</Button>
                </div>
                {saved && <p className="sa-saved" role="status">회사·작업 정보를 저장했습니다.</p>}
              </form>
            </section>

            <aside className="sa-next-card" aria-label="다음 단계 안내">
              <div className="sa-next-tag"><span className="sa-next-dot" /> 이어지는 단계</div>
              <div className="sa-next-graphic" aria-hidden="true">
                <div className="sa-video-frame"><span className="sa-play">▶</span><i className="sa-video-line" /></div>
                <div className="sa-video-mini sa-video-mini-one" />
                <div className="sa-video-mini sa-video-mini-two" />
              </div>
              <div className="sa-next-copy">
                <span>02 / 촬영 영상</span>
                <h2>작업 영상 3개를<br />각각 올립니다.</h2>
                <p>낮은 곳에서 높은 곳으로 옮기기, 앉아서 손 작업하기, 물체 밀기·당기기 영상을 차례로 확인합니다.</p>
              </div>
            </aside>
          </div>

          <p className="sa-page-footnote">SafeAngle은 선택한 장면마다 REBA 점수를 따로 계산하도록 설계되어 있습니다.</p>
        </div>
      </main>
    </div>
  );
}
