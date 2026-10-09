"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useVideoFiles } from "@/components/VideoFilesProvider";

export default function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { dashboard, ready, storageError, activeEvaluation, files, demoMode, setEvaluatorName, addPerson, selectPerson } = useVideoFiles();
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const needsName = ready && !dashboard.evaluatorName;
  const modalOpen = needsName || creating;
  const needsVideoAgain = activeEvaluation && ([1, 2, 3] as const).some((number) => activeEvaluation.fileKeys[number] && !files[number]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => { if (modalOpen) inputRef.current?.focus(); }, [modalOpen, needsName]);
  useEffect(() => {
    if (ready && dashboard.evaluatorName && pathname !== "/" && !activeEvaluation && !demoMode) router.replace("/");
  }, [ready, dashboard.evaluatorName, pathname, activeEvaluation, demoMode, router]);

  function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    if (needsName) setEvaluatorName(name);
    else { addPerson(name); router.push("/evaluation"); setCreating(false); }
    setName("");
  }

  function openCreate() {
    setName("");
    setCreating(true);
    setMobileOpen(false);
  }

  function goToPerson(id: string) {
    router.push(selectPerson(id));
    setMobileOpen(false);
  }

  if (!ready) return <div className="dashboard-loading">SafeAngle</div>;

  return <div className={`dashboard-shell${expanded ? "" : " dashboard-shell-collapsed"}${modalOpen ? " dashboard-shell-modal" : ""}`}>
    {mobileOpen && <button className="dashboard-backdrop" type="button" aria-label="메뉴 닫기" onClick={() => setMobileOpen(false)} />}
    <aside className={`dashboard-sidebar${mobileOpen ? " dashboard-sidebar-open" : ""}`} aria-label="평가 메뉴" inert={modalOpen}>
      <div className="sidebar-brand-row">
        <Link className="sidebar-brand" href="/" aria-label="SafeAngle 대시보드">{expanded || mobileOpen ? "SafeAngle" : "S"}<span>.</span></Link>
        <button className="sidebar-mobile-close" type="button" aria-label="메뉴 닫기" onClick={() => setMobileOpen(false)}>×</button>
      </div>
      <div className="sidebar-scroll">
        <p className="sidebar-section-label">메뉴</p>
        <Link className={`sidebar-nav-item${pathname === "/" ? " sidebar-nav-active" : ""}`} href="/" title="대시보드">
          <GridIcon /><span>대시보드</span>
        </Link>
        <button className="sidebar-add" type="button" onClick={openCreate} title="평가 추가"><PlusIcon /><span>평가 추가</span></button>
        <div className="sidebar-list-heading"><p className="sidebar-section-label">평가 대상자</p><span>{dashboard.evaluations.length}</span></div>
        <div className="sidebar-people">
          {dashboard.evaluations.map((person) => <button key={person.id} type="button"
            className={`sidebar-person${activeEvaluation?.id === person.id ? " sidebar-person-active" : ""}`}
            onClick={() => goToPerson(person.id)} title={person.name}>
            <span className="sidebar-person-avatar">{person.name.slice(0, 1)}</span><span className="sidebar-person-name">{person.name}</span>
          </button>)}
          {!dashboard.evaluations.length && <p className="sidebar-no-people">아직 평가가 없습니다.</p>}
        </div>
      </div>
      <div className="sidebar-footer"><span className="sidebar-user-avatar">{dashboard.evaluatorName.slice(0, 1) || "?"}</span><span className="sidebar-user-text"><strong>{dashboard.evaluatorName || "평가자"}</strong><small>평가자</small></span></div>
    </aside>
    <div className="dashboard-main-wrap">
      <header className="dashboard-topbar" inert={modalOpen}>
        <button className="dashboard-menu-button" type="button" aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"} onClick={() => { if (window.innerWidth >= 1024) setExpanded((value) => !value); else setMobileOpen((value) => !value); }}><MenuIcon /></button>
        <span className="dashboard-topbar-label">{pathname === "/" ? "대시보드" : demoMode ? "예시 둘러보기" : activeEvaluation?.name ? `${activeEvaluation.name} · 평가` : "평가"}</span>
        <span className="dashboard-topbar-user">{dashboard.evaluatorName || "평가자"}<span className="topbar-avatar">{dashboard.evaluatorName.slice(0, 1) || "?"}</span></span>
      </header>
      <div className={`dashboard-content${modalOpen ? " dashboard-content-blurred" : ""}`} aria-hidden={modalOpen} inert={modalOpen}>
        {storageError && <p className="dashboard-storage-error" role="alert">브라우저에 저장하지 못했습니다. 저장 공간 설정을 확인해 주세요.</p>}
        {needsVideoAgain && pathname !== "/" && <p className="dashboard-storage-error" role="status">이전에 선택한 영상은 다시 골라야 합니다. <Link href="/upload/1">영상 다시 선택하기 →</Link></p>}
        {children}
      </div>
    </div>
    {modalOpen && <div className="dashboard-modal-scrim" role="presentation">
      <div className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-modal-title">
        <div className="dashboard-modal-mark">S<span>.</span></div>
        <h2 id="dashboard-modal-title">{needsName ? "이름을 알려주세요" : "누구를 평가하나요?"}</h2>
        <p>{needsName ? "평가자 이름을 입력하면 대시보드를 사용할 수 있습니다." : "평가 대상자의 이름을 입력해 주세요."}</p>
        <form onSubmit={submitName}>
          <label htmlFor="dashboard-name">{needsName ? "평가자 이름" : "평가 대상자 이름"}</label>
          <input ref={inputRef} id="dashboard-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" maxLength={50} required />
          <button className="dashboard-modal-submit" type="submit">{needsName ? "시작하기" : "평가 시작"} <span aria-hidden="true">→</span></button>
        </form>
        {!needsName && <button className="dashboard-modal-cancel" type="button" onClick={() => setCreating(false)}>취소</button>}
      </div>
    </div>}
  </div>;
}

function GridIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>; }
function PlusIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>; }
function MenuIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round"/></svg>; }
