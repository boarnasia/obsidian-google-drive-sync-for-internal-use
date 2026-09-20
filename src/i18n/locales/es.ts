import type { Strings } from "./en";

export const es: Strings = {
  // ------------------------------------------------------------------ 全般
  notice: (msg) => `Google Drive Sync: ${msg}`,
  ribbonSyncNow: "Google Drive Sync: sincronizar ahora",
  cmdSyncNow: "Sincronizar ahora",
  syncAlreadyRunning: "ya hay una sincronización en curso…",
  syncSummary: (up, down, del, conflicts) => `↑${up} ↓${down} ✗${del} ⚠${conflicts}`,
  syncErrorCount: (n) => ` — ${n} error(es)`,
  syncDeferred: (n) => ` — ${n} eliminación(es) en espera`,
  relWords: {
    justNow: "justo ahora",
    minutes: (n: number) => `hace ${n} minuto${n === 1 ? "" : "s"}`,
    hours: (n: number) => `hace ${n} hora${n === 1 ? "" : "s"}`,
    days: (n: number) => `hace ${n} día${n === 1 ? "" : "s"}`,
  },

  generalHeading: "General",
  languageName: "Idioma",
  languageDesc:
    "Automático sigue el idioma de Obsidian (Ajustes → Acerca de → Idioma). Los nombres de comandos y de la cinta cambian en la próxima recarga.",
  languageAliases: ["idioma", "language"],
  languageAuto: "Automático (según Obsidian)",

  // --------------------------------------------------------- OAuth クライアント
  oauthHeading: "Cliente OAuth de Google",
  oauthSetupRequired: "Configuración necesaria",
  oauthSetupDesc:
    "Este plugin no incluye credenciales propias. Pide el ID y el secreto de cliente de tu organización a quien lo haya configurado, o crea uno una sola vez: ",
  oauthStep1: "Abre la página de credenciales de Google Cloud Console y elige (o crea) un proyecto.",
  oauthStep2: "Habilita la «Google Drive API».",
  oauthStep3: "En la pantalla de consentimiento de OAuth, establece el tipo de usuario en «Interno».",
  oauthStep4: "Crear credenciales → ID de cliente de OAuth → tipo de aplicación «App de escritorio».",
  oauthClientIdName: "ID de cliente de OAuth",
  oauthClientIdDesc: "El ID del cliente OAuth de Google Cloud de tu organización.",
  oauthClientIdAliases: ["google", "credenciales", "iniciar sesión", "credentials", "login"],
  oauthClientSecretName: "Secreto de cliente de OAuth",
  oauthClientSecretDesc:
    "Obligatorio para clientes «App de escritorio» de Google. Se guarda solo en los datos del plugin de esta bóveda, que nunca se sincronizan.",

  // -------------------------------------------------------------------- 同期先
  targetHeading: "Destino de sincronización",
  rowConnection: "Conexión",
  connected: "✓ Conectado.",
  notConnected: "No conectado.",
  btnConnect: "Conectar",
  btnReconnect: "Volver a conectar",
  btnDisconnect: "Desconectar",
  connectedNotice: "conectado a Google Drive.",
  disconnectedNotice: "desconectado de Google Drive.",

  targetUrlName: "URL de la carpeta",
  targetUrlDesc:
    "Abre la carpeta de la unidad compartida en el navegador y pega aquí su dirección. Todo el equipo debe usar la misma carpeta.",
  targetUrlPlaceholder: "https://drive.google.com/drive/folders/…",
  myDriveName: "Mi unidad",
  targetStatusName: "Destino",
  targetNotSet: "Sin configurar. Pega arriba la URL de la carpeta.",
  targetResolving: "Buscando la carpeta en Drive…",
  targetFailed: (reason) => `✗ ${reason}`,
  targetOnSharedDrive: (path) => `Unidad compartida - ${path}`,
  targetOnMyDrive: (path) => `Mi unidad - ${path}`,
  targetMyDriveWarning:
    "⚠ Los archivos de Mi unidad (personal) no llegan a nadie más. Usa una carpeta de una unidad compartida para sincronizar en equipo.",

  mountName: "Carpeta local",
  mountDesc:
    "Qué carpeta de esta bóveda es la bóveda compartida. Su contenido se corresponde con el de la carpeta de destino; el nombre de la carpeta no aparece en Drive, así que cada persona puede llamarla distinto. Vacío = toda la bóveda.",
  mountPlaceholder: "(toda la bóveda)",
  mountMapping: (local) => `${local}/ ⇄ la carpeta de destino`,
  mountMappingWholeVault: "toda la bóveda ⇄ la carpeta de destino",

  // -------------------------------------------------------------------- 同期
  syncHeading: "Sincronización",
  syncNowName: "Sincronizar ahora",
  syncNowDescNever: "Última sincronización: nunca",
  syncNowDesc: (rel, abs) => `Última sincronización: ${rel} (${abs})`,
  autoSyncName: "Sincronización automática",
  autoSyncDesc: "Sube tus cambios en cuanto se producen y trae los cambios de los demás cada cierto tiempo.",
  pollName: "Buscar cambios cada",
  pollDesc:
    "Minutos entre comprobaciones de los cambios de los demás. Si no hay cambios, cada comprobación es una única solicitud ligera.",
  pollUnit: "minutos",
  pollInvalid: "Introduce un número entero de minutos, 1 o más.",

  // ------------------------------------------------------------ 同期管理パネル
  panelTitle: "Gestor de sincronización",
  panelOpen: "Abrir el gestor de sincronización",
  panelNeedsConnection: "Sin conexión. Conecta con Google Drive en los ajustes del plugin.",
  panelNeedsTarget: "Aún no hay destino de sincronización. Pega la URL de la carpeta en los ajustes del plugin.",
  panelChecking: "Comprobando qué ha cambiado…",
  panelReady: "✓ Listo para sincronizar.",
  panelBlocked: "⚠ Las subidas están en pausa.",
  reasonNoBaseline:
    "Esta bóveda todavía no se ha traído desde Drive y hay archivos en ambos lados. Ejecuta «Traer desde Drive» primero.",
  reasonVaultEmpty:
    "Lo remoto y lo local difieren mucho: muchos archivos que Drive aún lista se han borrado en local. Bórralos en Drive desde la lista de abajo, o ejecuta «Traer desde Drive» para recuperarlos.",
  reasonDeleteGuard:
    "Esta sincronización eliminaría más archivos de los que permite el límite de seguridad. Revisa la lista de abajo o ejecuta «Traer desde Drive» para recuperar la copia remota.",
  panelActions: "Acciones",
  btnClone: "Traer desde Drive",
  btnRefresh: "Ver estado",
  panelLastSynced: (rel) => `Última sincronización: ${rel}`,
  panelCheckedAt: (rel) => `Comprobado: ${rel}`,
  panelHeldDeletes: (n) => `Eliminaciones en espera (${n})`,
  panelHeldDeletesDesc:
    "No se elimina nada hasta que lo apruebes. Los archivos aprobados van a la papelera: Drive la vacía a los 30 días y, después, un administrador aún puede restaurarlos durante 25 días.",
  btnSelectAll: "Seleccionar todo",
  btnApproveDeletes: (n) => `Eliminar ${n} seleccionados`,
  panelChanges: "Cambios",
  panelUpload: "Subida",
  panelDownload: "Descarga",
  panelConflict: "Conflicto",
  panelLocalOnly: "Solo local",
  panelNoChanges: "No hay nada que sincronizar.",
  panelMore: (n) => `…y ${n} más`,
  cloneDone: (down, conflicts, localOnly) =>
    `clone terminado — ↓${down}, ${conflicts} copia(s) de conflicto, ${localOnly} archivo(s) solo local`,

  // ------------------------------------------------ ローカル固有ファイルの分類
  sectionUnsorted: "Sin clasificar",
  sectionShared: "Compartir",
  sectionTrash: "Eliminar",
  localOnlyIntro:
    "Archivos que hay en esta bóveda y no en Drive. Mueve cada línea a «Compartir» o «Eliminar» y luego ejecuta «Ordenar archivos locales». Este archivo nunca se sincroniza.",
  localIgnoreTitle: "Tus propias reglas de exclusión",
  localIgnoreBody:
    "Las reglas de aquí solo afectan a tu bóveda; este archivo nunca se sincroniza. Misma sintaxis que _Sync/ignore.md: # es comentario, * ? ** son comodines, una / inicial ancla a la raíz de sincronización, una / final coincide con carpetas y ! deshace una exclusión.",
  btnOrganize: "Ordenar archivos locales",
  panelUnsorted: "Sin clasificar",
  panelHeldUploads: "Subidas en pausa",
  panelLocalOnlyDesc:
    "Las subidas de archivos locales nuevos están en pausa hasta que la lista sin clasificar quede vacía.",
  btnOpenLocalOnly: "Abrir la lista",
  organizeDone: (shared, trashed) => `archivos locales ordenados — ${shared} para compartir, ${trashed} a la papelera`,

  // ---------------------------------------------------------- 利用者に出る失敗
  errNoOauthClient:
    "No hay cliente OAuth configurado: introduce el ID y el secreto de cliente en los ajustes y luego conecta.",
  errNoRefreshToken:
    "No se recibió un token de actualización: revoca el acceso de la app en myaccount.google.com y vuelve a conectar.",
  errNotConnected: "Primero conecta con Google Drive.",
  errNoTarget: "No hay destino de sincronización: pega la URL de la carpeta en los ajustes.",
  errTargetEmpty: "Pega la URL de la carpeta (o su ID).",
  errTargetNotFound: "No se encontró la carpeta, o esta cuenta no puede verla.",
  errTargetForbidden: "Esta cuenta no tiene permiso para abrir esa carpeta.",
  errTargetNotFolder: "Ese enlace apunta a un archivo, no a una carpeta. Abre la propia carpeta y copia su dirección.",
  errEmptyPath: "ruta vacía",
  errOutsideMount: (path) => `se rechaza modificar una ruta fuera de la carpeta sincronizada: ${path}`,
  errLocalMissing: (path) => `el archivo local ya no existe: ${path}`,
};
