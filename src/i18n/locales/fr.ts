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
  syncMovedDesc: "Les actions et les réglages de synchronisation se trouvent dans le gestionnaire, dans la barre latérale droite.",

  // ------------------------------------------------------------ 同期管理パネル
  panelTitle: "Gestion de la synchronisation",
  panelOpen: "Ouvrir la gestion de la synchronisation",
  panelNeedsConnection: "Non connecté. Connectez-vous à Google Drive dans les paramètres du plugin.",
  panelNeedsTarget: "Aucune cible de synchronisation. Collez l’URL du dossier dans les paramètres du plugin.",
  panelChecking: "Vérification des changements…",
  panelReady: "✓ Prêt à synchroniser.",
  panelBlocked: "⚠ Les envois sont suspendus.",
  reasonNoBaseline:
    "Ce coffre n’a pas encore été récupéré depuis Drive et les deux côtés contiennent des fichiers. Lancez d’abord « Récupérer depuis Drive ».",
  reasonVaultEmpty:
    "Le distant et le local diffèrent beaucoup : de nombreux fichiers encore listés sur Drive ont été supprimés en local. Supprimez-les sur Drive depuis la liste ci-dessous, ou lancez « Récupérer depuis Drive » pour les restaurer.",
  reasonDeleteGuard:
    "Cette synchronisation supprimerait plus de fichiers que la limite de sécurité ne l’autorise. Consultez la liste ci-dessous ou lancez « Récupérer depuis Drive » pour restaurer la copie distante.",
  panelActions: "Actions",
  btnClone: "Récupérer depuis Drive",
  btnRefresh: "Voir l’état",
  tipSyncNow: "Envoie vos modifications vers Drive et récupère ici celles des autres.",
  tipClone: "Récupère ici la copie de Drive. Rien n’est supprimé en local ; les fichiers absents de Drive sont listés ci-dessous.",
  tipRefresh: "Recompte les différences. Rien n’est envoyé, téléchargé ni supprimé.",
  panelLastSynced: (rel) => `Dernière synchronisation : ${rel}`,
  panelCheckedAt: (rel) => `Vérifié : ${rel}`,
  panelHeldDeletes: (n) => `Suppressions en attente (${n})`,
  panelHeldDeletesDesc:
    "Rien n’est supprimé tant que vous ne l’approuvez pas. Les fichiers approuvés vont à la corbeille : Drive la vide au bout de 30 jours, puis un administrateur peut encore les restaurer pendant 25 jours.",
  btnSelectAll: "Tout sélectionner",
  btnApproveDeletes: (n) => `Supprimer les ${n} sélectionnés`,
  tipSelectAll: "Coche tous les fichiers de la liste ci-dessus.",
  tipApproveDeletes: "Supprime les fichiers cochés et termine cette synchronisation.",
  panelChanges: "Changements",
  panelUpload: "Envoi",
  panelDownload: "Téléchargement",
  panelConflict: "Conflit",
  panelDeleteLocal: "Supprimer en local",
  panelDeleteRemote: "Supprimer sur Drive",
  panelLocalOnly: "Local uniquement",
  panelNoChanges: "Rien à synchroniser.",
  panelMore: (n) => `…et ${n} de plus`,
  cloneDone: (down, conflicts, localOnly) =>
    `clone terminé — ↓${down}, ${conflicts} copie(s) de conflit, ${localOnly} fichier(s) local uniquement`,

  // ------------------------------------------------ ローカル固有ファイルの分類
  localIgnoreTitle: "Vos propres règles d’exclusion",
  localIgnoreBody:
    "Les règles écrites ici ne valent que pour votre coffre ; ce fichier n’est jamais synchronisé. Même syntaxe que _Sync/ignore.md : # pour un commentaire, * ? ** comme jokers, un / initial ancre à la racine de synchronisation, un / final vise les dossiers, ! annule une exclusion.",
  panelUnsorted: (n) => `Pas encore décidé (${n})`,
  panelLocalOnlyDesc: "Drive n’a pas ces fichiers. Chacun reste ici, non envoyé, tant que vous n’avez pas décidé.",
  btnShare: "Partager",
  btnTrash: "Supprimer",
  btnShareAll: (n) => `Partager les ${n}`,
  btnTrashAll: (n) => `Supprimer les ${n}`,
  tipShare: "Envoie ce fichier sur Drive, pour que l’équipe l’ait.",
  tipTrash: "Met ce fichier à la corbeille. Drive n’est pas touché : il n’a jamais eu ce fichier.",
  tipShareAll: "Envoie sur Drive tous les fichiers de la liste.",
  tipTrashAll: "Met à la corbeille tous les fichiers de la liste.",
  confirmTrashTitle: "Supprimer ces fichiers ?",
  confirmTrashBody: (n) => `${n} fichier(s) partent à la corbeille. Ils ne sont pas sur Drive : c’est l’unique copie. Vous pouvez encore les récupérer depuis la corbeille.`,
  btnCancel: "Annuler",
  sharedDone: (n) => `${n} fichier(s) partagé(s)`,
  trashedDone: (n) => `${n} fichier(s) mis à la corbeille`,

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
  errTargetNotFolder:
    "Ce lien pointe vers un fichier, pas un dossier. Ouvrez le dossier lui-même et copiez son adresse.",
  errEmptyPath: "chemin vide",
  errOutsideMount: (path) => `refus de toucher un chemin hors du dossier synchronisé : ${path}`,
  errLocalMissing: (path) => `le fichier local n’existe plus : ${path}`,
};
