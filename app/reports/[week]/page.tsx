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
          <strong>
            {report.targets?.length
              ? `${report.targets.length}개`
              : report.target}
          </strong>
          {report.targets?.length ? (
            <>
              <div className="targetPreview" aria-label="대표 감시 대상">
                {report.targets.slice(0, 3).map((target) => (
                  <span key={target.ingredient}>{target.ingredient}</span>
                ))}
                {report.targets.length > 3 && (
                  <span>+{report.targets.length - 3}개</span>
                )}
              </div>
              <details className="targetDisclosure">
                <summary>전체 대상 보기</summary>
                <div className="targetSummaryList">
                  {report.targets.map((target) => (
                    <div className="targetSummaryRow" key={target.ingredient}>
                      <div>
                        <strong>{target.ingredient}</strong>
                        <small>
                          {[target.productName, target.aliases]
                            .filter(Boolean)
                            .join(" · ") || "등록된 검색어"}
                        </small>
                      </div>
                      <span>
                        문헌 {target.literatureCount} · ICSR {target.icsrCount} · 규제{" "}
                        {target.regulationCount}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <small>{report.aliases}</small>
          )}
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

      <section className="section reportRegions">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">REGIONAL OVERVIEW</p>
            <h2>지역별 규제정보</h2>
          </div>
          <span>기관 공개일 기준</span>
        </div>
        <div className="regionGrid">
          {(report.regions ?? []).map((region) => (
            <article className="regionCard" key={region.code}>
              <div>
                <span className="regionName">{region.name}</span>
                <small>{region.source}</small>
              </div>
              <strong>{region.count}</strong>
              <p>
                <span
                  className={`statusDot ${region.highCount ? "urgent" : region.count ? "review" : ""}`}
                />
                {region.status}
              </p>
            </article>
          ))}
        </div>
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
            <Link
              className="literatureCard literatureLink"
              href={`/literature/${item.pmid}`}
              key={item.title}
            >
              <div className="itemNumber">0{index + 1}</div>
              <div className="literatureBody">
                <div className="badges">
                  {item.monitor && <span className="drugBadge">{item.monitor}</span>}
                  <span>{item.tag}</span>
                  <span className={item.level === "낮음" ? "low" : "medium"}>
                    우선순위 {item.level}
                  </span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <small>{item.meta}</small>
                {item.pmid && <span className="inlineDetailLink">자세히 보기 →</span>}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section reportRegulatory">
          <div className="sectionHeading">
            <div>
              <p className="eyebrow">REGULATORY INTELLIGENCE</p>
              <h2>규제정보 검색 결과</h2>
            </div>
            <span>{report.regulatory?.length ?? 0}건</span>
          </div>
          <div className="regulatoryResultList">
            {(!report.regulatory || report.regulatory.length === 0) && (
              <div className="emptyState reportEmpty">
                {report.status === "queued" || report.status === "running"
                  ? "한국·미국·유럽의 규제정보를 수집하고 있습니다."
                  : "이 리포트 기간에는 감시 대상과 일치하는 신규 규제조치가 없습니다."}
              </div>
            )}
            {report.regulatory?.map((item) => (
              <article
                className="regulatoryResult"
                key={`${item.source}-${item.sourceUrl}-${item.monitor}`}
              >
                <div>
                  <span>{item.source}</span>
                  <small>{item.date} · {item.monitor}</small>
                </div>
                <div className="regulatoryBadges" aria-label="규제조치 분류">
                  <span>{item.region}</span>
                  <span>{item.actionType}</span>
                  <span className={`priority ${item.priority === "높음" ? "high" : item.priority === "중간" ? "medium" : "low"}`}>
                    우선순위 {item.priority}
                  </span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <p className="regulatoryAssessment">
                  <strong>평가</strong> {item.assessment}
                </p>
                {item.matchedTerms.length > 0 && (
                  <small className="matchedTerms">
                    일치 검색어: {item.matchedTerms.join(" · ")}
                  </small>
                )}
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                  공식 자료 보기 ↗
                </a>
              </article>
            ))}
          </div>
        </section>
    </main>
  );
}
