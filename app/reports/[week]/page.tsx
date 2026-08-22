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
  const reportRegions = report.regions ?? [];
  const regulatory = report.regulatory ?? [];

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
          {reportRegions.map((region) => (
            <Link
              className="regionCard regionCardLink"
              href={`#regulatory-${region.code}`}
              key={region.code}
              aria-label={`${region.name} 규제정보 결과로 이동`}
            >
              <div>
                <span className="regionName">{region.name}</span>
                <small>{region.source}</small>
              </div>
              <strong>{region.count}</strong>
              <p>
                <span>
                  <span
                    className={`statusDot ${region.highCount ? "urgent" : region.count ? "review" : ""}`}
                  />
                  {region.status}
                </span>
                <span className="regionCardAction">결과 보기 →</span>
              </p>
            </Link>
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
          <span>{regulatory.length}건</span>
        </div>
        {report.regulatoryComparison && (
          <div className="regulatoryComparison" aria-label="직전 리포트 대비 규제조치 변화">
            <div className="comparisonLead">
              <span>직전 완료 리포트 대비</span>
              <strong>
                {report.regulatoryComparison.previousCount}건 → {report.regulatoryComparison.currentCount}건
              </strong>
              <small>
                {report.regulatoryComparison.baseline} 기준 {formatDifference(report.regulatoryComparison.difference)}
              </small>
            </div>
            <div className="comparisonRegions">
              {report.regulatoryComparison.regions.map((region) => (
                <div key={region.code}>
                  <span>{region.name}</span>
                  <strong>{region.previousCount} → {region.currentCount}건</strong>
                  <small className={region.difference > 0 ? "increase" : region.difference < 0 ? "decrease" : "same"}>
                    {formatDifference(region.difference)}
                  </small>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="regulatoryRegionGroups">
          {reportRegions.map((region) => {
            const regionItems = regulatory.filter(
              (item) => item.region === region.code,
            );
            return (
              <section
                className="regulatoryRegionGroup"
                id={`regulatory-${region.code}`}
                key={region.code}
              >
                <div className="regulatoryRegionHeading">
                  <div>
                    <h3>{region.name}</h3>
                    <small>{region.source}</small>
                  </div>
                  <strong>{regionItems.length}건</strong>
                </div>
                <div className="regulatoryResultList">
                  {regionItems.length === 0 && (
                    <div className="emptyState reportEmpty">
                      {report.status === "queued" || report.status === "running"
                        ? `${region.name} 규제정보를 수집하고 있습니다.`
                        : `${region.name}에서 감시 대상과 일치하는 신규 규제조치가 없습니다.`}
                    </div>
                  )}
                  {regionItems.map((item) => (
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
                      {item.change && (
                        <p className={`regulatoryChange ${item.change.status}`}>
                          <strong>{changeLabel(item.change.status)}</strong>
                          {item.change.summary}
                        </p>
                      )}
                      <p className="regulatoryAssessment">
                        <strong>평가</strong> {item.assessment}
                      </p>
                      <div className="regulatorySourceMatch">
                        {item.officialDocumentName && (
                          <span>
                            <strong>공식 자료 대상</strong> {item.officialDocumentName}
                            {item.revision ? ` · 개정 ${item.revision}판` : ""}
                          </span>
                        )}
                        {item.matchedTerms.length > 0 && (
                          <small className="matchedTerms">
                            일치 검색어: {item.matchedTerms.join(" · ")}
                          </small>
                        )}
                      </div>
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                        {item.officialDocumentName
                          ? `${item.officialDocumentName} 공식 자료 보기 ↗`
                          : "공식 자료 보기 ↗"}
                      </a>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function formatDifference(value: number) {
  if (value > 0) return `+${value}건`;
  if (value < 0) return `${value}건`;
  return "변화 없음";
}

function changeLabel(status: "new" | "updated" | "unchanged") {
  return {
    new: "새로 포착",
    updated: "내용 갱신",
    unchanged: "동일 항목",
  }[status];
}
