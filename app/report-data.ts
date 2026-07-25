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
  literature: {
    tag: string;
    level: "낮음" | "중간";
    title: string;
    summary: string;
    meta: string;
  }[];
};

export const reports: Report[] = [
  {
    slug: "2026-w31",
    week: "2026년 31주차",
    range: "7월 18일 — 7월 25일",
    updatedAt: "2026.07.25",
    current: true,
    target: "Apixaban",
    aliases: "Eliquis · 아픽사반 · 엘리퀴스",
    regulationCount: 0,
    literatureCount: 3,
    icsrCount: 1,
    literature: [
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
    ],
  },
  {
    slug: "2026-w30",
    week: "2026년 30주차",
    range: "7월 11일 — 7월 17일",
    updatedAt: "2026.07.18",
    current: false,
    target: "Apixaban",
    aliases: "Eliquis · 아픽사반 · 엘리퀴스",
    regulationCount: 1,
    literatureCount: 2,
    icsrCount: 0,
    literature: [
      {
        tag: "규제 추적",
        level: "중간",
        title: "경구 항응고제 안전성 정보 정기 검토",
        summary:
          "주요 규제기관의 정기 안전성 검토 동향입니다. 국내 허가사항과의 차이를 추가 확인합니다.",
        meta: "FDA Safety Communication · 규제정보",
      },
      {
        tag: "근거 보관",
        level: "낮음",
        title: "고령 환자에서의 직접 경구 항응고제 비교",
        summary:
          "고령 환자군의 출혈 위험을 비교한 관찰자료로, 누적 안전성 평가 근거에 포함합니다.",
        meta: "PMID 42288106 · 관찰연구",
      },
    ],
  },
  {
    slug: "2026-w29",
    week: "2026년 29주차",
    range: "7월 4일 — 7월 10일",
    updatedAt: "2026.07.11",
    current: false,
    target: "Apixaban",
    aliases: "Eliquis · 아픽사반 · 엘리퀴스",
    regulationCount: 0,
    literatureCount: 1,
    icsrCount: 1,
    literature: [
      {
        tag: "ICSR 검토",
        level: "중간",
        title: "Apixaban 투여 후 중증 출혈 증례",
        summary:
          "병용약물과 신기능을 포함해 인과성 및 예상성을 검토할 필요가 있는 증례입니다.",
        meta: "PMID 42210412 · 증례보고",
      },
    ],
  },
];

export function getReport(slug: string) {
  return reports.find((report) => report.slug === slug);
}
