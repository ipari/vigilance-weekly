import Link from "next/link";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
import { emptyReport, reports } from "./report-data";
import { getStoredReports } from "../db/public-reports";
import { getNextScheduledRun } from "../db/public-schedules";

export default async function Home() {
  const [user, storedReports, nextSchedule] = await Promise.all([
    getChatGPTUser(),
    getStoredReports(),
    getNextScheduledRun(),
  ]);
  const latestStoredReport = storedReports.find(
    (report) => report.status === "completed",
  );
  const currentReport = latestStoredReport ?? emptyReport;
  const literature = currentReport.literature;
  const regions = currentReport.regions ?? emptyReport.regions ?? [];
  const archiveReports = [...storedReports, ...reports].map((report) => ({
    ...report,
    current: report.slug === currentReport.slug,
  }));

  return (
    <main>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Vigilance Weekly 홈">
          <span className="brandMark">V</span>
          <span>Vigilance Weekly</span>
        </Link>
        <nav className="nav">
          <a href="#report">최신 리포트</a>
          <a href="#archive">지난 리포트</a>
          {user ? (
            <Link className="loginButton" href="/monitors">설정</Link>
          ) : (
            <Link className="loginButton" href={chatGPTSignInPath("/monitors")}>로그인</Link>
          )}
        </nav>
      </header>

      <section className="hero" id="report">
        <div>
          <p className="eyebrow">{currentReport.week} · {currentReport.updatedAt} 업데이트</p>
          <h1>약물 안전성의 변화를<br />한눈에 확인하세요.</h1>
          <p className="heroCopy">
            한국·미국·유럽의 규제정보와 주요 문헌을 매주 모니터링하고,
            검토가 필요한 항목을 GVP 관점으로 정리합니다.
          </p>
        </div>
        <div className="heroStatus">
          <span className="pulse" />
          다음 업데이트
          <strong>
            {nextSchedule
              ? formatSeoulSchedule(nextSchedule.executeAt)
              : "등록된 일정 없음"}
          </strong>
          <small>
            {nextSchedule
              ? "Asia/Seoul 기준"
              : "설정에서 자동 실행 일정을 추가하세요"}
          </small>
        </div>
      </section>

      <section className="summaryGrid" aria-label="이번 주 요약">
        <article className="summaryCard primary">
          <span>모니터링 대상</span>
          <strong>
            {currentReport.targets?.length
              ? `${currentReport.targets.length}개`
              : currentReport.target}
          </strong>
          {currentReport.targets?.length ? (
            <>
              <div className="targetPreview" aria-label="대표 감시 대상">
                {currentReport.targets.slice(0, 3).map((target) => (
                  <span key={target.ingredient}>{target.ingredient}</span>
                ))}
                {currentReport.targets.length > 3 && (
                  <span>+{currentReport.targets.length - 3}개</span>
                )}
              </div>
              <details className="targetDisclosure">
                <summary>전체 대상 보기</summary>
                <div className="targetSummaryList">
                  {currentReport.targets.map((target) => (
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
            <small>{currentReport.aliases}</small>
          )}
        </article>
        <article className="summaryCard">
          <span>신규 규제조치</span>
          <strong>{currentReport.regulationCount}<em>건</em></strong>
          <small className={currentReport.regulationCount ? "warn" : "good"}>
            {currentReport.regulationCount ? "검토 필요" : "즉시 조치 대상 없음"}
          </small>
        </article>
        <article className="summaryCard">
          <span>검토 문헌</span>
          <strong>{currentReport.literatureCount}<em>건</em></strong>
          <small>최근 공개 문헌 포함</small>
        </article>
        <article className="summaryCard">
          <span>ICSR 후보</span>
          <strong>{currentReport.icsrCount}<em>건</em></strong>
          <small className={currentReport.icsrCount ? "warn" : "good"}>
            {currentReport.icsrCount ? "원문 검토 필요" : "신규 후보 없음"}
          </small>
        </article>
      </section>

      <section className="section">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">REGULATORY INTELLIGENCE</p>
            <h2>지역별 규제정보</h2>
          </div>
          <span className="checked">공개자료 확인 완료</span>
        </div>
        <div className="regionGrid">
          {regions.map((region) => (
            <article className="regionCard" key={region.name}>
              <div>
                <span className="regionName">{region.name}</span>
                <small>{region.source}</small>
              </div>
              <strong>{region.count}</strong>
              <p>
                <span className={`statusDot ${region.highCount ? "urgent" : region.count ? "review" : ""}`} />
                {region.status}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">LITERATURE REVIEW</p>
            <h2>이번 주 검토 문헌</h2>
          </div>
          <span>우선순위순</span>
        </div>
        <div className="literatureList">
          {literature.length ? literature.map((item, index) => (
            <Link
              className="literatureCard literatureLink"
              href={`/literature/${item.pmid}`}
              key={item.title}
              aria-label={`${item.title} 상세 정보 보기`}
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
              </div>
              <span className="arrow">↗</span>
            </Link>
          )) : (
            <div className="emptyState">아직 검토할 문헌이 없습니다.</div>
          )}
        </div>
      </section>

      <section className="section archiveSection" id="archive">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">REPORT ARCHIVE</p>
            <h2>지난 리포트</h2>
          </div>
          <span>주차별 보관</span>
        </div>
        <div className="archiveList">
          {archiveReports.length ? archiveReports.map((item) => (
            <article className="archiveRow" key={item.slug}>
              <div className="archiveIcon">W</div>
              <div><strong>{item.week}</strong><small>{item.range}</small></div>
              <span className={item.current ? "current" : ""}>
                {item.status === "queued"
                  ? "업데이트 대기"
                  : item.status === "running"
                    ? "업데이트 중"
                    : item.current
                      ? "현재 리포트"
                      : "보관됨"}
              </span>
              <Link
                className="archiveButton"
                href={`/reports/${item.slug}`}
                aria-label={`${item.week} 리포트 보기`}
              >
                보기
              </Link>
            </article>
          )) : (
            <div className="emptyState">아직 생성된 리포트가 없습니다.</div>
          )}
        </div>
      </section>

      <section className="cta">
        <div>
          <p className="eyebrow">PERSONAL MONITORING</p>
          <h2>감시할 의약품을 직접 관리하세요.</h2>
          <p>로그인하면 성분명과 제품명, 검색 동의어 및 감시 지역을 등록할 수 있습니다.</p>
        </div>
        <Link href={user ? "/monitors" : chatGPTSignInPath("/monitors")}>
          {user ? "설정" : "로그인하고 시작하기"} <span>→</span>
        </Link>
      </section>

      <footer>
        <div className="brand"><span className="brandMark">V</span><span>Vigilance Weekly</span></div>
        <p>업무지원용 모니터링 결과이며, 최종 규제 판단에는 담당자의 검토가 필요합니다.</p>
        <span>Updated {currentReport.updatedAt}</span>
      </footer>
    </main>
  );
}

function formatSeoulSchedule(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
