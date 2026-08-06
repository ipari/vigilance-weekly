import { nextScheduleOccurrence } from "../lib/scheduling";
import { shouldRestartLegacyRun } from "../lib/monitoring-state";

interface MonitoringEnv {
  DB: D1Database;
}

type Monitor = {
  id: number;
  ingredient: string;
  productName: string;
  aliases: string;
  regions: string;
};

type LiteratureResult = {
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  published: string;
  doi: string;
  abstract: string;
  sourceUrl: string;
  monitor: string;
  priority: "낮음" | "중간";
  tag: string;
};

type RegulatoryResult = {
  source: string;
  title: string;
  date: string;
  description: string;
  sourceUrl: string;
  monitor: string;
};

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const RUN_TIMEOUT_MS = 90 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 1500;
const MAX_REQUEST_JITTER_MS = 500;
const MAX_RETRY_AFTER_MS = 60_000;
const FETCH_TIMEOUT_MS = 20_000;
const STEP_LOCK_TIMEOUT_MS = 2 * 60 * 1000;
const nextRequestAtByHost = new Map<string, number>();

export async function startMonitoringRun(
  request: Request,
  env: MonitoringEnv,
) {
  const email = request.headers.get(USER_EMAIL_HEADER);
  if (!email) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const monitorResult = await env.DB.prepare(
    `SELECT id, ingredient, product_name AS productName,
      aliases, regions
     FROM monitors
     WHERE active = 1
     ORDER BY id`,
  )
    .all<Monitor>();
  const activeMonitors = uniqueBy(
    monitorResult.results ?? [],
    (monitor) => monitor.ingredient.trim().toLocaleLowerCase(),
  );

  if (activeMonitors.length === 0) {
    return Response.json(
      { error: "먼저 활성 감시 대상 약물을 한 개 이상 등록해 주세요." },
      { status: 400 },
    );
  }

  const period = currentSeoulWeek();
  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM monitoring_runs
     WHERE week_key = ?`,
  )
    .bind(period.weekKey)
    .first<{ count: number }>();
  const reportSequence = Number(countRow?.count ?? 0) + 1;
  const totalSteps = activeMonitors.length * 2;

  const insertResult = await env.DB.prepare(
    `INSERT INTO monitoring_runs (
      owner_email, week_key, report_sequence, period_start, period_end,
      status, stage, progress, completed_steps, total_steps,
      monitor_count, monitor_snapshot, trigger_type
    ) VALUES (?, ?, ?, ?, ?, 'queued', '실행 대기', 0, 0, ?, ?, ?, 'manual')`,
  )
    .bind(
      email,
      period.weekKey,
      reportSequence,
      period.periodStart,
      period.periodEnd,
      totalSteps,
      activeMonitors.length,
      JSON.stringify(activeMonitors),
    )
    .run();

  const runId = Number(insertResult.meta.last_row_id);
  if (!Number.isInteger(runId) || runId < 1) {
    throw new Error("실행 기록을 생성하지 못했습니다.");
  }
  return Response.json(
    {
      run: {
        id: runId,
        weekKey: period.weekKey,
        reportSequence,
        reportLabel: reportLabel(period.weekKey, reportSequence),
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        status: "queued",
        stage: "실행 대기",
        progress: 0,
        completedSteps: 0,
        totalSteps,
        monitorCount: activeMonitors.length,
        triggerType: "manual",
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
      },
    },
    { status: 202 },
  );
}

type ActiveRun = {
  id: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  completedSteps: number;
  totalSteps: number;
  failedSteps: number;
  monitorSnapshot: string;
  literatureResults: string;
  regulatoryResults: string;
  errorMessage: string | null;
};

export async function resumeActiveMonitoringRun(env: MonitoringEnv) {
  const now = new Date();
  const nowIso = now.toISOString();
  const staleLock = new Date(now.getTime() - STEP_LOCK_TIMEOUT_MS).toISOString();
  const candidate = await env.DB.prepare(
    `SELECT id, completed_steps AS completedSteps,
            last_activity_at AS lastActivityAt,
            literature_results AS literatureResults,
            regulatory_results AS regulatoryResults
     FROM monitoring_runs
     WHERE status IN ('queued', 'running')
     ORDER BY created_at, id
     LIMIT 1`,
  ).first<{
    id: number;
    completedSteps: number;
    lastActivityAt: string | null;
    literatureResults: string;
    regulatoryResults: string;
  }>();
  if (!candidate) return;

  // Runs created by the former monolithic worker advanced progress without
  // checkpointing results. Restart those safely from the first source.
  if (shouldRestartLegacyRun(candidate)) {
    await env.DB.prepare(
      `UPDATE monitoring_runs
       SET completed_steps = 0, progress = 0, failed_steps = 0,
           error_message = NULL, stage = '중단 지점 복구 · 처음부터 다시 수집'
       WHERE id = ? AND status IN ('queued', 'running')`,
    )
      .bind(candidate.id)
      .run();
  }

  const token = crypto.randomUUID();
  const claimed = await env.DB.prepare(
    `UPDATE monitoring_runs
     SET step_lock_token = ?, step_lock_at = ?, last_activity_at = ?,
         status = 'running', started_at = COALESCE(started_at, ?)
     WHERE id = ? AND status IN ('queued', 'running')
       AND (step_lock_token IS NULL OR step_lock_at < ?)`,
  )
    .bind(token, nowIso, nowIso, nowIso, candidate.id, staleLock)
    .run();
  if (Number(claimed.meta.changes ?? 0) !== 1) return;

  const run = await env.DB.prepare(
    `SELECT id, status, period_start AS periodStart, period_end AS periodEnd,
            completed_steps AS completedSteps, total_steps AS totalSteps,
            failed_steps AS failedSteps, monitor_snapshot AS monitorSnapshot,
            literature_results AS literatureResults,
            regulatory_results AS regulatoryResults, error_message AS errorMessage
     FROM monitoring_runs
     WHERE id = ? AND step_lock_token = ?`,
  )
    .bind(candidate.id, token)
    .first<ActiveRun>();
  if (!run) return;

  try {
    const monitors = JSON.parse(run.monitorSnapshot) as Monitor[];
    const step = run.completedSteps;
    if (!Array.isArray(monitors) || step >= run.totalSteps) {
      await completeRun(env, run, token);
      return;
    }
    const monitor = monitors[Math.floor(step / 2)];
    if (!monitor) throw new Error("저장된 감시 대상 정보를 읽을 수 없습니다.");
    const isLiterature = step % 2 === 0;
    const source = isLiterature ? "PubMed 문헌" : "FDA 규제정보";
    await env.DB.prepare(
      `UPDATE monitoring_runs
       SET stage = ?, last_activity_at = ?
       WHERE id = ? AND step_lock_token = ?`,
    )
      .bind(
        `${monitor.ingredient} ${source} 검색 · 요청 간격 조절 중`,
        new Date().toISOString(),
        run.id,
        token,
      )
      .run();

    let literature = safeArray<LiteratureResult>(run.literatureResults);
    let regulatory = safeArray<RegulatoryResult>(run.regulatoryResults);
    let failedSteps = run.failedSteps;
    let warning = run.errorMessage;
    try {
      const period = { periodStart: run.periodStart, periodEnd: run.periodEnd };
      if (isLiterature) {
        literature = uniqueBy(
          [...literature, ...(await fetchPubMed(monitor, period))],
          (item) => item.pmid,
        );
      } else {
        regulatory = uniqueBy(
          [...regulatory, ...(await fetchFdaRecalls(monitor, period))],
          (item) => `${item.source}:${item.title}:${item.date}`,
        );
      }
    } catch (error) {
      failedSteps += 1;
      const itemWarning = `${monitor.ingredient} ${isLiterature ? "PubMed" : "FDA"}: ${errorMessage(error)}`;
      warning = [warning, itemWarning].filter(Boolean).join(" | ");
    }

    const completedSteps = step + 1;
    const finished = completedSteps >= run.totalSteps;
    await env.DB.prepare(
      `UPDATE monitoring_runs
       SET status = ?, stage = ?, progress = ?, completed_steps = ?,
           failed_steps = ?, literature_results = ?, regulatory_results = ?,
           error_message = ?, completed_at = ?, last_activity_at = ?,
           step_lock_token = NULL, step_lock_at = NULL
       WHERE id = ? AND step_lock_token = ? AND status = 'running'`,
    )
      .bind(
        finished ? "completed" : "running",
        finished
          ? failedSteps > 0
            ? `리포트 작성 완료 · 일부 수집 실패 ${failedSteps}건`
            : "리포트 작성 완료"
          : `다음 수집 단계 대기 · ${completedSteps}/${run.totalSteps}`,
        finished ? 100 : percent(completedSteps, run.totalSteps),
        completedSteps,
        failedSteps,
        JSON.stringify(literature),
        JSON.stringify(regulatory),
        warning,
        finished ? new Date().toISOString() : null,
        new Date().toISOString(),
        run.id,
        token,
      )
      .run();
  } catch (error) {
    await env.DB.prepare(
      `UPDATE monitoring_runs
       SET status = 'failed', stage = '업데이트 실패', error_message = ?,
           completed_at = ?, last_activity_at = ?,
           step_lock_token = NULL, step_lock_at = NULL
       WHERE id = ? AND step_lock_token = ?`,
    )
      .bind(
        errorMessage(error),
        new Date().toISOString(),
        new Date().toISOString(),
        run.id,
        token,
      )
      .run();
  }
}

async function completeRun(env: MonitoringEnv, run: ActiveRun, token: string) {
  await env.DB.prepare(
    `UPDATE monitoring_runs
     SET status = 'completed', stage = '리포트 작성 완료', progress = 100,
         completed_at = ?, last_activity_at = ?,
         step_lock_token = NULL, step_lock_at = NULL
     WHERE id = ? AND step_lock_token = ?`,
  )
    .bind(new Date().toISOString(), new Date().toISOString(), run.id, token)
    .run();
}

function safeArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function fetchPubMed(
  monitor: Monitor,
  period: ReturnType<typeof currentSeoulWeek>,
): Promise<LiteratureResult[]> {
  const names = [
    monitor.ingredient,
    monitor.productName,
    ...monitor.aliases.split(","),
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  const term = `(${names.map((name) => `"${name}"[Title/Abstract]`).join(" OR ")}) AND ("${period.periodStart}"[Date - Publication] : "${period.periodEnd}"[Date - Publication])`;
  const searchUrl = new URL(
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
  );
  searchUrl.search = new URLSearchParams({
    db: "pubmed",
    term,
    retmode: "json",
    retmax: "20",
    sort: "pub date",
    tool: "vigilance-weekly",
  }).toString();

  const searchResponse = await fetchWithRetry(
    searchUrl,
    { headers: { accept: "application/json" } },
    "PubMed 검색",
  );
  if (!searchResponse.ok) {
    throw new Error(`PubMed 검색 실패 (${searchResponse.status})`);
  }
  const search = (await searchResponse.json()) as {
    esearchresult?: { idlist?: string[] };
  };
  const ids = search.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];

  const fetchUrl = new URL(
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
  );
  fetchUrl.search = new URLSearchParams({
    db: "pubmed",
    id: ids.join(","),
    retmode: "xml",
    rettype: "abstract",
    tool: "vigilance-weekly",
  }).toString();
  const articleResponse = await fetchWithRetry(
    fetchUrl,
    { headers: { accept: "application/xml" } },
    "PubMed 상세정보 조회",
  );
  if (!articleResponse.ok) {
    throw new Error(`PubMed 상세정보 조회 실패 (${articleResponse.status})`);
  }
  return parsePubMedXml(await articleResponse.text(), monitor.ingredient);
}

function parsePubMedXml(xml: string, monitor: string): LiteratureResult[] {
  return matchAll(xml, /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g).map(
    (article) => {
      const pmid = xmlText(article, /<PMID[^>]*>([\s\S]*?)<\/PMID>/);
      const title = xmlText(
        article,
        /<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/,
      );
      const abstract = matchAll(
        article,
        /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g,
      )
        .map(stripXml)
        .join(" ");
      const authorNames = matchAll(
        article,
        /<Author[^>]*>([\s\S]*?)<\/Author>/g,
      )
        .map((author) =>
          [
            xmlText(author, /<ForeName>([\s\S]*?)<\/ForeName>/),
            xmlText(author, /<LastName>([\s\S]*?)<\/LastName>/),
          ]
            .filter(Boolean)
            .join(" "),
        )
        .filter(Boolean);
      const doi =
        matchAll(article, /<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/g)[0]
          ? stripXml(
              matchAll(
                article,
                /<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/g,
              )[0],
            )
          : "";
      const signalText = `${title} ${abstract}`.toLowerCase();
      const isCase =
        /case report|case series|adverse|angioedema|bleed|hemorrhage|death/.test(
          signalText,
        );

      return {
        pmid,
        title,
        authors: authorNames.slice(0, 6).join(", "),
        journal: xmlText(article, /<Title>([\s\S]*?)<\/Title>/),
        published:
          xmlText(article, /<PubDate>([\s\S]*?)<\/PubDate>/) ||
          xmlText(article, /<DateCompleted>([\s\S]*?)<\/DateCompleted>/),
        doi,
        abstract: abstract || "PubMed에 초록이 제공되지 않았습니다.",
        sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        monitor,
        priority: isCase ? "중간" : "낮음",
        tag: isCase ? "ICSR 검토" : "근거 검토",
      };
    },
  );
}

async function fetchFdaRecalls(
  monitor: Monitor,
  period: ReturnType<typeof currentSeoulWeek>,
): Promise<RegulatoryResult[]> {
  if (!monitor.regions.split(",").includes("US")) return [];
  const start = period.periodStart.replaceAll("-", "");
  const end = period.periodEnd.replaceAll("-", "");
  const query = `openfda.generic_name:"${monitor.ingredient}" AND report_date:[${start} TO ${end}]`;
  const url = new URL("https://api.fda.gov/drug/enforcement.json");
  url.search = new URLSearchParams({ search: query, limit: "20" }).toString();
  const response = await fetchWithRetry(
    url,
    { headers: { accept: "application/json" } },
    "FDA 규제정보 검색",
  );
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`FDA 규제정보 검색 실패 (${response.status})`);
  }
  const body = (await response.json()) as {
    results?: Array<Record<string, unknown>>;
  };
  return (body.results ?? []).map((item) => ({
    source: "FDA Recall Enforcement",
    title: String(item.product_description ?? "의약품 회수 정보"),
    date: String(item.report_date ?? ""),
    description: String(item.reason_for_recall ?? ""),
    sourceUrl: `https://api.fda.gov/drug/enforcement.json?search=${encodeURIComponent(`recall_number:"${String(item.recall_number ?? "")}"`)}`,
    monitor: monitor.ingredient,
  }));
}

