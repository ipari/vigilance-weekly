import Link from "next/link";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";

const regions = [
  { name: "한국", source: "MFDS · KIDS", count: 0, status: "신규 조치 없음" },
  { name: "미국", source: "FDA", count: 0, status: "신규 조치 없음" },
  { name: "유럽", source: "EMA · PRAC", count: 0, status: "신규 조치 없음" },
];

const literature = [
  {
    tag: "ICSR 검토",
    level: "중간",
    title: "Apixaban 관련 혈관부종 증례",
    summary:
      "혀와 사지의 혈관부종 증례입니다. 원문 확보 후 유효성, 중복 및 예상성 평가가 필요합니다.",
    meta: "PMID 42299724 · 증례보고",
  },
  {
    tag: "누적 평가",
    level: "중간",
    title: "소아 VTE 무작위 임상시험",
    summary:
      "표준치료와 유사한 안전성 결과를 보였습니다. 중대한 사례의 데이터베이스 중복 확인을 권고합니다.",
    meta: "PMID 42392108 · 임상시험",
  },
  {
    tag: "근거 보관",
    level: "낮음",
    title: "복막투석 환자의 apixaban 대 warfarin",
    summary:
      "효과 및 출혈 결과에서 유의한 차이가 없었습니다. 특별 환자군의 누적 근거로 관리합니다.",
    meta: "PMID 42412715 · 관찰연구",
  },
];

const archive = [
  { week: "2026년 31주차", range: "7월 18일 — 7월 25일", current: true },
  { week: "2026년 30주차", range: "7월 11일 — 7월 17일", current: false },
  { week: "2026년 29주차", range: "7월 4일 — 7월 10일", current: false },
];

export default async function Home() {
  const user = await getChatGPTUser();

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
            <Link className="loginButton" href="/monitors">감시 대상 관리</Link>
          ) : (
            <Link className="loginButton" href={chatGPTSignInPath("/monitors")}>로그인</Link>
          )}
        </nav>
      </header>

      <section className="hero" id="report">
        <div>
          <p className="eyebrow">2026년 31주차 · 7월 25일 업데이트</p>
          <h1>약물 안전성의 변화를<br />한눈에 확인하세요.</h1>
          <p className="heroCopy">
            한국·미국·유럽의 규제정보와 주요 문헌을 매주 모니터링하고,
            검토가 필요한 항목을 GVP 관점으로 정리합니다.
          </p>
        </div>
        <div className="heroStatus">
          <span className="pulse" />
          다음 모니터링
          <strong>월요일 06:00</strong>
          <small>Asia/Seoul</small>
        </div>
      </section>

      <section className="summaryGrid" aria-label="이번 주 요약">
        <article className="summaryCard primary">
          <span>모니터링 대상</span>
          <strong>Apixaban</strong>
          <small>Eliquis · 아픽사반 · 엘리퀴스</small>
        </article>
        <article className="summaryCard">
          <span>신규 규제조치</span>
          <strong>0<em>건</em></strong>
          <small className="good">즉시 조치 대상 없음</small>
        </article>
        <article className="summaryCard">
          <span>검토 문헌</span>
          <strong>3<em>건</em></strong>
          <small>최근 공개 문헌 포함</small>
        </article>
        <article className="summaryCard">
          <span>ICSR 후보</span>
          <strong>1<em>건</em></strong>
          <small className="warn">원문 검토 필요</small>
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
              <p><span className="statusDot" />{region.status}</p>
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
          {literature.map((item, index) => (
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
              </div>
              <span className="arrow">↗</span>
            </article>
          ))}
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
          {archive.map((item) => (
            <article className="archiveRow" key={item.week}>
              <div className="archiveIcon">W</div>
              <div><strong>{item.week}</strong><small>{item.range}</small></div>
              <span className={item.current ? "current" : ""}>
                {item.current ? "현재 리포트" : "보관됨"}
              </span>
              <button type="button" aria-label={`${item.week} 리포트 보기`}>보기</button>
            </article>
          ))}
        </div>
      </section>

      <section className="cta">
        <div>
          <p className="eyebrow">PERSONAL MONITORING</p>
          <h2>감시할 의약품을 직접 관리하세요.</h2>
          <p>로그인하면 성분명과 제품명, 검색 동의어 및 감시 지역을 등록할 수 있습니다.</p>
        </div>
        <Link href={user ? "/monitors" : chatGPTSignInPath("/monitors")}>
          {user ? "감시 대상 관리" : "로그인하고 시작하기"} <span>→</span>
        </Link>
      </section>

      <footer>
        <div className="brand"><span className="brandMark">V</span><span>Vigilance Weekly</span></div>
        <p>업무지원용 모니터링 결과이며, 최종 규제 판단에는 담당자의 검토가 필요합니다.</p>
        <span>Updated 2026.07.25</span>
      </footer>
    </main>
  );
}
