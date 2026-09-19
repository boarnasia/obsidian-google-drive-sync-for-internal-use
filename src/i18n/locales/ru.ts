import type { Strings } from "./en";

/** Русские формы множественного числа: 1 минуту, 2 минуты, 5 минут. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const ru: Strings = {
  // ------------------------------------------------------------------ 全般
  notice: (msg) => `Google Drive Sync: ${msg}`,
  ribbonSyncNow: "Google Drive Sync: синхронизировать сейчас",
  cmdSyncNow: "Синхронизировать сейчас",
  syncAlreadyRunning: "синхронизация уже выполняется…",
  syncSummary: (up, down, del, conflicts) => `↑${up} ↓${down} ✗${del} ⚠${conflicts}`,
  syncErrorCount: (n) => ` — ошибок: ${n}`,
  syncDeferred: (n) => ` — отложено удалений: ${n}`,
  relWords: {
    justNow: "только что",
    minutes: (n: number) => `${n} ${plural(n, "минуту", "минуты", "минут")} назад`,
    hours: (n: number) => `${n} ${plural(n, "час", "часа", "часов")} назад`,
    days: (n: number) => `${n} ${plural(n, "день", "дня", "дней")} назад`,
  },

  generalHeading: "Общие",
  languageName: "Язык",
  languageDesc:
    "«Автоматически» следует языку интерфейса Obsidian (Настройки → О программе → Язык). Названия команд и ленты изменятся после следующей перезагрузки.",
  languageAliases: ["язык", "language"],
  languageAuto: "Автоматически (как в Obsidian)",

  // --------------------------------------------------------- OAuth クライアント
  oauthHeading: "OAuth-клиент Google",
  oauthSetupRequired: "Требуется настройка",
  oauthSetupDesc:
    "Плагин не содержит собственных учётных данных. Попросите у ответственного идентификатор и секрет клиента вашей организации или создайте их один раз: ",
  oauthStep1: "Откройте страницу учётных данных в Google Cloud Console и выберите (или создайте) проект.",
  oauthStep2: "Включите «Google Drive API».",
  oauthStep3: "На экране согласия OAuth установите тип пользователей «Внутренний».",
  oauthStep4: "Создать учётные данные → Идентификатор клиента OAuth → тип приложения «Приложение для ПК».",
  oauthClientIdName: "Идентификатор клиента OAuth",
  oauthClientIdDesc: "Идентификатор OAuth-клиента Google Cloud вашей организации.",
  oauthClientIdAliases: ["google", "учётные данные", "вход", "credentials", "login"],
  oauthClientSecretName: "Секрет клиента OAuth",
  oauthClientSecretDesc:
    "Обязателен для клиентов Google типа «Приложение для ПК». Хранится только в данных плагина этого хранилища, которые никогда не синхронизируются.",

  // -------------------------------------------------------------------- 同期先
  targetHeading: "Цель синхронизации",
  rowConnection: "Подключение",
  connected: "✓ Подключено.",
  notConnected: "Не подключено.",
  btnConnect: "Подключить",
  btnReconnect: "Переподключить",
  btnDisconnect: "Отключить",
  connectedNotice: "подключено к Google Диску.",
  disconnectedNotice: "отключено от Google Диска.",

  targetUrlName: "URL папки",
  targetUrlDesc:
    "Откройте папку общего диска в браузере и вставьте сюда её адрес. Вся команда должна использовать одну и ту же папку.",
  targetUrlPlaceholder: "https://drive.google.com/drive/folders/…",
  myDriveName: "Мой диск",
  targetStatusName: "Цель",
  targetNotSet: "Не задано. Вставьте URL папки выше.",
  targetResolving: "Поиск папки на Диске…",
  targetFailed: (reason) => `✗ ${reason}`,
  targetOnSharedDrive: (path) => `Общий диск - ${path}`,
  targetOnMyDrive: (path) => `Мой диск - ${path}`,
  targetMyDriveWarning:
    "⚠ Файлы на «Моём диске» (личном) никому больше не доступны. Для командной синхронизации используйте папку на общем диске.",

  mountName: "Локальная папка",
  mountDesc:
    "Какая папка этого хранилища является общим хранилищем. Её содержимое соответствует содержимому целевой папки — само имя папки на Диске не появляется, поэтому каждый может назвать её по-своему. Пусто = всё хранилище.",
  mountPlaceholder: "(всё хранилище)",
  mountMapping: (local) => `${local}/ ⇄ целевая папка`,
  mountMappingWholeVault: "всё хранилище ⇄ целевая папка",

  // -------------------------------------------------------------------- 同期
  syncHeading: "Синхронизация",
  syncNowName: "Синхронизировать сейчас",
  syncNowDescNever: "Последняя синхронизация: никогда",
  syncNowDesc: (rel, abs) => `Последняя синхронизация: ${rel} (${abs})`,
  autoSyncName: "Автосинхронизация",
  autoSyncDesc: "Ваши изменения отправляются сразу, а изменения других подтягиваются по таймеру.",
  pollName: "Проверять изменения каждые",
  pollDesc:
    "Минуты между проверками изменений других участников. Если изменений нет, проверка — это один лёгкий запрос.",
  pollUnit: "мин",
  pollInvalid: "Введите целое число минут, не меньше 1.",

  // ---------------------------------------------------------- 利用者に出る失敗
  errNoOauthClient:
    "OAuth-клиент не настроен — введите идентификатор и секрет клиента в настройках, затем подключитесь.",
  errNoRefreshToken:
    "Токен обновления не получен — отзовите доступ приложения на myaccount.google.com и подключитесь снова.",
  errNotConnected: "Сначала подключитесь к Google Диску.",
  errNoTarget: "Цель синхронизации не задана — вставьте URL папки в настройках.",
  errTargetEmpty: "Вставьте URL папки (или её идентификатор).",
  errTargetNotFound: "Папка не найдена, или этот аккаунт её не видит.",
  errTargetForbidden: "У этого аккаунта нет доступа к этой папке.",
  errTargetNotFolder: "Эта ссылка ведёт на файл, а не на папку. Откройте саму папку и скопируйте её адрес.",
  errEmptyPath: "пустой путь",
  errOutsideMount: (path) => `отказ: путь вне синхронизируемой папки: ${path}`,
  errLocalMissing: (path) => `локальный файл больше не существует: ${path}`,
};
