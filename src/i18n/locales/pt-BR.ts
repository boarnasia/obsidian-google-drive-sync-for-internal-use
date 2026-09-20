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

  mountName: "Pasta local",
  mountDesc:
    "Qual pasta deste cofre é o cofre compartilhado. O conteúdo dela corresponde ao da pasta de destino — o nome da pasta nunca aparece no Drive, então cada pessoa pode chamá-la de um jeito. Em branco = o cofre inteiro.",
  mountPlaceholder: "(cofre inteiro)",
  mountMapping: (local) => `${local}/ ⇄ a pasta de destino`,
  mountMappingWholeVault: "o cofre inteiro ⇄ a pasta de destino",

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

  // ------------------------------------------------------------ 同期管理パネル
  panelTitle: "Gerenciador de sincronização",
  panelOpen: "Abrir o gerenciador de sincronização",
  panelNeedsConnection: "Sem conexão. Conecte-se ao Google Drive nas configurações do plugin.",
  panelNeedsTarget: "Ainda não há destino de sincronização. Cole a URL da pasta nas configurações do plugin.",
  panelChecking: "Verificando o que mudou…",
  panelReady: "✓ Pronto para sincronizar.",
  panelBlocked: "⚠ Os envios estão pausados.",
  reasonNoBaseline:
    "Este cofre ainda não foi clonado e há arquivos dos dois lados. Execute o Clone para trazer o remoto primeiro.",
  reasonVaultEmpty:
    "O cofre está vazio, mas a referência ainda lista arquivos. Execute o Clone para trazê-los de volta ou aprove as exclusões abaixo.",
  reasonDeleteGuard: "Esta sincronização excluiria mais arquivos do que o limite de segurança permite.",
  panelActions: "Ações",
  btnClone: "Clone",
  btnRefresh: "Atualizar",
  panelLastSynced: (rel) => `Última sincronização: ${rel}`,
  panelCheckedAt: (rel) => `Verificado: ${rel}`,
  panelHeldDeletes: (n) => `Exclusões pendentes (${n})`,
  panelHeldDeletesDesc:
    "Nada é excluído até você aprovar. Os arquivos aprovados vão para a lixeira: o Drive a esvazia depois de 30 dias e, mesmo depois, um administrador ainda pode restaurá-los por 25 dias.",
  btnSelectAll: "Selecionar tudo",
  btnApproveDeletes: (n) => `Excluir ${n} selecionados`,
  panelChanges: "Mudanças",
  panelUpload: "Envio",
  panelDownload: "Download",
  panelConflict: "Conflito",
  panelLocalOnly: "Somente local",
  panelNoChanges: "Nada para sincronizar.",
  panelMore: (n) => `…e mais ${n}`,
  cloneDone: (down, conflicts, localOnly) =>
    `clone concluído — ↓${down}, ${conflicts} cópia(s) de conflito, ${localOnly} arquivo(s) somente local`,

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
  errTargetNotFolder: "Esse link aponta para um arquivo, não para uma pasta. Abra a própria pasta e copie o endereço dela.",
  errEmptyPath: "caminho vazio",
  errOutsideMount: (path) => `recusado: caminho fora da pasta sincronizada: ${path}`,
  errLocalMissing: (path) => `o arquivo local não existe mais: ${path}`,
};
