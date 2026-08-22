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
  targets?: {
    ingredient: string;
    productName?: string;
    aliases?: string;
    literatureCount: number;
    regulationCount: number;
    icsrCount: number;
  }[];
  regions?: {
    code: "KR" | "US" | "EU";
    name: string;
    source: string;
    count: number;
    highCount: number;
    status: string;
  }[];
  regulatoryComparison?: {
    baseline: string;
    previousCount: number;
    currentCount: number;
    difference: number;
    regions: {
      code: "KR" | "US" | "EU";
      name: string;
      previousCount: number;
      currentCount: number;
      difference: number;
    }[];
  };
  regulatory?: {
    source: string;
    authority: "MFDS" | "KIDS" | "FDA" | "EMA" | "PRAC";
    region: "KR" | "US" | "EU";
    title: string;
    date: string;
    description: string;
    sourceUrl: string;
    monitor: string;
    matchedTerms: string[];
    actionType:
      | "회수"
      | "판매·사용 중지"
      | "허가 취소·철회"
      | "사용 제한·금기"
      | "허가정보 변경"
      | "안전성 서한"
      | "신호 평가"
      | "공급 제한"
      | "기타";
    priority: "높음" | "중간" | "낮음";
    assessment: string;
    officialDocumentName?: string;
    revision?: number;
    change?: {
      status: "new" | "updated" | "unchanged";
      summary: string;
    };
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
    monitor?: string;
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
  targets: [],
  regions: [
    { code: "KR", name: "한국", source: "MFDS · KIDS", count: 0, highCount: 0, status: "신규 조치 없음" },
    { code: "US", name: "미국", source: "FDA", count: 0, highCount: 0, status: "신규 조치 없음" },
    { code: "EU", name: "유럽", source: "EMA · PRAC", count: 0, highCount: 0, status: "신규 조치 없음" },
  ],
  literature: [],
};

// 실제 모니터링으로 생성된 리포트만 표시합니다.
export const reports: Report[] = [];

export function getReport(slug: string) {
  return reports.find((report) => report.slug === slug);
}