export async function runScheduledMonitoring(
  env: MonitoringEnv,
  scheduledTime = Date.now(),
) {
  const cutoff = new Date(scheduledTime - RUN_TIMEOUT_MS).toISOString();
  await env.DB.prepare(
    `UPDATE monitoring_runs
     SET status = 'failed', stage = '제한 시간 초과',
         error_message = '리포트 생성 제한 시간 90분을 초과했습니다.',
         completed_at = ?
     WHERE status IN ('queued', 'running')
       AND unixepoch(COALESCE(last_activity_at, started_at, created_at))
         < unixepoch(?)`,
  )
    .bind(new Date(scheduledTime).toISOString(), cutoff)
    .run();

  const due = await env.DB.prepare(
    `SELECT id, frequency, weekday, time_of_day AS timeOfDay
     FROM scheduled_runs
     WHERE active = 1 AND status = 'pending' AND execute_at <= ?
     ORDER BY execute_at, id LIMIT 20`,
  )
    .bind(new Date(scheduledTime).toISOString())
    .all<{
      id: number;
      frequency: "once" | "daily" | "weekly";
      weekday: number | null;
      timeOfDay: string;
    }>();

  for (const schedule of due.results ?? []) {
    const claimed = await env.DB.prepare(
      `UPDATE scheduled_runs SET status = 'dispatching'
       WHERE id = ? AND status = 'pending'`,
    )
      .bind(schedule.id)
      .run();
    if (Number(claimed.meta.changes ?? 0) !== 1) continue;

    try {
      const run = await startSystemRun(env, "scheduled");
      if (schedule.frequency === "once") {
        await env.DB.prepare(
          `UPDATE scheduled_runs
           SET status = 'triggered', active = 0, run_id = ?, last_run_at = ?
           WHERE id = ?`,
        )
          .bind(run.id, new Date(scheduledTime).toISOString(), schedule.id)
          .run();
      } else {
        const nextExecuteAt = nextScheduleOccurrence(
          schedule.frequency,
          schedule.timeOfDay,
          schedule.weekday,
          new Date(scheduledTime),
        );
        await env.DB.prepare(
          `UPDATE scheduled_runs
           SET status = 'pending', run_id = ?, last_run_at = ?,
               execute_at = ?, error_message = NULL
           WHERE id = ?`,
        )
          .bind(
            run.id,
            new Date(scheduledTime).toISOString(),
            nextExecuteAt,
            schedule.id,
          )
          .run();
      }
    } catch (error) {
      await env.DB.prepare(
        `UPDATE scheduled_runs SET status = 'failed', error_message = ?
         WHERE id = ?`,
      )
        .bind(errorMessage(error), schedule.id)
        .run();
    }
  }

}

