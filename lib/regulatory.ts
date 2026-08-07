export type RegulatoryRegion = "KR" | "US" | "EU";
export type RegulatoryPriority = "높음" | "중간" | "낮음";
export type RegulatoryActionType =
  | "회수"
  | "판매·사용 중지"
  | "허가 취소·철회"
  | "사용 제한·금기"
  | "허가정보 변경"
  | "안전성 서한"
  | "신호 평가"
  | "공급 제한"
  | "기타";

export type RegulatoryResult = {
  source: string;
  authority: "MFDS" | "KIDS" | "FDA" | "EMA" | "PRAC";
  region: RegulatoryRegion;
  title: string;
  date: string;
  description: string;
  sourceUrl: string;
  monitor: string;
  matchedTerms: string[];
  actionType: RegulatoryActionType;
  priority: RegulatoryPriority;
  assessment: string;
};

export type RegulatoryMonitor = {
  ingredient: string;
  productName: string;
  aliases: string;
};

type Period = { periodStart: string; periodEnd: string };

export function monitorSearchTerms(monitor: RegulatoryMonitor) {
  const terms = [
    monitor.ingredient,
    monitor.productName,
    ...monitor.aliases.split(/[,;\n]/),
  ]
    .map((value) => cleanText(value))
    .filter((value) => value.length >= 2);

  return [...new Map(terms.map((term) => [term.toLocaleLowerCase(), term])).values()];
}

export function isFdaSearchTerm(value: string) {
  return /^[\x20-\x7E]+$/.test(value) && /[A-Za-z0-9]/.test(value);
}

export function matchedSearchTerms(text: string, terms: string[]) {
  const haystack = normalizeForMatch(text);
  return terms.filter((term) => haystack.includes(normalizeForMatch(term)));
}

export function classifyRegulatoryAction(
  text: string,
  classification = "",
): Pick<RegulatoryResult, "actionType" | "priority" | "assessment"> {
  const value = normalizeForMatch(`${text} ${classification}`);
  let actionType: RegulatoryActionType = "기타";

  if (/회수|recall/.test(value)) actionType = "회수";
  else if (/판매.{0,3}중지|사용.{0,3}중지|제조.{0,3}중지|suspend|stop sale|stop use/.test(value)) {
    actionType = "판매·사용 중지";
  } else if (/허가.{0,3}(취소|철회)|revocation|authori[sz]ation withdrawn|market withdrawal/.test(value)) {
    actionType = "허가 취소·철회";
  } else if (/금기|사용.{0,3}제한|contraindicat|restrict(ed|ion)/.test(value)) {
    actionType = "사용 제한·금기";
  } else if (/허가사항.{0,4}(변경|반영)|product information|label(l)?ing|variation|epar/.test(value)) {
    actionType = "허가정보 변경";
  } else if (/안전성.{0,2}(서한|속보)|safety communication|dhpc/.test(value)) {
    actionType = "안전성 서한";
  } else if (/실마리정보|safety signal|prac|signal/.test(value)) {
    actionType = "신호 평가";
  } else if (/공급.{0,3}(제한|부족|중단)|shortage|supply restriction/.test(value)) {
    actionType = "공급 제한";
  }

  let priority: RegulatoryPriority = "낮음";
  if (
    /class i\b|긴급|속보|사망|생명.{0,3}위협|중대한 위해|판매.{0,3}중지|사용.{0,3}중지|제조.{0,3}중지|suspend|revocation|dhpc/.test(
      value,
    )
  ) {
    priority = "높음";
  } else if (
    /class ii\b|회수|recall|안전성.{0,2}서한|warning|금기|contraindicat|restrict|product information|허가사항.{0,4}변경|prac|signal/.test(
      value,
    )
  ) {
    priority = "중간";
  }

  if (/class iii\b/.test(value)) priority = "낮음";

  const assessment = {
    높음: "환자 안전과 공급·사용에 직접 영향을 줄 수 있어 즉시 원문과 대상 품목을 확인합니다.",
    중간: "허가사항, 위험 최소화 조치 및 국내 적용 여부를 우선 검토합니다.",
    낮음: "정기 검토 대상으로 분류하고 기존 허가·안전성 정보와의 변경점을 확인합니다.",
  }[priority];

  return { actionType, priority, assessment };
}

