import type { Strings } from "./en";

export const de: Strings = {
  // ------------------------------------------------------------------ 全般
  notice: (msg) => `Team Drive Sync: ${msg}`,
  ribbonSyncNow: "Team Drive Sync: jetzt synchronisieren",
  cmdSyncNow: "Jetzt synchronisieren",
  syncAlreadyRunning: "es läuft bereits eine Synchronisierung…",
  syncSummary: (up, down, del, conflicts) => `↑${up} ↓${down} ✗${del} ⚠${conflicts}`,
  syncErrorCount: (n) => ` — ${n} Fehler`,
  syncDeferred: (n) => ` — ${n} Löschung(en) zurückgehalten`,
  relWords: {
    justNow: "gerade eben",
    minutes: (n: number) => `vor ${n} Minute${n === 1 ? "" : "n"}`,
    hours: (n: number) => `vor ${n} Stunde${n === 1 ? "" : "n"}`,
    days: (n: number) => `vor ${n} Tag${n === 1 ? "" : "en"}`,
  },

  generalHeading: "Allgemein",
  languageName: "Sprache",
  languageDesc:
    "Automatisch folgt der Anzeigesprache von Obsidian (Einstellungen → Über → Sprache). Befehls- und Menübandnamen ändern sich beim nächsten Neuladen.",
  languageAliases: ["sprache", "language"],
  languageAuto: "Automatisch (wie Obsidian)",

  // --------------------------------------------------------- OAuth クライアント
  oauthHeading: "Google-OAuth-Client",
  oauthSetupRequired: "Einrichtung erforderlich",
  oauthSetupDesc:
    "Dieses Plugin bringt keine eigenen Zugangsdaten mit. Frage die zuständige Person nach Client-ID und Secret deiner Organisation oder lege einmalig selbst einen an: ",
  oauthStep1: "Öffne in der Google Cloud Console die Seite „Anmeldedaten“ und wähle (oder erstelle) ein Projekt.",
  oauthStep2: "Aktiviere die „Google Drive API“.",
  oauthStep3: "Setze den Nutzertyp des OAuth-Zustimmungsbildschirms auf „Intern“.",
  oauthStep4: "Anmeldedaten erstellen → OAuth-Client-ID → Anwendungstyp „Desktop-App“.",
  oauthClientIdName: "OAuth-Client-ID",
  oauthClientIdDesc: "Die Client-ID des Google-Cloud-OAuth-Clients deiner Organisation.",
  oauthClientIdAliases: ["google", "anmeldedaten", "anmelden", "credentials", "login"],
  oauthClientSecretName: "OAuth-Clientschlüssel",
  oauthClientSecretDesc:
    "Für Google-Clients vom Typ „Desktop-App“ erforderlich. Wird nur in den Plugin-Daten dieses Tresors gespeichert, die nie synchronisiert werden.",

  // -------------------------------------------------------------------- 同期先
  targetHeading: "Synchronisierungsziel",
  rowConnection: "Verbindung",
  connected: "✓ Verbunden.",
  notConnected: "Nicht verbunden.",
  btnConnect: "Verbinden",
  btnReconnect: "Neu verbinden",
  btnDisconnect: "Trennen",
  connectedNotice: "mit Google Drive verbunden.",
  disconnectedNotice: "von Google Drive getrennt.",

  targetUrlName: "Ordner-URL",
  targetUrlDesc:
    "Öffne den Ordner der geteilten Ablage im Browser und füge seine Adresse hier ein. Das ganze Team muss denselben Ordner verwenden.",
  targetUrlPlaceholder: "https://drive.google.com/drive/folders/…",
  myDriveName: "Meine Ablage",
  targetStatusName: "Ziel",
  targetNotSet: "Nicht festgelegt. Füge oben die Ordner-URL ein.",
  targetResolving: "Ordner wird in Drive gesucht…",
  targetFailed: (reason) => `✗ ${reason}`,
  targetOnSharedDrive: (path) => `Geteilte Ablage - ${path}`,
  targetOnMyDrive: (path) => `Meine Ablage - ${path}`,
  targetMyDriveWarning:
    "⚠ Dateien in „Meine Ablage“ (persönlich) erreichen niemanden sonst. Verwende für die Team-Synchronisierung einen Ordner in einer geteilten Ablage.",

  // -------------------------------------------------------------------- 同期
  syncHeading: "Synchronisierung",
  syncNowName: "Jetzt synchronisieren",
  syncNowDescNever: "Zuletzt synchronisiert: nie",
  syncNowDesc: (rel, abs) => `Zuletzt synchronisiert: ${rel} (${abs})`,
  autoSyncName: "Automatische Synchronisierung",
  autoSyncDesc: "Lädt deine Änderungen sofort hoch und holt Änderungen anderer in festen Abständen ab.",
  pollName: "Auf Änderungen prüfen alle",
  pollDesc:
    "Minuten zwischen den Prüfungen auf Änderungen anderer. Ohne Änderungen ist eine Prüfung nur eine einzige leichte Anfrage.",
  pollUnit: "Minuten",
  pollInvalid: "Gib eine ganze Zahl von Minuten ein, mindestens 1.",
  syncMovedDesc: "Die Aktionen und Einstellungen zur Synchronisierung stehen im Sync-Manager in der rechten Seitenleiste.",

  // ------------------------------------------------------------ 同期管理パネル
  panelTitle: "Synchronisierungsverwaltung",
  panelOpen: "Synchronisierungsverwaltung öffnen",
  panelNeedsConnection: "Nicht verbunden. Verbinde dich zuerst in den Plugin-Einstellungen mit Google Drive.",
  panelNeedsTarget: "Noch kein Synchronisierungsziel. Füge die Ordner-URL in den Plugin-Einstellungen ein.",
  panelChecking: "Änderungen werden geprüft…",
  panelReady: "✓ Bereit zum Synchronisieren.",
  panelBlocked: "⚠ Uploads sind angehalten.",
  panelSyncFailed: (message) => `✗ Letzte Synchronisierung fehlgeschlagen: ${message}`,
  reasonNoBaseline:
    "Dieser Tresor wurde noch nicht von Drive geholt, und auf beiden Seiten liegen Dateien. Führe zuerst „Von Drive holen“ aus.",
  reasonVaultEmpty:
    "Entfernt und lokal unterscheiden sich stark: Viele Dateien, die Drive noch führt, fehlen lokal. Lösche sie unten auf Drive, oder hole sie mit „Von Drive holen“ zurück.",
  reasonDeleteGuard:
    "Diese Synchronisierung würde mehr Dateien löschen, als das Sicherheitslimit erlaubt. Sieh dir die Liste unten an oder hole die entfernte Kopie mit „Von Drive holen“ zurück.",
  panelActions: "Aktionen",
  btnClone: "Von Drive holen",
  btnRefresh: "Status prüfen",
  tipSyncNow: "Schickt deine Änderungen zu Drive und holt die der anderen hierher.",
  tipClone: "Holt die Drive-Kopie hierher. Lokal wird nichts gelöscht; Dateien, die Drive nicht hat, stehen unten.",
  tipRefresh: "Zählt die Unterschiede neu. Es wird nichts hochgeladen, heruntergeladen oder gelöscht.",
  panelLastSynced: (rel) => `Zuletzt synchronisiert: ${rel}`,
  panelCheckedAt: (rel) => `Geprüft: ${rel}`,
  panelHeldDeletes: (n) => `Zurückgehaltene Löschungen (${n})`,
  panelHeldDeletesDesc:
    "Es wird nichts gelöscht, bis du es bestätigst. Bestätigte Dateien landen im Papierkorb: Drive leert ihn nach 30 Tagen, danach kann ein Administrator sie noch 25 Tage wiederherstellen.",
  btnSelectAll: "Alle auswählen",
  btnApproveDeletes: (n) => `${n} ausgewählte löschen`,
  tipSelectAll: "Wählt alle Dateien aus der Liste oben aus.",
  tipApproveDeletes: "Löscht die ausgewählten Dateien und beendet diese Synchronisierung.",
  panelChanges: "Änderungen",
  panelUpload: "Hochladen",
  panelDownload: "Herunterladen",
  panelConflict: "Konflikt",
  panelDeleteLocal: "Lokal löschen",
  panelDeleteRemote: "In Drive löschen",
  panelLocalOnly: "Nur lokal",
  panelNoChanges: "Nichts zu synchronisieren.",
  panelMore: (n) => `…und ${n} weitere`,
  cloneDone: (down, conflicts, localOnly) =>
    `clone fertig — ↓${down}, ${conflicts} Konfliktkopie(n), ${localOnly} nur lokale Datei(en)`,

  // ------------------------------------------------------------ 失敗の知らせ方
  failNetwork: "Keine Netzwerkverbindung. Die Synchronisierung läuft von selbst weiter, sobald die Verbindung zurück ist. Zum sofortigen Versuch „Status prüfen“ drücken.",
  failServer: "Google Drive antwortet gerade nicht. Die Synchronisierung läuft in Kürze von selbst weiter.",
  failAuth: "Deine Google-Anmeldung ist abgelaufen. Verbinde dich in den Einstellungen neu.",
  failTarget: "Der synchronisierte Ordner lässt sich nicht öffnen. Prüfe, ob er im Papierkorb liegt und ob du noch Zugriff auf die geteilte Ablage hast.",
  failQuota: "Drive hat keinen Speicher mehr, oder das Dateilimit ist erreicht. Wende dich an deine Administration.",
  failDetail: (m) => `Details: ${m}`,
  btnOpenSettings: "Einstellungen öffnen",
  tipOpenSettings: "Plugin-Einstellungen zum Neuverbinden öffnen",
  failRetryIn: (x) => `neuer Versuch in etwa ${x}`,

  // ------------------------------------------------------------ 取り込みの進み具合
  progressTitle: "Import aus Drive",
  progressScan: (n) => `Dateien werden aufgelistet … ${n} in Drive`,
  progressScanLocal: (d, t) => `lokale Prüfung ${d} / ${t}`,
  progressFinishing: "Wird abgeschlossen …",
  progressFiles: (d, t) => `${d} / ${t} Dateien`,
  progressRemaining: (x) => `noch etwa ${x}`,
  durationSeconds: (n) => `${n} s`,
  durationMinutes: (n) => `${n} Min.`,
  progressFailed: (n) => `${n} fehlgeschlagen`,
  btnCancelClone: "Abbrechen",
  tipCancelClone: "Import stoppen. Bereits geladene Dateien bleiben; nichts wird als synchronisiert vermerkt.",
  cloneAborted: (n) => `Import abgebrochen – ${n} bereits geladene Datei(en) bleiben hier`,
  statusBarClone: (p) => `Import ${p} %`,
  statusBarScan: "Import läuft …",

  // ------------------------------------------------------------ 設定ファイル
  panelConfigFiles: "Konfigurationsdateien",
  panelIgnoreDesc:
    "Die Ausschlussregeln des Teams stehen in .tds-ignore oben im synchronisierten Ordner. Obsidian zeigt Dateien mit führendem Punkt nicht an, öffne sie daher in einem Texteditor.",
  btnOpenFile: "Öffnen",
  tipOpenFile: "Im Texteditor öffnen",
  btnCopyPath: "Pfad kopieren",
  tipCopyPath: "Vollständigen Pfad in die Zwischenablage kopieren",
  pathCopied: (p) => `kopiert: ${p}`,
  errOpenFailed: (m) => `Datei konnte nicht geöffnet werden: ${m}`,

  // ------------------------------------------------------------ 版の目印
  panelVersionBehind: (mine, team) =>
    `Dieses Plugin ist veraltet (deins ${mine}, Team ${team}). Die Synchronisierung pausiert bis zum Update.`,
  panelVersionBehindDesc: "Aktualisiere das Plugin mit BRAT. Sobald die Versionen übereinstimmen, geht die Synchronisierung weiter.",
  btnUpdateViaBrat: "Mit BRAT aktualisieren",
  tipUpdateViaBrat: "BRAT-Befehl zum Suchen und Installieren von Updates ausführen",
  errVersionBehind: (mine, team) =>
    `dieses Plugin (${mine}) ist älter als das des Teams (${team}); zum Synchronisieren aktualisieren`,

  // ------------------------------------------------ ローカル固有ファイルの分類
  panelUnsorted: (n) => `Noch nicht entschieden (${n})`,
  panelLocalOnlyDesc: "Drive hat diese Dateien nicht. Jede bleibt hier und wird nicht hochgeladen, bis du entscheidest.",
  btnShare: "Teilen",
  btnTrash: "Löschen",
  btnShareAll: (n) => `Alle ${n} teilen`,
  btnTrashAll: (n) => `Alle ${n} löschen`,
  tipShare: "Lädt diese Datei zu Drive hoch, damit das Team sie bekommt.",
  tipTrash: "Verschiebt diese Datei in den Papierkorb. Drive bleibt unberührt — dort gab es diese Datei nie.",
  tipShareAll: "Lädt alle Dateien der Liste zu Drive hoch.",
  tipTrashAll: "Verschiebt alle Dateien der Liste in den Papierkorb.",
  confirmTrashTitle: "Diese Dateien löschen?",
  confirmTrashBody: (n) => `${n} Datei(en) wandern in den Papierkorb. Sie liegen nicht auf Drive, das hier ist also die einzige Kopie — aus dem Papierkorb kannst du sie noch zurückholen.`,
  btnCancel: "Abbrechen",
  sharedDone: (n) => `${n} Datei(en) geteilt`,
  trashedDone: (n) => `${n} Datei(en) in den Papierkorb verschoben`,

  // ---------------------------------------------------------- 利用者に出る失敗
  errNoOauthClient:
    "Kein OAuth-Client eingerichtet – gib Client-ID und Secret in den Einstellungen ein und verbinde dich dann.",
  errNoRefreshToken:
    "Kein Aktualisierungstoken erhalten – entziehe der App auf myaccount.google.com den Zugriff und verbinde dich erneut.",
  errNotConnected: "Verbinde dich zuerst mit Google Drive.",
  errNoTarget: "Kein Synchronisierungsziel festgelegt – füge die Ordner-URL in den Einstellungen ein.",
  errTargetEmpty: "Füge die URL des Ordners (oder seine ID) ein.",
  errTargetNotFound: "Der Ordner wurde nicht gefunden, oder dieses Konto kann ihn nicht sehen.",
  errTargetForbidden: "Dieses Konto darf diesen Ordner nicht öffnen.",
  errTargetNotFolder:
    "Dieser Link verweist auf eine Datei, nicht auf einen Ordner. Öffne den Ordner selbst und kopiere seine Adresse.",
  errEmptyPath: "leerer Pfad",
  errOutsideMount: (path) => `Pfad außerhalb des synchronisierten Ordners wird nicht angetastet: ${path}`,
  errLocalMissing: (path) => `lokale Datei existiert nicht mehr: ${path}`,
};
