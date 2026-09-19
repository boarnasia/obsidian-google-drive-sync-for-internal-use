import type { Strings } from "./en";

export const ko: Strings = {
  // ------------------------------------------------------------------ 全般
  notice: (msg) => `Google Drive Sync: ${msg}`,
  ribbonSyncNow: "Google Drive Sync: 지금 동기화",
  cmdSyncNow: "지금 동기화",
  syncAlreadyRunning: "이미 동기화가 진행 중입니다…",
  syncSummary: (up, down, del, conflicts) => `↑${up} ↓${down} ✗${del} ⚠${conflicts}`,
  syncErrorCount: (n) => ` — 오류 ${n}건`,
  syncDeferred: (n) => ` — 삭제 ${n}건 보류`,
  relWords: {
    justNow: "방금",
    minutes: (n: number) => `${n}분 전`,
    hours: (n: number) => `${n}시간 전`,
    days: (n: number) => `${n}일 전`,
  },

  generalHeading: "일반",
  languageName: "언어",
  languageDesc:
    "'자동'은 Obsidian의 표시 언어(설정 → 정보 → 언어)를 따릅니다. 명령과 리본 이름은 다음에 다시 불러올 때 반영됩니다.",
  languageAliases: ["언어", "language"],
  languageAuto: "자동 (Obsidian에 맞춤)",

  // --------------------------------------------------------- OAuth クライアント
  oauthHeading: "Google OAuth 클라이언트",
  oauthSetupRequired: "설정 필요",
  oauthSetupDesc:
    "이 플러그인에는 자체 인증 정보가 포함되어 있지 않습니다. 담당자에게 조직의 클라이언트 ID와 보안 비밀을 요청하거나, 한 번만 직접 만드세요: ",
  oauthStep1: "Google Cloud Console의 사용자 인증 정보 페이지를 열고 프로젝트를 선택(또는 생성)합니다.",
  oauthStep2: "'Google Drive API'를 사용 설정합니다.",
  oauthStep3: "OAuth 동의 화면의 사용자 유형을 '내부'로 설정합니다.",
  oauthStep4: "사용자 인증 정보 만들기 → OAuth 클라이언트 ID → 애플리케이션 유형 '데스크톱 앱'.",
  oauthClientIdName: "OAuth 클라이언트 ID",
  oauthClientIdDesc: "조직의 Google Cloud OAuth 클라이언트의 클라이언트 ID입니다.",
  oauthClientIdAliases: ["google", "인증", "로그인", "credentials", "login"],
  oauthClientSecretName: "OAuth 클라이언트 보안 비밀",
  oauthClientSecretDesc:
    "Google '데스크톱 앱' 클라이언트에 필요합니다. 이 보관소의 플러그인 데이터에만 저장되며 동기화되지 않습니다.",

  // -------------------------------------------------------------------- 同期先
  targetHeading: "동기화 대상",
  rowConnection: "연결 상태",
  connected: "✓ 연결됨.",
  notConnected: "연결되지 않음.",
  btnConnect: "연결",
  btnReconnect: "다시 연결",
  btnDisconnect: "연결 해제",
  connectedNotice: "Google 드라이브에 연결되었습니다.",
  disconnectedNotice: "Google 드라이브 연결이 해제되었습니다.",

  targetUrlName: "폴더 URL",
  targetUrlDesc: "브라우저에서 공유 드라이브 폴더를 열고 주소를 여기에 붙여 넣으세요. 팀원 모두가 같은 폴더를 사용해야 합니다.",
  targetUrlPlaceholder: "https://drive.google.com/drive/folders/…",
  myDriveName: "내 드라이브",
  targetStatusName: "동기화 대상",
  targetNotSet: "설정되지 않았습니다. 위에 폴더 URL을 붙여 넣으세요.",
  targetResolving: "드라이브에서 폴더를 확인하는 중…",
  targetFailed: (reason) => `✗ ${reason}`,
  targetOnSharedDrive: (path) => `공유 드라이브 - ${path}`,
  targetOnMyDrive: (path) => `내 드라이브 - ${path}`,
  targetMyDriveWarning:
    "⚠ 내 드라이브(개인)에 있는 파일은 다른 사람에게 전달되지 않습니다. 팀 동기화에는 공유 드라이브 폴더를 사용하세요.",

  mountName: "로컬 폴더",
  mountDesc:
    "이 보관소의 어느 폴더를 공유 보관소로 쓸지 지정합니다. 그 내용이 대상 폴더의 내용과 대응됩니다. 폴더 이름 자체는 드라이브에 나타나지 않으므로 각자 다른 이름을 써도 됩니다. 비워 두면 보관소 전체입니다.",
  mountPlaceholder: "(보관소 전체)",
  mountMapping: (local) => `${local}/ ⇄ 대상 폴더`,
  mountMappingWholeVault: "보관소 전체 ⇄ 대상 폴더",

  // -------------------------------------------------------------------- 同期
  syncHeading: "동기화",
  syncNowName: "지금 동기화",
  syncNowDescNever: "마지막 동기화: 없음",
  syncNowDesc: (rel, abs) => `마지막 동기화: ${rel} (${abs})`,
  autoSyncName: "자동 동기화",
  autoSyncDesc: "내 변경 사항은 바로 업로드하고, 다른 사람의 변경 사항은 일정 간격으로 가져옵니다.",
  pollName: "변경 사항 확인 간격",
  pollDesc: "다른 사람의 변경 사항을 확인하는 간격(분)입니다. 변경이 없으면 가벼운 요청 한 번으로 끝납니다.",
  pollUnit: "분",
  pollInvalid: "1 이상의 정수(분)를 입력하세요.",

  // ---------------------------------------------------------- 利用者に出る失敗
  errNoOauthClient: "OAuth 클라이언트가 설정되지 않았습니다. 설정에서 클라이언트 ID와 보안 비밀을 입력한 뒤 연결하세요.",
  errNoRefreshToken:
    "갱신 토큰이 반환되지 않았습니다. myaccount.google.com에서 이 앱의 액세스 권한을 취소한 뒤 다시 연결하세요.",
  errNotConnected: "먼저 Google 드라이브에 연결하세요.",
  errNoTarget: "동기화 대상이 설정되지 않았습니다. 설정에서 폴더 URL을 붙여 넣으세요.",
  errTargetEmpty: "폴더의 URL(또는 ID)을 붙여 넣으세요.",
  errTargetNotFound: "폴더를 찾을 수 없거나 이 계정으로는 볼 수 없습니다.",
  errTargetForbidden: "이 계정에는 해당 폴더를 열 권한이 없습니다.",
  errTargetNotFolder: "이 링크는 폴더가 아닌 파일을 가리킵니다. 폴더 자체를 열고 주소를 복사하세요.",
  errEmptyPath: "경로가 비어 있습니다",
  errOutsideMount: (path) => `동기화 폴더 밖의 경로는 건드리지 않습니다: ${path}`,
  errLocalMissing: (path) => `로컬 파일이 없습니다: ${path}`,
};
