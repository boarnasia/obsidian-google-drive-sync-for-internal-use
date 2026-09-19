import type { Strings } from "./en";

export const de: Strings = {
  // ------------------------------------------------------------------ 全般
  notice: (msg) => `Google Drive Sync: ${msg}`,
  ribbonSyncNow: "Google Drive Sync: jetzt synchronisieren",
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

  mountName: "Lokaler Ordner",
  mountDesc:
    "Welcher Ordner dieses Tresors der gemeinsame Tresor ist. Sein Inhalt entspricht dem Inhalt des Zielordners – der Ordnername selbst erscheint nie in Drive, daher kann jede Person ihn anders nennen. Leer = der ganze Tresor.",
  mountPlaceholder: "(ganzer Tresor)",
  mountMapping: (local) => `${local}/ ⇄ Zielordner`,
  mountMappingWholeVault: "ganzer Tresor ⇄ Zielordner",

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
