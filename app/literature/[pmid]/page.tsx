import Link from "next/link";
import { notFound } from "next/navigation";
import { reports } from "../../report-data";

const currentLiterature = reports[0].literature;

export function generateStaticParams() {
  return currentLiterature
    .filter((item) => item.pmid)
    .map((item) => ({ pmid: item.pmid }));
}

export default async function LiteratureDetailPage({
  params,
}: {
  params: Promise<{ pmid: string }>;
}) {
  const { pmid } = await params;
  const item = currentLiterature.find((entry) => entry.pmid === pmid);
  if (!item?.sourceUrl) notFound();

  return (
    <main>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Vigilance Weekly 홈">
          <span className="brandMark">V</span>
          <span>Vigilance Weekly</span>
        </Link>
        <Link className="loginButton" href="/#report">
          공개 리포트 보기
        </Link>
      </header>

      <article className="literatureDetail">
        <Link href="/#report" className="backLink">
          ← 이번 주 리포트
        </Link>
        <div className="badges">
          <span>{item.tag}</span>
          <span className={item.level === "낮음" ? "low" : "medium"}>
            우선순위 {item.level}
          </span>
        </div>
        <p className="eyebrow">LITERATURE DETAIL · PMID {item.pmid}</p>
        <h1>{item.title}</h1>
        <p className="originalTitle">{item.originalTitle}</p>

        <dl className="literatureFacts">
          <div><dt>저자</dt><dd>{item.authors}</dd></div>
          <div><dt>저널</dt><dd>{item.journal}</dd></div>
          <div><dt>공개일</dt><dd>{item.published}</dd></div>
          <div><dt>DOI</dt><dd>{item.doi}</dd></div>
        </dl>

        <section className="detailSection">
          <h2>문헌 요약</h2>
          <p>{item.summary}</p>
        </section>
        <section className="detailSection assessment">
          <h2>PV 검토 포인트</h2>
          <p>{item.assessment}</p>
        </section>

        <a
          className="pubmedButton"
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          PubMed에서 원문 정보 보기 <span>↗</span>
        </a>
      </article>
    </main>
  );
}