export function parseMfdsSafetyLetters(
  html: string,
  monitor: RegulatoryMonitor,
  period: Period,
): RegulatoryResult[] {
  const terms = monitorSearchTerms(monitor);

  return matchAll(html, /<tr[^>]*>([\s\S]*?)<\/tr>/gi).flatMap((row) => {
    const cells = matchAll(row, /<td[^>]*>([\s\S]*?)<\/td>/gi).map(cleanText);
    const link = row.match(
      /<a[^>]+href=["']([^"']*\/pbp\/CCBAC01\/getItem[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i,
    );
    const title = cleanText(link?.[2] ?? cells[1] ?? "");
    const description = (cells[2] ?? "").replace(/^요약\s*/, "");
    const date = cells[5]?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
    const matchedTerms = matchedSearchTerms(`${title} ${description}`, terms);
    if (!link || !inPeriod(date, period) || matchedTerms.length === 0) return [];

    return [
      makeResult({
        source: "식품의약품안전처 안전성서한",
        authority: "MFDS",
        region: "KR",
        title,
        date,
        description: description || "식품의약품안전처가 공개한 의약품 안전성 조치입니다.",
        sourceUrl: absoluteUrl(decodeEntities(link[1]), "https://nedrug.mfds.go.kr"),
        monitor: monitor.ingredient,
        matchedTerms,
      }),
    ];
  });
}

export function parseKidsSignals(
  html: string,
  monitor: RegulatoryMonitor,
  period: Period,
): RegulatoryResult[] {
  const terms = monitorSearchTerms(monitor);

  return matchAll(html, /<tr[^>]*>([\s\S]*?)<\/tr>/gi).flatMap((row) => {
    const id = row.match(/fn_GoRead\(['"](\d+)['"]\)/i)?.[1];
    const cells = matchAll(row, /<td[^>]*>([\s\S]*?)<\/td>/gi).map(cleanText);
    const title = cells[1] ?? "";
    const date = cells[3] ?? "";
    const matchedTerms = matchedSearchTerms(title, terms);
    if (!id || !inPeriod(date, period) || matchedTerms.length === 0) return [];

    return [
      makeResult({
        source: "KIDS 실마리정보 알리미",
        authority: "KIDS",
        region: "KR",
        title,
        date,
        description:
          "한국의약품안전관리원이 KAERS 자료에서 탐지하고 후속 조치와 함께 공개한 실마리정보입니다.",
        sourceUrl: `https://open.drugsafe.or.kr/alarm/arlm/Read.jsp?ntt_id=${id}`,
        monitor: monitor.ingredient,
        matchedTerms,
      }),
    ];
  });
}

export function parseEmaFeed(
  xml: string,
  monitor: RegulatoryMonitor,
  period: Period,
): RegulatoryResult[] {
  const terms = monitorSearchTerms(monitor);

  return matchAll(xml, /<item[^>]*>([\s\S]*?)<\/item>/gi).flatMap((item) => {
    const title = xmlValue(item, "title");
    const description = xmlValue(item, "description");
    const sourceUrl = xmlValue(item, "link");
    const date = formatSeoulDate(xmlValue(item, "pubDate"));
    const text = `${title} ${description}`;
    const matchedTerms = matchedSearchTerms(text, terms);
    if (
      !inPeriod(date, period) ||
      matchedTerms.length === 0 ||
      !isEmaRegulatoryContent(text)
    ) {
      return [];
    }

    const authority = /\bprac\b/i.test(text) ? "PRAC" : "EMA";
    return [
      makeResult({
        source: authority === "PRAC" ? "EMA PRAC" : "European Medicines Agency",
        authority,
        region: "EU",
        title,
        date,
        description: description || title,
        sourceUrl,
        monitor: monitor.ingredient,
        matchedTerms,
      }),
    ];
  });
}

export function makeFdaResult(
  item: Record<string, unknown>,
  monitor: RegulatoryMonitor,
  matchedTerms: string[],
): RegulatoryResult {
  const title = String(item.product_description ?? "의약품 회수 정보");
  const reason = String(item.reason_for_recall ?? "");
  const classification = String(item.classification ?? "");
  const status = String(item.status ?? "");
  const recallNumber = String(item.recall_number ?? "");
  const description = [
    reason,
    classification && `분류: ${classification}`,
    status && `상태: ${status}`,
    item.recalling_firm && `회수업체: ${String(item.recalling_firm)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return makeResult(
    {
      source: "FDA Recall Enforcement",
      authority: "FDA",
      region: "US",
      title,
      date: normalizeDate(String(item.report_date ?? "")),
      description,
      sourceUrl: `https://api.fda.gov/drug/enforcement.json?search=${encodeURIComponent(`recall_number:"${recallNumber}"`)}`,
      monitor: monitor.ingredient,
      matchedTerms,
    },
    classification,
  );
}

export function mergeRegulatoryResults(items: RegulatoryResult[]) {
  const merged = new Map<string, RegulatoryResult>();
  for (const stored of items) {
    const inferred = classifyRegulatoryAction(
      `${stored.title ?? ""} ${stored.description ?? ""}`,
    );
    const item: RegulatoryResult = {
      ...stored,
      region: stored.region || inferRegion(stored.source),
      authority: stored.authority || inferAuthority(stored.source),
      matchedTerms: Array.isArray(stored.matchedTerms) ? stored.matchedTerms : [],
      actionType: stored.actionType || inferred.actionType,
      priority: stored.priority || inferred.priority,
      assessment: stored.assessment || inferred.assessment,
    };
    const key = `${item.region}:${item.sourceUrl || item.title}:${item.date}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, item);
      continue;
    }
    current.monitor = uniqueValues(`${current.monitor} · ${item.monitor}`, "·").join(" · ");
    current.matchedTerms = uniqueValues(
      [...current.matchedTerms, ...item.matchedTerms].join(" · "),
      "·",
    );
    if (priorityRank(item.priority) > priorityRank(current.priority)) {
      current.priority = item.priority;
      current.assessment = item.assessment;
    }
  }
  return [...merged.values()];
}

function makeResult(
  base: Omit<RegulatoryResult, "actionType" | "priority" | "assessment">,
  classification = "",
): RegulatoryResult {
  return {
    ...base,
    ...classifyRegulatoryAction(
      `${base.title} ${base.description}`,
      classification,
    ),
  };
}

function isEmaRegulatoryContent(value: string) {
  return /\b(prac|dhpc|epar|referral|safety|signal|shortage|suspend|withdraw|revocation|restriction|product information|variation)\b/i.test(
    value,
  );
}

function inPeriod(date: string, period: Period) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= period.periodStart && date <= period.periodEnd;
}

function formatSeoulDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeDate(value: string) {
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  return compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : value;
}

function xmlValue(xml: string, tag: string) {
  return cleanText(xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ?? "");
}

function cleanText(value: string) {
  return decodeEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function normalizeForMatch(value: string) {
  return cleanText(value).normalize("NFKC").toLocaleLowerCase();
}

function absoluteUrl(value: string, base: string) {
  try {
    return new URL(value, base).toString();
  } catch {
    return base;
  }
}

function matchAll(value: string, expression: RegExp) {
  return [...value.matchAll(expression)].map((match) => match[1]);
}

function uniqueValues(value: string, separator: string) {
  return [...new Map(value.split(separator).map((item) => item.trim()).filter(Boolean).map((item) => [item.toLocaleLowerCase(), item])).values()];
}

function priorityRank(priority: RegulatoryPriority | undefined) {
  return priority ? { 낮음: 1, 중간: 2, 높음: 3 }[priority] : 0;
}

function inferRegion(source: string): RegulatoryRegion {
  if (/FDA/i.test(source)) return "US";
  if (/EMA|PRAC|European/i.test(source)) return "EU";
  return "KR";
}

function inferAuthority(source: string): RegulatoryResult["authority"] {
  if (/KIDS/i.test(source)) return "KIDS";
  if (/FDA/i.test(source)) return "FDA";
  if (/PRAC/i.test(source)) return "PRAC";
  if (/EMA|European/i.test(source)) return "EMA";
  return "MFDS";
}
