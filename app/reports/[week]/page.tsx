import Link from "next/link";
import { notFound } from "next/navigation";
import { getReport, reports } from "../../report-data";
import { getStoredReport } from "../../../db/public-reports";

export function generateStaticParams() {
  return reports.map((report) => ({ week: report.slug }));
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week } = await params;
  const storedId = week.startsWith("run-") ? Number(week.slice(4)) : null;
  const report =
    storedId !== null ? await getStoredReport(storedId) : getReport(week);
  if (!report) notFound();

  return (
    <main>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Vigilance Weekly 홈">
          <span className="brandMark">V</span>
          <span>Vigilance Weekly</span>
        </Link>
        <Link className="loginButton" href="/#archive">
          지난 리포트 목록
        </Link>
      </header>

      <section className="reportHero">
        <Link href="/#archive" className="backLink">
          ← 지난 리포트
        </Link>
        <p className="eyebrow">WEEKLY SAFETY REPORT</p>
        <h1>{report.week}</h1>
        <p>{report.range} · {report.updatedAt} 업데이트</p>
      </section>

      <section className="summaryGrid" aria-label={`${report.week} 요약`}>
        <article className="summaryCard primary">
          <span>모니터링 대상</span>
          <strong>{report.target}</strong>
          <small>{report.aliases}</small>
        </article>
        <article className="summaryCard">
          <span>신규 규제조치</span>
          <strong>{report.regulationCount}<em>건</em></strong>
          <small>해당 주차 공개자료 기준</small>
        </article>
        <article className="summaryCard">
          <span>검토 문헌</span>
          <strong>{report.literatureCount}<em>건</em></strong>
          <small>주차별 검색 결과</small>
        </article>
        <article className="summaryCard">
          <span>ICSR 후보</span>
          <strong>{report.icsrCount}<em>건</em></strong>
          <small className={report.icsrCount ? "warn" : "good"}>
            {report.icsrCount ? "원문 검토 필요" : "신규 후보 없음"}
          </small>
        </article>
      </section>

      <section className="section reportLiterature">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">LITERATURE REVIEW</p>
            <h2>{report.week} 검토 문헌</h2>
          </div>
          <span>{report.literatureCount}건</span>
        </div>
        <div className="literatureList">
          {report.literature.length === 0 && (
            <div className="emptyState reportEmpty">
              {report.status === "queued" || report.status === "running"
                ? "현재 감시 대상으로 문헌과 규제정보를 업데이트하고 있습니다."
                : "이 리포트에는 검토 대상 문헌이 없습니다."}
            </div>
          )}
          {report.literature.map((item, index) => (
            <article className="literatureCard" key={item.title}>
              <div className="itemNumber">0{index + 1}</div>
              <div className="literatureBody">
                <div className="badges">
                  <span>{item.tag}</span>
                  <span className={item.level === "낮음" ? "low" : "medium"}>
                    우선순위 {item.level}
                  </span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <small>{item.meta}</small>
                {item.pmid && (
                  <Link
                    className="inlineDetailLink"
                    href={`/literature/${item.pmid}`}
                  >
                    자세히 보기 →
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
