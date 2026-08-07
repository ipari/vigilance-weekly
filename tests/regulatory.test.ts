import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRegulatoryAction,
  isFdaSearchTerm,
  mergeRegulatoryResults,
  monitorSearchTerms,
  parseEmaFeed,
  parseKidsSignals,
  parseMfdsSafetyLetters,
} from "../lib/regulatory.ts";

const monitor = {
  ingredient: "nivolumab",
  productName: "옵디보주",
  aliases: "Opdivo, 니볼루맙",
};
const period = { periodStart: "2026-02-02", periodEnd: "2026-02-08" };

test("성분명, 제품명과 별칭을 중복 없이 검색어로 만든다", () => {
  assert.deepEqual(monitorSearchTerms(monitor), [
    "nivolumab",
    "옵디보주",
    "Opdivo",
    "니볼루맙",
  ]);
});

test("FDA에는 지원되는 영문·숫자 검색어만 전달한다", () => {
  assert.equal(isFdaSearchTerm("apixaban"), true);
  assert.equal(isFdaSearchTerm("Eliquis 5 mg"), true);
  assert.equal(isFdaSearchTerm("엘리퀴스정"), false);
});

test("식약처 안전성서한을 날짜와 전체 검색어로 선별한다", () => {
  const html = `<table><tbody><tr>
    <td>1</td><td><a href="/pbp/CCBAC01/getItem?&amp;safeLetterNo=515">안전성 속보 배포 알림</a></td>
    <td>한국오노약품공업주식회사에서 수입한 옵디보주(니볼루맙)를 자진회수</td>
    <td>바이오의약품품질관리과</td><td>2504</td><td><span>2026-02-06</span></td>
  </tr></tbody></table>`;
  const [item] = parseMfdsSafetyLetters(html, monitor, period);
  assert.equal(item.authority, "MFDS");
  assert.equal(item.region, "KR");
  assert.equal(item.actionType, "회수");
  assert.equal(item.priority, "높음");
  assert.deepEqual(item.matchedTerms, ["옵디보주", "니볼루맙"]);
  assert.match(item.sourceUrl, /safeLetterNo=515/);
});

test("KIDS 실마리정보 목록을 감시 대상과 연결한다", () => {
  const html = `<table><tbody><tr>
    <td>1</td><td><a href="javascript:fn_GoRead('3000');">KSC 실마리정보_니볼루맙-폐렴</a></td>
    <td>의약품안전</td><td>2026-02-05</td><td>10</td><td></td>
  </tr></tbody></table>`;
  const [item] = parseKidsSignals(html, monitor, period);
  assert.equal(item.authority, "KIDS");
  assert.equal(item.actionType, "신호 평가");
  assert.match(item.sourceUrl, /ntt_id=3000/);
});

test("EMA RSS에서 관련 규제 변경만 선별한다", () => {
  const xml = `<rss><channel><item>
    <title>Human medicines EPAR: Opdivo, nivolumab, Revision: 42</title>
    <link>https://www.ema.europa.eu/en/medicines/human/EPAR/opdivo</link>
    <description>Product information updated for Opdivo</description>
    <pubDate>Thu, 05 Feb 2026 12:00:00 +0100</pubDate>
  </item><item>
    <title>Unrelated scientific guideline</title><link>https://example.test</link>
    <description>nivolumab research</description><pubDate>Thu, 05 Feb 2026 12:00:00 +0100</pubDate>
  </item></channel></rss>`;
  const items = parseEmaFeed(xml, monitor, period);
  assert.equal(items.length, 1);
  assert.equal(items[0].region, "EU");
  assert.equal(items[0].actionType, "허가정보 변경");
});

test("조치 문구와 FDA 등급으로 유형과 우선순위를 평가한다", () => {
  assert.deepEqual(
    classifyRegulatoryAction("제품 회수 조치", "Class III").priority,
    "낮음",
  );
  assert.equal(
    classifyRegulatoryAction("잠정 판매·사용 중지 안전성 속보").priority,
    "높음",
  );
  assert.equal(
    classifyRegulatoryAction("new contraindication and restriction").actionType,
    "사용 제한·금기",
  );
});

test("같은 규제조치는 감시 대상과 일치 검색어를 합쳐 한 건으로 센다", () => {
  const first = parseMfdsSafetyLetters(
    `<table><tbody><tr><td>1</td><td><a href="/pbp/CCBAC01/getItem?safeLetterNo=1">옵디보주 회수</a></td><td>니볼루맙 회수</td><td>x</td><td>1</td><td>2026-02-06</td></tr></tbody></table>`,
    monitor,
    period,
  )[0];
  const second = { ...first, monitor: "다른 성분", matchedTerms: ["다른 제품"] };
  const merged = mergeRegulatoryResults([first, second]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].monitor, "nivolumab · 다른 성분");
  assert.deepEqual(merged[0].matchedTerms, ["옵디보주", "니볼루맙", "다른 제품"]);
});