export async function runMonitoringHeartbeat(
  env: MonitoringEnv,
  scheduledTime = Date.now(),
) {
  await runScheduledMonitoring(env, scheduledTime);
  await resumeActiveMonitoringRun(env);
}

async function startSystemRun(
  env: MonitoringEnv,
  triggerType: "scheduled" | "scheduled_test",
) {
  const request = new Request("https://internal/api/monitoring-runs", {
    method: "POST",
    headers: { [USER_EMAIL_HEADER]: "site-scheduler@vigilance-weekly" },
  });
  const response = await startMonitoringRun(request, env);
  const payload = (await response.json()) as {
    run?: { id: number };
    error?: string;
  };
  if (!response.ok || !payload.run) {
    throw new Error(payload.error ?? "예약 실행을 시작하지 못했습니다.");
  }
  await env.DB.prepare(
    "UPDATE monitoring_runs SET trigger_type = ? WHERE id = ?",
  )
    .bind(triggerType, payload.run.id)
    .run();
  return payload.run;
}

async function fetchWithRetry(
  input: URL,
  init: RequestInit,
  label: string,
): Promise<Response> {
  const maxAttempts = 4;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await waitForRequestSlot(input.hostname);
      const response = await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const retryable =
        response.status === 408 ||
        response.status === 425 ||
        response.status === 429 ||
        response.status >= 500;
      if (!retryable || attempt === maxAttempts) return response;

      const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
      await delay(
        retryAfter !== null
          ? Math.min(retryAfter, MAX_RETRY_AFTER_MS)
          : retryDelay(attempt),
      );
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      await delay(retryDelay(attempt));
    }
  }

  throw new Error(`${label} 네트워크 오류: ${errorMessage(lastError)}`);
}

