"use client";

import { FormEvent, useEffect, useState } from "react";

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
  monitorCount: number;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
};

export default function MonitorManager() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [run, setRun] = useState<MonitoringRun | null>(null);
  const [runLoading, setRunLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch("/api/monitors")
        .then((res) => res.json())
        .then((data) => setMonitors(data.monitors ?? []))
        .finally(() => setLoading(false)),
      fetch("/api/monitoring-runs")
        .then((res) => res.json())
        .then((data) => setRun(data.run ?? null))
        .finally(() => setRunLoading(false)),
    ]);
  }, []);

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
      setRunMessage(
        `${payload.run.reportLabel} 리포트를 새로 추가했습니다. 현재 약물 목록으로 업데이트를 시작합니다.`,
      );
    } catch {
      setRunMessage("네트워크 오류로 업데이트를 시작하지 못했습니다.");
    } finally {
      setRunning(false);
    }
  }

  const activeMonitorCount = monitors.filter((monitor) => monitor.active).length;
  return (
    <>
      <section className="runPanel" aria-labelledby="weekly-run-title">
        <div>
          <p className="eyebrow">ON-DEMAND UPDATE</p>
          <h2 id="weekly-run-title">이번 주차 업데이트</h2>
          <p>
            현재 활성화된 감시 대상 {activeMonitorCount}개로 최근 7일 문헌과
            규제정보 업데이트를 즉시 요청합니다.
          </p>
          {!runLoading && run && (
            <small className="runMeta">
              마지막 요청: {new Date(run.createdAt).toLocaleString("ko-KR")} ·{" "}
              {run.reportLabel} · {run.monitorCount}개 약물 · {runStatusLabel(run.status)}
            </small>
          )}
        </div>
        <div className="runAction">
          <button
            className="runButton"
            type="button"
            onClick={runWeeklyUpdate}
            disabled={loading || running || activeMonitorCount === 0}
          >
            {running ? "업데이트 중…" : "리포트 업데이트"}
          </button>
          {runMessage && (
            <p className="runMessage" role="status" aria-live="polite">
              {runMessage}
            </p>
          )}
        </div>
      </section>

      <div className="managerGrid">
        <section className="panel">
          <h2>새 의약품 등록</h2>
          <p className="panelIntro">
            성분명을 기준으로 제품명과 검색 동의어를 함께 관리합니다.
          </p>
          <form className="monitorForm" onSubmit={submit}>
            <label>
              성분명
              <input name="ingredient" placeholder="예: apixaban" required />
            </label>
            <label>
              제품명
              <input name="productName" placeholder="예: Eliquis, 엘리퀴스" />
            </label>
            <label>
              검색 동의어
              <input name="aliases" placeholder="예: 아픽사반, BMS-562247" />
            </label>
            <label>
              감시 지역
              <select name="regions" defaultValue="KR,US,EU">
                <option value="KR,US,EU">한국 · 미국 · 유럽</option>
                <option value="KR">한국</option>
                <option value="US">미국</option>
                <option value="EU">유럽</option>
              </select>
            </label>
            <button type="submit">감시 대상 추가</button>
            {message && <p className="formMessage">{message}</p>}
          </form>
        </section>
        <section className="panel">
          <h2>등록된 감시 대상</h2>
          <p className="panelIntro">
            활성화된 의약품은 다음 모니터링부터 반영됩니다.
          </p>
          <div className="monitorList">
            {loading ? (
              <div className="emptyState">목록을 불러오는 중입니다.</div>
            ) : monitors.length ? (
              monitors.map((monitor) => (
                <article className="monitorItem" key={monitor.id}>
                  <h3>{monitor.ingredient}</h3>
                  <p>{monitor.productName || "제품명 미등록"}</p>
                  <small>
                    {monitor.aliases || "추가 동의어 없음"} · {monitor.regions}
                  </small>
                  <span className="activePill">
                    {monitor.active ? "활성" : "중지"}
                  </span>
                </article>
              ))
            ) : (
              <div className="emptyState">
                아직 등록된 의약품이 없습니다.
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function runStatusLabel(status: string) {
  if (status === "queued") return "실행 대기";
  if (status === "running") return "실행 중";
  if (status === "completed") return "완료";
  if (status === "failed") return "실패";
  return status;
}
