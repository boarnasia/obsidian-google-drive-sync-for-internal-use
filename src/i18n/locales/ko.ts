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
  targetUrlDesc:
    "브라우저에서 공유 드라이브 폴더를 열고 주소를 여기에 붙여 넣으세요. 팀원 모두가 같은 폴더를 사용해야 합니다.",
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

  // ------------------------------------------------------------ 同期管理パネル
  panelTitle: "동기화 관리",
  panelOpen: "동기화 관리 열기",
  panelNeedsConnection: "연결되지 않았습니다. 먼저 플러그인 설정에서 Google 드라이브에 연결하세요.",
  panelNeedsTarget: "동기화 대상이 없습니다. 플러그인 설정에서 폴더 URL을 붙여 넣으세요.",
  panelChecking: "변경 사항을 확인하는 중…",
  panelReady: "✓ 동기화할 수 있습니다.",
  panelBlocked: "⚠ 업로드를 중단했습니다.",
  reasonNoBaseline:
    '이 보관소는 아직 Drive에서 가져오지 않았고, 양쪽 모두에 파일이 있습니다. 먼저 "Drive에서 가져오기"를 실행하세요.',
  reasonVaultEmpty:
    '원격과 로컬의 차이가 큽니다. Drive에는 남아 있는 많은 파일이 로컬에서 삭제되었습니다. 아래에서 Drive의 파일을 삭제하거나, "Drive에서 가져오기"로 파일을 되돌리세요.',
  reasonDeleteGuard:
    '이번 동기화는 안전 한도를 넘는 수의 파일을 삭제하려고 합니다. 아래 목록을 확인하거나, "Drive에서 가져오기"로 원격 내용을 되돌리세요.',
  panelActions: "작업",
  btnClone: "Drive에서 가져오기",
  btnRefresh: "상태 확인",
  tipSyncNow: "내 변경 사항을 Drive로 보내고, 다른 사람의 변경 사항을 여기로 가져옵니다.",
  tipClone: "Drive의 내용을 여기에 재현합니다. 로컬 파일은 지우지 않습니다. Drive에 없는 파일은 아래에 나열됩니다.",
  tipRefresh: "차이를 다시 셉니다. 업로드도 다운로드도 삭제도 하지 않습니다.",
  panelPause: "동기화 일시 중지",
  panelPauseDesc: "동기화는 스스로 돌아갑니다. 중지하면 스스로 돌지 않습니다. '지금 동기화'는 그대로 씁니다.",
  panelPausedDesc: "중지됨: 스스로 동기화하지 않습니다. '지금 동기화'는 그대로 씁니다.",
  panelLastSynced: (rel) => `마지막 동기화: ${rel}`,
  panelCheckedAt: (rel) => `확인: ${rel}`,
  panelHeldDeletes: (n) => `보류된 삭제 (${n}건)`,
  panelHeldDeletesDesc:
    "승인하기 전에는 아무것도 삭제하지 않습니다. 승인한 파일은 휴지통으로 갑니다. Drive 휴지통은 30일 후 자동으로 비워지며, 그 뒤 25일간은 관리자가 복원할 수 있습니다.",
  btnSelectAll: "모두 선택",
  btnApproveDeletes: (n) => `선택한 ${n}건 삭제`,
  tipSelectAll: "위 목록의 파일을 모두 선택합니다.",
  tipApproveDeletes: "선택한 파일을 삭제하고 이번 동기화를 끝냅니다.",
  panelChanges: "변경 사항",
  panelUpload: "업로드",
  panelDownload: "다운로드",
  panelConflict: "충돌",
  panelLocalOnly: "로컬 전용",
  panelNoChanges: "동기화할 항목이 없습니다.",
  panelMore: (n) => `…외 ${n}건`,
  cloneDone: (down, conflicts, localOnly) =>
    `clone 완료 — ↓${down}, 충돌 사본 ${conflicts}건, 로컬 전용 ${localOnly}건`,

  // ------------------------------------------------ ローカル固有ファイルの分類
  localIgnoreTitle: "나만의 제외 규칙",
  localIgnoreBody:
    "여기에 쓴 규칙은 내 보관소에만 적용되며, 이 파일은 동기화되지 않습니다. 문법은 _Sync/ignore.md와 같습니다. #은 주석, * ? **는 글롭, 앞의 /는 동기화 루트 고정, 뒤의 /는 폴더, !는 해제입니다.",
  panelUnsorted: (n) => `아직 결정하지 않음 (${n}건)`,
  panelLocalOnlyDesc: "Drive에 없는 파일입니다. 결정할 때까지 여기에 남고, 올라가지 않습니다.",
  btnShare: "공유",
  btnTrash: "삭제",
  btnShareAll: (n) => `${n}건 모두 공유`,
  btnTrashAll: (n) => `${n}건 모두 삭제`,
  tipShare: "이 파일을 Drive에 올립니다. 팀에 전달됩니다.",
  tipTrash: "이 파일을 휴지통으로 보냅니다. Drive는 건드리지 않습니다. 원래 Drive에 없는 파일입니다.",
  tipShareAll: "목록의 파일을 모두 Drive에 올립니다.",
  tipTrashAll: "목록의 파일을 모두 휴지통으로 보냅니다.",
  confirmTrashTitle: "이 파일들을 삭제할까요?",
  confirmTrashBody: (n) => `${n}건을 휴지통으로 보냅니다. Drive에 없는 파일이라 이것이 유일한 사본입니다. 휴지통에서는 되돌릴 수 있습니다.`,
  btnCancel: "취소",
  sharedDone: (n) => `${n}건을 공유했습니다`,
  trashedDone: (n) => `${n}건을 휴지통으로 보냈습니다`,

  // ---------------------------------------------------------- 利用者に出る失敗
  errNoOauthClient:
    "OAuth 클라이언트가 설정되지 않았습니다. 설정에서 클라이언트 ID와 보안 비밀을 입력한 뒤 연결하세요.",
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