async function waitForRequestSlot(hostname: string) {
  const now = Date.now();
  const slotAt = Math.max(now, nextRequestAtByHost.get(hostname) ?? 0);
  const jitter = Math.floor(Math.random() * (MAX_REQUEST_JITTER_MS + 1));
  nextRequestAtByHost.set(
    hostname,
    slotAt + MIN_REQUEST_INTERVAL_MS + jitter,
  );
  const waitMs = slotAt - now;
  if (waitMs > 0) await delay(waitMs);
}

function retryDelay(attempt: number) {
  const exponential = 2000 * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * (MAX_REQUEST_JITTER_MS + 1));
  return Math.min(exponential + jitter, MAX_RETRY_AFTER_MS);
}

function parseRetryAfter(value: string | null) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.max(0, date - Date.now());
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "알 수 없는 수집 오류";
}

function percent(completed: number, total: number) {
  return Math.min(95, Math.round((completed / Math.max(total, 1)) * 100));
}

function currentSeoulWeek(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const today = new Date(value("year"), value("month") - 1, value("day"));
  const weekday = today.getDay() || 7;
  const periodStart = new Date(today);
  periodStart.setDate(periodStart.getDate() - weekday + 1);
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 6);
  const thursday = new Date(periodStart);
  thursday.setDate(thursday.getDate() + 3);
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86400000 +
      yearStart.getDay() +
      1) /
      7,
  );
  return {
    weekKey: `${thursday.getFullYear()}-W${String(week).padStart(2, "0")}`,
    periodStart: formatDate(periodStart),
    periodEnd: formatDate(periodEnd),
  };
}

function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function reportLabel(weekKey: string, sequence: number) {
  const [year, week] = weekKey.split("-W");
  return `${year}년 ${Number(week)}주차${sequence > 1 ? ` (${sequence})` : ""}`;
}

function matchAll(value: string, expression: RegExp) {
  return Array.from(value.matchAll(expression), (match) => match[1] ?? "");
}

function xmlText(value: string, expression: RegExp) {
  return stripXml(value.match(expression)?.[1] ?? "");
}

function stripXml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}
