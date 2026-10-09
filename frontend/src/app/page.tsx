"use client";

import { useRouter } from "next/navigation";
import { useVideoFiles } from "@/components/VideoFilesProvider";

export default function DashboardPage() {
  const router = useRouter();
  const { dashboard, selectPerson, startDemo } = useVideoFiles();

  return <main className="dashboard-home">
    <p className="dashboard-eyebrow">대시보드</p>
    <h1>{dashboard.evaluatorName ? `${dashboard.evaluatorName}님, 안녕하세요` : "SafeAngle 대시보드"}</h1>
    <p className="dashboard-lead">평가할 사람을 추가하고 작업 자세 평가를 시작하세요.</p>

    <section className="dashboard-panel" aria-labelledby="evaluation-list-title">
      <div className="dashboard-panel-heading">
        <div>
          <h2 id="evaluation-list-title">평가 대상자</h2>
          <p>DB에 저장된 평가 대상자 {dashboard.evaluations.length}명</p>
        </div>
      </div>
      {dashboard.evaluations.length ? <div className="dashboard-person-list">
        {dashboard.evaluations.map((person) => <button key={person.id} type="button" onClick={() => router.push(selectPerson(person.id))}>
          <span className="person-avatar" aria-hidden="true">{person.name.slice(0, 1)}</span>
          <span className="person-details"><strong>{person.name}</strong><small>{person.work.task || "작업 정보 입력 전"}</small></span>
          <span className="person-progress">{person.lastPath === "/evaluation" ? "시작 전" : "이어서 평가"}</span>
          <span aria-hidden="true">→</span>
        </button>)}
      </div> : <div className="dashboard-empty">
        <span className="dashboard-empty-icon" aria-hidden="true">＋</span>
        <h3>아직 추가한 평가가 없습니다</h3>
        <p>왼쪽의 평가 추가 버튼으로 첫 평가를 시작하세요.</p>
      </div>}
    </section>
    <button className="dashboard-demo" type="button" onClick={() => { startDemo(); router.push("/review"); }}>예시 사진으로 화면 둘러보기 →</button>
  </main>;
}
