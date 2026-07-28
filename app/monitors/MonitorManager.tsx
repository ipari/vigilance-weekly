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
  frequency: "once" | "daily" | "weekly";
  weekday: number | null;
  timeOfDay: string;
  status: string;
  active: boolean;
  runId: number | null;
  errorMessage: string | null;
};

const PAGE_SIZE = 8;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

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
  const [scheduleFrequency, setScheduleFrequency] = useState<"once" | "daily" | "weekly">("once");
  const [scheduleTime, setScheduleTime] = useState("06:00");
  const [scheduleWeekday, setScheduleWeekday] = useState(1);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null);
  const [editingReportId, setEditingReportId] = useState<number | null>(null);
  const [reportName, setReportName] = useState("");

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
      const response = await fetch(
        editingScheduleId ? `/api/schedules?id=${editingScheduleId}` : "/api/schedules",
        {
        method: editingScheduleId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          frequency: scheduleFrequency,
          executeAt:
            scheduleFrequency === "once" && scheduleAt
              ? new Date(`${scheduleAt}:00+09:00`).toISOString()
              : undefined,
          timeOfDay: scheduleTime,
          weekday: scheduleWeekday,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setScheduleMessage(payload.error ?? "예약을 등록하지 못했습니다.");
        return;
      }
      resetScheduleForm();
      setScheduleMessage(editingScheduleId ? "일정을 수정했습니다." : "일정을 등록했습니다.");
      await loadSchedules();
    } finally {
      setScheduleLoading(false);
    }
  }

  async function deleteSchedule(id: number) {
    if (!window.confirm("이 자동 실행 일정을 삭제할까요?")) return;
    const response = await fetch(`/api/schedules?id=${id}`, { method: "DELETE" });
    const payload = await response.json();
    setScheduleMessage(
      response.ok ? "일정을 삭제했습니다." : payload.error ?? "일정을 삭제하지 못했습니다.",
    );
    if (response.ok) await loadSchedules();
  }

  function editSchedule(schedule: ScheduledRun) {
    setEditingScheduleId(schedule.id);
    setScheduleFrequency(schedule.frequency);
    setScheduleTime(schedule.timeOfDay);
    setScheduleWeekday(schedule.weekday ?? 1);
    setScheduleAt(toSeoulDateTimeInput(schedule.executeAt));
    setScheduleMessage("");
  }

  function resetScheduleForm() {
    setEditingScheduleId(null);
    setScheduleFrequency("once");
    setScheduleAt("");
    setScheduleTime("06:00");
    setScheduleWeekday(1);
  }

  async function saveMonitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingMonitor) return;
    const response = await fetch(`/api/monitors?id=${editingMonitor.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(editingMonitor),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "감시 대상을 수정하지 못했습니다.");
      return;
    }
    setMonitors((current) =>
      current.map((item) => (item.id === payload.monitor.id ? payload.monitor : item)),
    );
    setEditingMonitor(null);
    setMessage("감시 대상을 수정했습니다.");
  }

  async function deleteMonitor(monitor: Monitor) {
    if (!window.confirm(`${monitor.ingredient} 감시 대상을 삭제할까요?`)) return;
    const response = await fetch(`/api/monitors?id=${monitor.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "감시 대상을 삭제하지 못했습니다.");
      return;
    }
    setMonitors((current) => current.filter((item) => item.id !== monitor.id));
    setMessage("감시 대상을 삭제했습니다.");
  }

  async function saveReportName(id: number) {
    const response = await fetch(`/api/monitoring-runs?id=${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: reportName }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setRunMessage(payload.error ?? "리포트 이름을 수정하지 못했습니다.");
      return;
    }
    setRuns((current) =>
      current.map((item) => (item.id === id ? { ...item, reportLabel: payload.run.reportLabel } : item)),
    );
    if (run?.id === id) setRun({ ...run, reportLabel: payload.run.reportLabel });
    setEditingReportId(null);
    setRunMessage("리포트 이름을 수정했습니다.");
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
              1회·매일·매주 일정을 여러 개 등록할 수 있습니다 · 예약 관리 화면이 열려 있는 동안 실행 시각을 확인합니다 · 제한 시간 90분 · Asia/Seoul
            </p>
          </div>
        </div>
        <form className="scheduleForm" onSubmit={createSchedule}>
          <label>
            반복
            <select
              value={scheduleFrequency}
              onChange={(event) => setScheduleFrequency(event.target.value as "once" | "daily" | "weekly")}
            >
              <option value="once">1회성</option>
              <option value="daily">매일</option>
              <option value="weekly">매주</option>
            </select>
          </label>
          {scheduleFrequency === "once" ? (
            <label>
              실행할 날짜와 시각
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(event) => setScheduleAt(event.target.value)}
                required
              />
            </label>
          ) : (
            <>
              {scheduleFrequency === "weekly" && (
                <label>
                  요일
                  <select value={scheduleWeekday} onChange={(event) => setScheduleWeekday(Number(event.target.value))}>
                    {WEEKDAYS.map((day, index) => <option value={index} key={day}>{day}요일</option>)}
                  </select>
                </label>
              )}
              <label>
                실행 시각
                <input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} required />
              </label>
            </>
          )}
          <button type="submit" disabled={scheduleLoading}>
            {scheduleLoading ? "저장 중" : editingScheduleId ? "일정 저장" : "일정 추가"}
          </button>
          {editingScheduleId && <button className="secondaryButton" type="button" onClick={resetScheduleForm}>취소</button>}
        </form>
        {scheduleMessage && <p className="formMessage">{scheduleMessage}</p>}
        <div className="scheduleList">
          {schedules.map((schedule) => (
            <article key={schedule.id}>
              <div>
                <strong>{scheduleLabel(schedule)}</strong>
                <small>
                  {schedule.frequency === "once" && schedule.status === "triggered"
                    ? "실행 완료"
                    : `다음 실행 ${formatSeoulDateTime(schedule.executeAt)}`}
                  {schedule.runId ? ` · 최근 리포트 #${schedule.runId}` : ""}
                  {schedule.status === "failed" ? ` · 실패${schedule.errorMessage ? `: ${schedule.errorMessage}` : ""}` : ""}
                </small>
              </div>
              <div className="rowActions">
                <button type="button" onClick={() => editSchedule(schedule)}>수정</button>
                <button className="dangerButton" type="button" onClick={() => deleteSchedule(schedule.id)}>삭제</button>
              </div>
            </article>
          ))}
          {schedules.length === 0 && (
            <div className="emptyState">등록된 자동 실행 일정이 없습니다.</div>
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

        {editingMonitor && (
          <form className="editMonitorForm" onSubmit={saveMonitor}>
            <div className="editFormHeading">
              <strong>감시 대상 수정</strong>
              <button type="button" onClick={() => setEditingMonitor(null)}>닫기</button>
            </div>
            <label>성분명<input value={editingMonitor.ingredient} onChange={(event) => setEditingMonitor({ ...editingMonitor, ingredient: event.target.value })} required /></label>
            <label>제품명<input value={editingMonitor.productName} onChange={(event) => setEditingMonitor({ ...editingMonitor, productName: event.target.value })} /></label>
            <label>검색 동의어<input value={editingMonitor.aliases} onChange={(event) => setEditingMonitor({ ...editingMonitor, aliases: event.target.value })} /></label>
            <label>감시 지역<select value={editingMonitor.regions} onChange={(event) => setEditingMonitor({ ...editingMonitor, regions: event.target.value })}><option value="KR,US,EU">한국 · 미국 · 유럽</option><option value="KR">한국</option><option value="US">미국</option><option value="EU">유럽</option></select></label>
            <label className="checkboxLabel"><input type="checkbox" checked={editingMonitor.active} onChange={(event) => setEditingMonitor({ ...editingMonitor, active: event.target.checked })} />활성 상태</label>
            <button className="saveEditButton" type="submit">변경사항 저장</button>
          </form>
        )}

        <div className="monitorTableWrap">
          <table className="monitorTable">
            <thead><tr><th>성분명</th><th>제품명</th><th>검색 동의어</th><th>지역</th><th>상태</th><th>관리</th></tr></thead>
            <tbody>
              {visibleMonitors.map((monitor) => (
                <tr key={monitor.id}>
                  <td><strong>{monitor.ingredient}</strong></td>
                  <td>{monitor.productName || "—"}</td>
                  <td>{monitor.aliases || "—"}</td>
                  <td>{regionLabel(monitor.regions)}</td>
                  <td><span className="activePill">{monitor.active ? "활성" : "중지"}</span></td>
                  <td>
                    <div className="rowActions">
                      <button type="button" onClick={() => setEditingMonitor({ ...monitor })}>수정</button>
                      <button className="dangerButton" type="button" onClick={() => deleteMonitor(monitor)}>삭제</button>
                    </div>
                  </td>
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
                {editingReportId === item.id ? (
                  <form
                    className="reportNameForm"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveReportName(item.id);
                    }}
                  >
                    <input
                      autoFocus
                      maxLength={80}
                      value={reportName}
                      onChange={(event) => setReportName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setEditingReportId(null);
                      }}
                    />
                    <button type="submit">저장</button>
                    <button type="button" onClick={() => setEditingReportId(null)}>취소</button>
                  </form>
                ) : (
                  <button
                    className="reportNameButton"
                    type="button"
                    title="이름 수정"
                    onClick={() => {
                      setEditingReportId(item.id);
                      setReportName(item.reportLabel);
                    }}
                  >
                    {item.reportLabel}
                  </button>
                )}
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

function toSeoulDateTimeInput(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function scheduleLabel(schedule: ScheduledRun) {
  if (schedule.frequency === "daily") return `매일 ${schedule.timeOfDay}`;
  if (schedule.frequency === "weekly") {
    return `매주 ${WEEKDAYS[schedule.weekday ?? 1]}요일 ${schedule.timeOfDay}`;
  }
  return `1회 · ${formatSeoulDateTime(schedule.executeAt)}`;
}

function regionLabel(regions: string) {
  return regions.replace("KR", "한국").replace("US", "미국").replace("EU", "유럽").replaceAll(",", " · ");
}
