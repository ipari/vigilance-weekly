export type Report = {
  slug: string;
  week: string;
  range: string;
  updatedAt: string;
  current: boolean;
  target: string;
  aliases: string;
  regulationCount: number;
  literatureCount: number;
  icsrCount: number;
  status?: string;
  stage?: string;
  progress?: number;
  regulatory?: {
    source: string;
    title: string;
    date: string;
    description: string;
    sourceUrl: string;
    monitor: string;
  }[];
  literature: {
    pmid?: string;
    tag: string;
    level: "낮음" | "중간";
    title: string;
    summary: string;
    meta: string;
    originalTitle?: string;
    authors?: string;
    journal?: string;
    doi?: string;
    published?: string;
    assessment?: string;
    sourceUrl?: string;
  }[];
};

export const emptyReport: Report = {
  slug: "empty",
  week: "아직 생성된 리포트가 없습니다",
  range: "감시 대상을 등록하고 리포트를 생성해 주세요.",
  updatedAt: "-",
  current: true,
  target: "감시 대상 없음",
  aliases: "로그인 후 감시 대상 관리에서 약물을 등록할 수 있습니다.",
  regulationCount: 0,
  literatureCount: 0,
  icsrCount: 0,
  literature: [],
};

// 실제 모니터링으로 생성된 리포트만 표시합니다.
export const reports: Report[] = [];

export function getReport(slug: string) {
  return reports.find((report) => report.slug === slug);
}
