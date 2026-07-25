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

export default function MonitorManager() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/monitors")
      .then((res) => res.json())
      .then((data) => setMonitors(data.monitors ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setMessage("저장 중...");

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

  return (
    <div className="managerGrid">
      <section className="panel">
        <h2>새 의약품 등록</h2>
        <p className="panelIntro">성분명을 기준으로 제품명과 검색 동의어를 함께 관리합니다.</p>
        <form className="monitorForm" onSubmit={submit}>
          <label>성분명<input name="ingredient" placeholder="예: apixaban" required /></label>
          <label>제품명<input name="productName" placeholder="예: Eliquis, 엘리퀴스" /></label>
          <label>검색 동의어<input name="aliases" placeholder="예: 아픽사반, BMS-562247" /></label>
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
        <p className="panelIntro">활성화된 의약품은 다음 월요일 모니터링부터 반영됩니다.</p>
        <div className="monitorList">
          {loading ? (
            <div className="emptyState">목록을 불러오는 중입니다.</div>
          ) : monitors.length ? (
            monitors.map((monitor) => (
              <article className="monitorItem" key={monitor.id}>
                <h3>{monitor.ingredient}</h3>
                <p>{monitor.productName || "제품명 미등록"}</p>
                <small>{monitor.aliases || "추가 동의어 없음"} · {monitor.regions}</small>
                <span className="activePill">{monitor.active ? "활성" : "중지"}</span>
              </article>
            ))
          ) : (
            <div className="emptyState">아직 등록된 의약품이 없습니다.</div>
          )}
        </div>
      </section>
    </div>
  );
}
