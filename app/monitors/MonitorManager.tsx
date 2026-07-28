"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Monitor = {
  id: number;
  ingredient: string;
  productName: string;
  aliases: string;
  regions: string;
  active: boolean;
};

type MonitoringRun = {
  id: number;
  weekKey: string;
  reportSequence: number;
  reportLabel: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  stage: string;
  progress: number;
  completedSteps: number;
  totalSteps: number;
  monitorCount: number;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
};

type ScheduledRun = {
  id: number;
  executeAt: string;
  status: string;
  runId: number | null;
  errorMessage: string | null;
};

const PAGE_SIZE = 8;

export default function MonitorManager() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [runs, setRuns] = useState<MonitoringRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [run, setRun] = useState<MonitoringRun | null>(null);
  const [runLoading, setRunLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [schedules, setSchedules] = useState<ScheduledRun[]>([]);
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);

  useEffect(() => {
    void Promise.all([
      fetch("/api/monitors")
        .then((res) => res.json())
        .then((data) => setMonitors(data.monitors ?? []))
        .finally(() => setLoading(false)),
      loadRuns().finally(() => setRunLoading(false)),
      loadSchedules(),
    ]);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadSchedules();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadRuns() {
    const response = await fetch("/api/monitoring-runs", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      const latest = payload.run ?? null;
      setRun(latest);
      setRuns(payload.runs ?? []);
      return latest as MonitoringRun | null;
    }
    return null;
  }

  async function loadSchedules() {
    const response = await fetch("/api/schedules", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) setSchedules(payload.schedules ?? []);
  }

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setScheduleLoading(true);
    setScheduleMessage("");
    try {
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          executeAt: new Date(`${scheduleAt}:00+09:00`).toISOString(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setScheduleMessage(payload.error ?? "예약을 등록하지 못했습니다.");
        return;
      }
      setScheduleAt("");
      setScheduleMessage("예약 실행을 등록했습니다.");
      await loadSchedules();
    } finally {
      setScheduleLoading(false);
    }
  }

  async function cancelSchedule(id: number) {
    const response = await fetch(`/api/schedules?id=${id}`, { method: "DELETE" });
    const payload = await response.json();
    setScheduleMessage(
      response.ok ? "예약을 취소했습니다." : payload.error ?? "예약을 취소하지 못했습니다.",
    );
    if (response.ok) await loadSchedules();
  }

  async function cancelRun(target: MonitoringRun) {
    const response = await fetch(`/api/monitoring-runs?id=${target.id}`, {
      method: "PATCH",
    });
    const payload = await response.json();
    setRunMessage(
      response.ok && payload.canceled
        ? `${target.reportLabel} 실행을 취소했습니다.`
        : payload.error ?? "실행을 취소하지 못했습니다.",
    );
    await loadRuns();
  }

  useEffect(() => {
    if (run?.status !== "queued" && run?.status !== "running") return;
    const timer = window.setInterval(async () => {
      try {
        const previousStatus = run.status;
        const latest = await loadRuns();
        if (latest && latest.status !== previousStatus) {
          if (latest.status === "completed") {
            setRunMessage(`${latest.reportLabel} 리포트 작성이 완료되었습니다.`);
          } else if (latest.status === "failed") {
            setRunMessage(latest.errorMessage ?? "리포트 업데이트에 실패했습니다.");
          }
        }
      } catch {
        // 다음 확인 주기에 다시 시도합니다.
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [run?.status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setMessage("저장 중…");
    const response = await fetch("/api/monitors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ingredient: data.get("ingredient"),
        productName: data.get("productName"),
        aliases: data.get("aliases"),
        regions: data.get("regions"),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "저장하지 못했습니다.");
      return;
    }
    setMonitors((current) => [payload.monitor, ...current]);
    setMessage("감시 대상이 등록되었습니다.");
    form.reset();
  }

  async function runWeeklyUpdate() {
    setRunning(true);
    setRunMessage("");
    try {
      const response = await fetch("/api/monitoring-runs", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setRunMessage(payload.error ?? "이번 주 업데이트를 시작하지 못했습니다.");
        return;
      }
      setRun(payload.run);
      setRuns((current) => [payload.run, ...current]);
      setRunMessage(`${payload.run.reportLabel} 리포트를 새로 추가했습니다.`);
    } catch {
      setRunMessage("네트워크 오류로 업데이트를 시작하지 못했습니다.");
    } finally {
      setRunning(false);
    }
  }

  async function deleteReport(target: MonitoringRun) {
    if (
      !window.confirm(
        `${target.reportLabel} 리포트를 삭제할까요?\n삭제한 리포트는 복구할 수 없습니다.`,
      )
    ) return;

    setDeletingId(target.id);
    try {
      const response = await fetch(`/api/monitoring-runs?id=${target.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        setRunMessage(payload.error ?? "리포트를 삭제하지 못했습니다.");
        return;
      }
      setRuns((current) => current.filter((item) => item.id !== target.id));
      if (run?.id === target.id) {
        const next = runs.find((item) => item.id !== target.id) ?? null;
        setRun(next);
      }
      setRunMessage(`${target.reportLabel} 리포트를 삭제했습니다.`);
    } finally {
      setDeletingId(null);
    }
  }

  const filteredMonitors = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return monitors;
    return monitors.filter((monitor) =>
      [monitor.ingredient, monitor.productName, monitor.aliases, monitor.regions]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [monitors, query]);
  const pageCount = Math.max(1, Math.ceil(filteredMonitors.length / PAGE_SIZE));
  const visibleMonitors = filteredMonitors.slice(
    (Math.min(page, pageCount) - 1) * PAGE_SIZE,
    Math.min(page, pageCount) * PAGE_SIZE,
  );
  const activeMonitorCount = monitors.filter((monitor) => monitor.active).length;

  return (
    <>
      <section className="runPanel" aria-labelledby="weekly-run-title">
        <div>
          <p className="eyebrow">ON-DEMAND UPDATE</p>
          <h2 id="weekly-run-title">이번 주차 업데이트</h2>
          <p>활성 감시 대상 {activeMonitorCount}개로 최근 7일 자료를 수집합니다.</p>
          {!runLoading && run && (
            <div className="runProgressBlock">
              <small className="runMeta">
                {run.reportLabel} · {run.monitorCount}개 약물 · {runStatusLabel(run.status)}
              </small>
              <div className="progressTrack" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={run.progress}>
                <span style={{ width: `${run.progress}%` }} />
              </div>
              <small className="progressLabel">
                {run.stage} · {run.progress}%{run.totalSteps > 0 ? ` (${run.completedSteps}/${run.totalSteps}단계)` : ""}
              </small>
              {run.errorMessage && (
                <small className="runWarning">
                  {run.status === "completed" ? "일부 수집 안내" : "실패 사유"}:{" "}
                  {run.errorMessage}
                </small>
              )}
            </div>
          )}
        </div>
        <div className="runAction">
          <button className="runButton" type="button" onClick={runWeeklyUpdate} disabled={loading || running || activeMonitorCount === 0}>
            {running ? "업데이트 중…" : "리포트 업데이트"}
          </button>
          {(run?.status === "queued" || run?.status === "running") && (
            <button
              className="cancelRunButton"
              type="button"
              onClick={() => cancelRun(run)}
            >
              실행 취소
            </button>
          )}
          {runMessage && <p className="runMessage" role="status">{runMessage}</p>}
        </div>
      </section>

      <section className="panel schedulePanel">
        <div className="panelHeadingRow">
          <div>
            <h2>예약 실행</h2>
            <p className="panelIntro">
              매주 월요일 06:00 자동 실행 · 예약 화면을 열어 두면 정해진 시각에 실행 · 제한 시간 30분
            </p>
          </div>
        </div>
        <form className="scheduleForm" onSubmit={createSchedule}>
          <label>
            실행할 날짜와 시각
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(event) => setScheduleAt(event.target.value)}
              required
            />
          </label>
          <span>Asia/Seoul</span>
          <button type="submit" disabled={scheduleLoading}>
            {scheduleLoading ? "예약 중" : "예약 등록"}
          </button>
        </form>
        {scheduleMessage && <p className="formMessage">{scheduleMessage}</p>}
        <div className="scheduleList">
          {schedules.map((schedule) => (
            <article key={schedule.id}>
              <div>
                <strong>{formatSeoulDateTime(schedule.executeAt)}</strong>
                <small>
                  {schedule.status === "pending"
                    ? "실행 대기"
                    : schedule.status === "triggered"
                      ? `실행 시작${schedule.runId ? ` · 리포트 #${schedule.runId}` : ""}`
                      : schedule.status === "canceled"
                        ? "예약 취소"
                        : "예약 실패"}
                </small>
              </div>
              {schedule.status === "pending" && (
                <button type="button" onClick={() => cancelSchedule(schedule.id)}>
                  예약 취소
                </button>
              )}
            </article>
          ))}
          {schedules.length === 0 && (
            <div className="emptyState">등록된 일회성 예약이 없습니다.</div>
          )}
        </div>
      </section>

      <section className="panel targetPanel">
        <div className="panelHeadingRow">
          <div>
            <h2>감시 대상</h2>
            <p className="panelIntro">전체 {monitors.length}개 · 활성 {activeMonitorCount}개</p>
          </div>
          <label className="monitorSearch">
            <span className="srOnly">감시 대상 검색</span>
            <input
              type="search"
              placeholder="성분명, 제품명, 동의어 검색"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            />
          </label>
        </div>

        <form className="quickMonitorForm" onSubmit={submit}>
          <label>성분명<input name="ingredient" placeholder="예: apixaban" required /></label>
          <label>제품명<input name="productName" placeholder="예: Eliquis" /></label>
          <label>검색 동의어<input name="aliases" placeholder="예: 아픽사반" /></label>
          <label>감시 지역<select name="regions" defaultValue="KR,US,EU"><option value="KR,US,EU">한국 · 미국 · 유럽</option><option value="KR">한국</option><option value="US">미국</option><option value="EU">유럽</option></select></label>
          <button type="submit">대상 추가</button>
        </form>
        {message && <p className="formMessage">{message}</p>}

        <div className="monitorTableWrap">
          <table className="monitorTable">
            <thead><tr><th>성분명</th><th>제품명</th><th>검색 동의어</th><th>지역</th><th>상태</th></tr></thead>
            <tbody>
              {visibleMonitors.map((monitor) => (
                <tr key={monitor.id}>
                  <td><strong>{monitor.ingredient}</strong></td>
                  <td>{monitor.productName || "—"}</td>
                  <td>{monitor.aliases || "—"}</td>
                  <td>{regionLabel(monitor.regions)}</td>
                  <td><span className="activePill">{monitor.active ? "활성" : "중지"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && visibleMonitors.length === 0 && <div className="emptyState">검색 결과가 없습니다.</div>}
        </div>
        {pageCount > 1 && (
          <div className="pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>이전</button>
            <span>{Math.min(page, pageCount)} / {pageCount}</span>
            <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>다음</button>
          </div>
        )}
      </section>

      <section className="panel reportAdminPanel">
        <div className="panelHeadingRow">
          <div>
            <h2>리포트 관리</h2>
            <p className="panelIntro">생성한 리포트 {runs.length}개</p>
          </div>
        </div>
        <div className="adminReportList">
          {runs.map((item) => (
            <article className="adminReportRow" key={item.id}>
              <div>
                <strong>{item.reportLabel}</strong>
                <small>{item.periodStart} — {item.periodEnd} · {item.monitorCount}개 약물</small>
                {item.errorMessage && (
                  <small className="reportRunError">
                    {item.status === "completed" ? "일부 수집 실패" : item.errorMessage}
                  </small>
                )}
              </div>
              <span className={`runStatus ${item.status}`}>{runStatusLabel(item.status)}</span>
              <a href={`/reports/run-${item.id}`}>보기</a>
              {(item.status === "queued" || item.status === "running") && (
                <button
                  type="button"
                  className="cancelInlineButton"
                  onClick={() => cancelRun(item)}
                >
                  취소
                </button>
              )}
              <button
                type="button"
                className="deleteReportButton"
                disabled={
                  deletingId === item.id ||
                  item.status === "running"
                }
                onClick={() => deleteReport(item)}
              >
                {deletingId === item.id ? "삭제 중…" : "삭제"}
              </button>
            </article>
          ))}
          {!runLoading && runs.length === 0 && <div className="emptyState">생성한 리포트가 없습니다.</div>}
        </div>
      </section>
    </>
  );
}

function runStatusLabel(status: string) {
  if (status === "queued") return "실행 대기";
  if (status === "running") return "실행 중";
  if (status === "completed") return "완료";
  if (status === "failed") return "실패";
  if (status === "canceled") return "취소됨";
  return status;
}

function formatSeoulDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function regionLabel(regions: string) {
  return regions.replace("KR", "한국").replace("US", "미국").replace("EU", "유럽").replaceAll(",", " · ");
}
