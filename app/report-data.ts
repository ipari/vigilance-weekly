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
        pmid: "42299724",
        tag: "ICSR 검토",
        level: "중간",
        title: "Apixaban 관련 혈관부종 증례",
        summary:
          "혀와 사지의 혈관부종 증례입니다. 원문 확보 후 유효성, 중복 및 예상성 평가가 필요합니다.",
        meta: "PMID 42299724 · 증례보고",
        originalTitle:
          "Apixaban-Induced Tongue and Extremity Angioedema: A Case Report",
        authors:
          "Safa Souissi, Khouloud Berrim, Imen Aouinti, Fatma Zgolli, Sarrah Kastalli, Sihem El Aidli",
        journal: "American Journal of Therapeutics",
        doi: "10.1097/MJT.0000000000002152",
        published: "2026년 6월 17일 온라인 공개",
        assessment:
          "Apixaban 투여와 혈관부종 발생의 시간적 연관성, 병용약물, 재투여 여부를 확인하고 예상성 및 중대성을 평가해야 합니다.",
        sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/42299724/",
      },
      {
        pmid: "42392108",
        tag: "누적 평가",
        level: "중간",
        title: "소아 VTE 무작위 임상시험",
        summary:
          "표준치료와 유사한 안전성 결과를 보였습니다. 중대한 사례의 데이터베이스 중복 확인을 권고합니다.",
        meta: "PMID 42392108 · 임상시험",
        originalTitle:
          "Apixaban for the treatment of venous thromboembolic events in paediatric patients: an open-label, multicentre, randomised, controlled descriptive trial",
        authors:
          "Leonardo R Brandão, Joseph Driscoll, Jane W Newburger 외 Pediatric Apixaban VTE Study Investigators",
        journal: "The Lancet Haematology",
        doi: "10.1016/S2352-3026(26)00107-9",
        published: "2026년 7월",
        assessment:
          "소아 VTE 환자에서 apixaban과 표준치료의 유효성·안전성 결과가 유사했습니다. 중대한 이상사례의 개별 증례 중복 여부를 확인합니다.",
        sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/42392108/",
      },
      {
        pmid: "42412715",
        tag: "근거 보관",
        level: "낮음",
        title: "복막투석 환자의 apixaban 대 warfarin",
        summary:
          "효과 및 출혈 결과에서 유의한 차이가 없었습니다. 특별 환자군의 누적 근거로 관리합니다.",
        meta: "PMID 42412715 · 관찰연구",
        originalTitle:
          "Safety and Effectiveness of Apixaban Versus Warfarin in Peritoneal Dialysis Patients with Newly Diagnosed Nonvalvular Atrial Fibrillation",
        authors:
          "Mingyue He, Kevin F Erickson, Hania Kassem, Maria E Montez-Rath, Tara I Chang, Wolfgang C Winkelmayer, Jingbo Niu",
        journal: "American Journal of Nephrology",
        doi: "10.1159/000553428",
        published: "2026년 7월 7일 온라인 공개",
        assessment:
          "복막투석 환자에서 apixaban과 warfarin 간 혈전색전·출혈 결과에 통계적으로 유의한 차이가 없었습니다. 특별 환자군의 누적 근거로 보관합니다.",
        sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/42412715/",
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
