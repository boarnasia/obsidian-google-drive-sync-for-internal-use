import type { Strings } from "./en";

/** Português (Brasil). */
export const ptBR: Strings = {
  // ------------------------------------------------------------------ 全般
  notice: (msg) => `Google Drive Sync: ${msg}`,
  ribbonSyncNow: "Google Drive Sync: sincronizar agora",
  cmdSyncNow: "Sincronizar agora",
  syncAlreadyRunning: "já há uma sincronização em andamento…",
  syncSummary: (up, down, del, conflicts) => `↑${up} ↓${down} ✗${del} ⚠${conflicts}`,
  syncErrorCount: (n) => ` — ${n} erro(s)`,
  syncDeferred: (n) => ` — ${n} exclusão(ões) adiada(s)`,
  relWords: {
    justNow: "agora mesmo",
    minutes: (n: number) => `há ${n} minuto${n === 1 ? "" : "s"}`,
    hours: (n: number) => `há ${n} hora${n === 1 ? "" : "s"}`,
    days: (n: number) => `há ${n} dia${n === 1 ? "" : "s"}`,
  },

  generalHeading: "Geral",
  languageName: "Idioma",
  languageDesc:
    "Automático segue o idioma de exibição do Obsidian (Configurações → Sobre → Idioma). Os nomes de comandos e da faixa de opções mudam no próximo recarregamento.",
  languageAliases: ["idioma", "language"],
  languageAuto: "Automático (igual ao Obsidian)",

  // --------------------------------------------------------- OAuth クライアント
  oauthHeading: "Cliente OAuth do Google",
  oauthSetupRequired: "Configuração necessária",
  oauthSetupDesc:
    "Este plugin não traz credenciais próprias. Peça o ID e a chave secreta do cliente da sua organização a quem fez a configuração, ou crie um uma única vez: ",
  oauthStep1: "Abra a página de credenciais do Google Cloud Console e escolha (ou crie) um projeto.",
  oauthStep2: "Ative a “Google Drive API”.",
  oauthStep3: "Na tela de consentimento OAuth, defina o tipo de usuário como “Interno”.",
  oauthStep4: "Criar credenciais → ID do cliente OAuth → tipo de aplicativo “App para computador”.",
  oauthClientIdName: "ID do cliente OAuth",
  oauthClientIdDesc: "O ID do cliente OAuth do Google Cloud da sua organização.",
  oauthClientIdAliases: ["google", "credenciais", "entrar", "credentials", "login"],
  oauthClientSecretName: "Chave secreta do cliente OAuth",
  oauthClientSecretDesc:
    "Obrigatória para clientes “App para computador” do Google. Fica salva apenas nos dados do plugin deste cofre, que nunca são sincronizados.",

  // -------------------------------------------------------------------- 同期先
  targetHeading: "Destino da sincronização",
  rowConnection: "Conexão",
  connected: "✓ Conectado.",
  notConnected: "Não conectado.",
  btnConnect: "Conectar",
  btnReconnect: "Reconectar",
  btnDisconnect: "Desconectar",
  connectedNotice: "conectado ao Google Drive.",
  disconnectedNotice: "desconectado do Google Drive.",

  targetUrlName: "URL da pasta",
  targetUrlDesc:
    "Abra a pasta do drive compartilhado no navegador e cole o endereço aqui. Toda a equipe precisa usar a mesma pasta.",
  targetUrlPlaceholder: "https://drive.google.com/drive/folders/…",
  myDriveName: "Meu Drive",
  targetStatusName: "Destino",
  targetNotSet: "Não definido. Cole a URL da pasta acima.",
  targetResolving: "Procurando a pasta no Drive…",
  targetFailed: (reason) => `✗ ${reason}`,
  targetOnSharedDrive: (path) => `Drive compartilhado - ${path}`,
  targetOnMyDrive: (path) => `Meu Drive - ${path}`,
  targetMyDriveWarning:
    "⚠ Arquivos no Meu Drive (pessoal) não chegam a mais ninguém. Use uma pasta de um drive compartilhado para sincronizar em equipe.",

  // -------------------------------------------------------------------- 同期
  syncHeading: "Sincronização",
  syncNowName: "Sincronizar agora",
  syncNowDescNever: "Última sincronização: nunca",
  syncNowDesc: (rel, abs) => `Última sincronização: ${rel} (${abs})`,
  autoSyncName: "Sincronização automática",
  autoSyncDesc: "Envia suas alterações assim que acontecem e busca as alterações dos outros em intervalos regulares.",
  pollName: "Verificar alterações a cada",
  pollDesc:
    "Minutos entre as verificações das alterações dos outros. Sem alterações, cada verificação é uma única requisição leve.",
  pollUnit: "minutos",
  pollInvalid: "Informe um número inteiro de minutos, 1 ou mais.",
  syncMovedDesc: "As ações e as configurações de sincronização ficam no gerenciador de sincronização, na barra lateral direita.",

  // ------------------------------------------------------------ 同期管理パネル
  panelTitle: "Gerenciador de sincronização",
  panelOpen: "Abrir o gerenciador de sincronização",
  panelNeedsConnection: "Sem conexão. Conecte-se ao Google Drive nas configurações do plugin.",
  panelNeedsTarget: "Ainda não há destino de sincronização. Cole a URL da pasta nas configurações do plugin.",
  panelChecking: "Verificando o que mudou…",
  panelReady: "✓ Pronto para sincronizar.",
  panelBlocked: "⚠ Os envios estão pausados.",
  panelSyncFailed: (message) => `✗ A última sincronização falhou: ${message}`,
  reasonNoBaseline:
    "Este cofre ainda não foi trazido do Drive e há arquivos dos dois lados. Execute “Trazer do Drive” primeiro.",
  reasonVaultEmpty:
    "O remoto e o local diferem muito: muitos arquivos que o Drive ainda lista foram excluídos localmente. Exclua-os no Drive pela lista abaixo, ou execute “Trazer do Drive” para recuperá-los.",
  reasonDeleteGuard:
    "Esta sincronização excluiria mais arquivos do que o limite de segurança permite. Veja a lista abaixo ou execute “Trazer do Drive” para recuperar a cópia remota.",
  panelActions: "Ações",
  btnClone: "Trazer do Drive",
  btnRefresh: "Ver estado",
  tipSyncNow: "Envia suas mudanças para o Drive e traz as dos outros para cá.",
  tipClone: "Traz a cópia do Drive para cá. Nada local é apagado; os arquivos que o Drive não tem aparecem abaixo.",
  tipRefresh: "Reconta as diferenças. Não envia, não baixa e não apaga nada.",
  panelLastSynced: (rel) => `Última sincronização: ${rel}`,
  panelCheckedAt: (rel) => `Verificado: ${rel}`,
  panelHeldDeletes: (n) => `Exclusões pendentes (${n})`,
  panelHeldDeletesDesc:
    "Nada é excluído até você aprovar. Os arquivos aprovados vão para a lixeira: o Drive a esvazia depois de 30 dias e, mesmo depois, um administrador ainda pode restaurá-los por 25 dias.",
  btnSelectAll: "Selecionar tudo",
  btnApproveDeletes: (n) => `Excluir ${n} selecionados`,
  tipSelectAll: "Marca todos os arquivos da lista acima.",
  tipApproveDeletes: "Apaga os arquivos marcados e termina esta sincronização.",
  panelChanges: "Mudanças",
  panelUpload: "Envio",
  panelDownload: "Download",
  panelConflict: "Conflito",
  panelDeleteLocal: "Excluir localmente",
  panelDeleteRemote: "Excluir no Drive",
  panelLocalOnly: "Somente local",
  panelNoChanges: "Nada para sincronizar.",
  panelMore: (n) => `…e mais ${n}`,
  cloneDone: (down, conflicts, localOnly) =>
    `clone concluído — ↓${down}, ${conflicts} cópia(s) de conflito, ${localOnly} arquivo(s) somente local`,

  // ------------------------------------------------ ローカル固有ファイルの分類
  localIgnoreTitle: "Suas próprias regras de exclusão",
  localIgnoreBody:
    "As regras daqui valem só para o seu cofre; este arquivo nunca é sincronizado. Mesma sintaxe de _Sync/ignore.md: # é comentário, * ? ** são curingas, uma / inicial fixa na raiz da sincronização, uma / final casa com pastas e ! desfaz uma exclusão.",
  panelUnsorted: (n) => `Ainda sem decisão (${n})`,
  panelLocalOnlyDesc: "O Drive não tem estes arquivos. Cada um fica aqui, sem subir, até você decidir.",
  btnShare: "Compartilhar",
  btnTrash: "Excluir",
  btnShareAll: (n) => `Compartilhar os ${n}`,
  btnTrashAll: (n) => `Excluir os ${n}`,
  tipShare: "Envia este arquivo para o Drive, para a equipe receber.",
  tipTrash: "Manda este arquivo para a lixeira. O Drive não é tocado — ele nunca teve este arquivo.",
  tipShareAll: "Envia para o Drive todos os arquivos da lista.",
  tipTrashAll: "Manda para a lixeira todos os arquivos da lista.",
  confirmTrashTitle: "Excluir estes arquivos?",
  confirmTrashBody: (n) => `${n} arquivo(s) vão para a lixeira. Eles não estão no Drive, então esta é a única cópia — você ainda pode recuperá-los da lixeira.`,
  btnCancel: "Cancelar",
  sharedDone: (n) => `${n} arquivo(s) compartilhado(s)`,
  trashedDone: (n) => `${n} arquivo(s) enviado(s) para a lixeira`,

  // ---------------------------------------------------------- 利用者に出る失敗
  errNoOauthClient:
    "Nenhum cliente OAuth configurado — informe o ID e a chave secreta do cliente nas configurações e depois conecte.",
  errNoRefreshToken:
    "Nenhum token de atualização foi recebido — revogue o acesso do app em myaccount.google.com e conecte de novo.",
  errNotConnected: "Conecte-se ao Google Drive primeiro.",
  errNoTarget: "Nenhum destino de sincronização definido — cole a URL da pasta nas configurações.",
  errTargetEmpty: "Cole a URL da pasta (ou o ID dela).",
  errTargetNotFound: "A pasta não foi encontrada, ou esta conta não consegue vê-la.",
  errTargetForbidden: "Esta conta não tem permissão para abrir essa pasta.",
  errTargetNotFolder:
    "Esse link aponta para um arquivo, não para uma pasta. Abra a própria pasta e copie o endereço dela.",
  errEmptyPath: "caminho vazio",
  errOutsideMount: (path) => `recusado: caminho fora da pasta sincronizada: ${path}`,
  errLocalMissing: (path) => `o arquivo local não existe mais: ${path}`,
};
