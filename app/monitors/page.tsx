import Link from "next/link";
import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import MonitorManager from "./MonitorManager";

export const dynamic = "force-dynamic";

export default async function MonitorsPage() {
  const user = await requireChatGPTUser("/monitors");

  return (
    <div className="managerShell">
      <header className="topbar">
        <Link href="/" className="brand"><span className="brandMark">V</span><span>Vigilance Weekly</span></Link>
        <Link className="loginButton" href="/">공개 리포트 보기</Link>
      </header>
      <main className="managerMain">
        <div className="managerHeader">
          <div>
            <p className="eyebrow">MONITORING TARGETS</p>
            <h1>감시 대상 관리</h1>
            <p>매주 검색할 의약품과 지역을 등록하세요.</p>
          </div>
          <div className="userChip">
            <strong>{user.displayName}</strong>
            <small>{user.email}</small>
            <Link href={chatGPTSignOutPath("/")}>로그아웃</Link>
          </div>
        </div>
        <MonitorManager />
      </main>
    </div>
  );
}
