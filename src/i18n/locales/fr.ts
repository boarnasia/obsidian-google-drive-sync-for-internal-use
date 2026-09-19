import type { Strings } from "./en";

export const fr: Strings = {
  // ------------------------------------------------------------------ 全般
  notice: (msg) => `Google Drive Sync : ${msg}`,
  ribbonSyncNow: "Google Drive Sync : synchroniser maintenant",
  cmdSyncNow: "Synchroniser maintenant",
  syncAlreadyRunning: "une synchronisation est déjà en cours…",
  syncSummary: (up, down, del, conflicts) => `↑${up} ↓${down} ✗${del} ⚠${conflicts}`,
  syncErrorCount: (n) => ` — ${n} erreur(s)`,
  syncDeferred: (n) => ` — ${n} suppression(s) en attente`,
  relWords: {
    justNow: "à l’instant",
    minutes: (n: number) => `il y a ${n} minute${n === 1 ? "" : "s"}`,
    hours: (n: number) => `il y a ${n} heure${n === 1 ? "" : "s"}`,
    days: (n: number) => `il y a ${n} jour${n === 1 ? "" : "s"}`,
  },

  generalHeading: "Général",
  languageName: "Langue",
  languageDesc:
    "Automatique suit la langue d’affichage d’Obsidian (Paramètres → À propos → Langue). Les noms des commandes et du ruban changent au prochain rechargement.",
  languageAliases: ["langue", "language"],
  languageAuto: "Automatique (comme Obsidian)",

  // --------------------------------------------------------- OAuth クライアント
  oauthHeading: "Client OAuth Google",
  oauthSetupRequired: "Configuration requise",
  oauthSetupDesc:
    "Ce plugin n’embarque aucun identifiant. Demandez l’ID client et le secret de votre organisation à la personne qui l’a configuré, ou créez-en un une fois : ",
  oauthStep1: "Ouvrez la page Identifiants de Google Cloud Console et choisissez (ou créez) un projet.",
  oauthStep2: "Activez « Google Drive API ».",
  oauthStep3: "Sur l’écran de consentement OAuth, réglez le type d’utilisateur sur « Interne ».",
  oauthStep4: "Créer des identifiants → ID client OAuth → type d’application « Application de bureau ».",
  oauthClientIdName: "ID client OAuth",
  oauthClientIdDesc: "L’ID du client OAuth Google Cloud de votre organisation.",
  oauthClientIdAliases: ["google", "identifiants", "connexion", "credentials", "login"],
  oauthClientSecretName: "Secret client OAuth",
  oauthClientSecretDesc:
    "Obligatoire pour les clients Google « Application de bureau ». Stocké uniquement dans les données du plugin de ce coffre, qui ne sont jamais synchronisées.",

  // -------------------------------------------------------------------- 同期先
  targetHeading: "Cible de synchronisation",
  rowConnection: "Connexion",
  connected: "✓ Connecté.",
  notConnected: "Non connecté.",
  btnConnect: "Se connecter",
  btnReconnect: "Se reconnecter",
  btnDisconnect: "Se déconnecter",
  connectedNotice: "connecté à Google Drive.",
  disconnectedNotice: "déconnecté de Google Drive.",

  targetUrlName: "URL du dossier",
  targetUrlDesc:
    "Ouvrez le dossier du Drive partagé dans votre navigateur et collez son adresse ici. Toute l’équipe doit utiliser le même dossier.",
  targetUrlPlaceholder: "https://drive.google.com/drive/folders/…",
  myDriveName: "Mon Drive",
  targetStatusName: "Cible",
  targetNotSet: "Non défini. Collez l’URL du dossier ci-dessus.",
  targetResolving: "Recherche du dossier dans Drive…",
  targetFailed: (reason) => `✗ ${reason}`,
  targetOnSharedDrive: (path) => `Drive partagé - ${path}`,
  targetOnMyDrive: (path) => `Mon Drive - ${path}`,
  targetMyDriveWarning:
    "⚠ Les fichiers de Mon Drive (personnel) ne parviennent à personne d’autre. Utilisez un dossier d’un Drive partagé pour synchroniser en équipe.",

  mountName: "Dossier local",
  mountDesc:
    "Le dossier de ce coffre qui sert de coffre partagé. Son contenu correspond à celui du dossier cible ; le nom du dossier n’apparaît jamais sur Drive, chacun peut donc le nommer différemment. Vide = tout le coffre.",
  mountPlaceholder: "(tout le coffre)",
  mountMapping: (local) => `${local}/ ⇄ le dossier cible`,
  mountMappingWholeVault: "tout le coffre ⇄ le dossier cible",

  // -------------------------------------------------------------------- 同期
  syncHeading: "Synchronisation",
  syncNowName: "Synchroniser maintenant",
  syncNowDescNever: "Dernière synchronisation : jamais",
  syncNowDesc: (rel, abs) => `Dernière synchronisation : ${rel} (${abs})`,
  autoSyncName: "Synchronisation automatique",
  autoSyncDesc: "Envoie vos modifications au fil de l’eau et récupère celles des autres à intervalle régulier.",
  pollName: "Vérifier les changements toutes les",
  pollDesc:
    "Minutes entre deux vérifications des changements des autres. Sans changement, une vérification n’est qu’une requête légère.",
  pollUnit: "min",
  pollInvalid: "Saisissez un nombre entier de minutes, 1 ou plus.",

  // ---------------------------------------------------------- 利用者に出る失敗
  errNoOauthClient:
    "Aucun client OAuth configuré — saisissez l’ID client et le secret dans les paramètres, puis connectez-vous.",
  errNoRefreshToken:
    "Aucun jeton d’actualisation reçu — révoquez l’accès de l’application sur myaccount.google.com et reconnectez-vous.",
  errNotConnected: "Connectez-vous d’abord à Google Drive.",
  errNoTarget: "Aucune cible de synchronisation — collez l’URL du dossier dans les paramètres.",
  errTargetEmpty: "Collez l’URL du dossier (ou son ID).",
  errTargetNotFound: "Dossier introuvable, ou ce compte ne peut pas le voir.",
  errTargetForbidden: "Ce compte n’est pas autorisé à ouvrir ce dossier.",
  errTargetNotFolder: "Ce lien pointe vers un fichier, pas un dossier. Ouvrez le dossier lui-même et copiez son adresse.",
  errEmptyPath: "chemin vide",
  errOutsideMount: (path) => `refus de toucher un chemin hors du dossier synchronisé : ${path}`,
  errLocalMissing: (path) => `le fichier local n’existe plus : ${path}`,
};
