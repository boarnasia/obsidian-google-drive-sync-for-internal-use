import type { Strings } from "./en";

export const hi: Strings = {
  // ------------------------------------------------------------------ 全般
  notice: (msg) => `Google Drive Sync: ${msg}`,
  ribbonSyncNow: "Google Drive Sync: अभी सिंक करें",
  cmdSyncNow: "अभी सिंक करें",
  syncAlreadyRunning: "सिंक पहले से चल रहा है…",
  syncSummary: (up, down, del, conflicts) => `↑${up} ↓${down} ✗${del} ⚠${conflicts}`,
  syncErrorCount: (n) => ` — ${n} त्रुटि(याँ)`,
  syncDeferred: (n) => ` — ${n} हटाना रोका गया`,
  relWords: {
    justNow: "अभी-अभी",
    minutes: (n: number) => `${n} मिनट पहले`,
    hours: (n: number) => `${n} ${n === 1 ? "घंटा" : "घंटे"} पहले`,
    days: (n: number) => `${n} दिन पहले`,
  },

  generalHeading: "सामान्य",
  languageName: "भाषा",
  languageDesc:
    "“स्वचालित” Obsidian की अपनी प्रदर्शन भाषा (सेटिंग्स → परिचय → भाषा) का पालन करता है। कमांड और रिबन के नाम अगली बार फिर से लोड करने पर बदलेंगे।",
  languageAliases: ["भाषा", "language"],
  languageAuto: "स्वचालित (Obsidian के अनुसार)",

  // --------------------------------------------------------- OAuth クライアント
  oauthHeading: "Google OAuth क्लाइंट",
  oauthSetupRequired: "सेटअप आवश्यक है",
  oauthSetupDesc:
    "इस प्लगइन के साथ कोई क्रेडेंशियल नहीं आते। अपने संगठन का क्लाइंट ID और सीक्रेट ज़िम्मेदार व्यक्ति से माँगें, या एक बार स्वयं बनाएँ: ",
  oauthStep1: "Google Cloud Console का क्रेडेंशियल पेज खोलें और कोई प्रोजेक्ट चुनें (या बनाएँ)।",
  oauthStep2: "“Google Drive API” चालू करें।",
  oauthStep3: "OAuth सहमति स्क्रीन का User Type “Internal” पर सेट करें।",
  oauthStep4: "क्रेडेंशियल बनाएँ → OAuth क्लाइंट ID → एप्लिकेशन प्रकार “Desktop app”।",
  oauthClientIdName: "OAuth क्लाइंट ID",
  oauthClientIdDesc: "आपके संगठन के Google Cloud OAuth क्लाइंट का क्लाइंट ID।",
  oauthClientIdAliases: ["google", "क्रेडेंशियल", "साइन इन", "लॉगिन", "credentials", "login"],
  oauthClientSecretName: "OAuth क्लाइंट सीक्रेट",
  oauthClientSecretDesc:
    "Google “Desktop app” क्लाइंट के लिए आवश्यक। यह केवल इस वॉल्ट के प्लगइन डेटा में सहेजा जाता है, जो कभी सिंक नहीं होता।",

  // -------------------------------------------------------------------- 同期先
  targetHeading: "सिंक लक्ष्य",
  rowConnection: "कनेक्शन",
  connected: "✓ कनेक्ट है।",
  notConnected: "कनेक्ट नहीं है।",
  btnConnect: "कनेक्ट करें",
  btnReconnect: "फिर से कनेक्ट करें",
  btnDisconnect: "डिस्कनेक्ट करें",
  connectedNotice: "Google Drive से कनेक्ट हो गया।",
  disconnectedNotice: "Google Drive से डिस्कनेक्ट हो गया।",

  targetUrlName: "फ़ोल्डर URL",
  targetUrlDesc:
    "ब्राउज़र में शेयर्ड ड्राइव का फ़ोल्डर खोलें और उसका पता यहाँ चिपकाएँ। टीम के सभी सदस्यों को एक ही फ़ोल्डर इस्तेमाल करना होगा।",
  targetUrlPlaceholder: "https://drive.google.com/drive/folders/…",
  myDriveName: "मेरी ड्राइव",
  targetStatusName: "लक्ष्य",
  targetNotSet: "सेट नहीं है। ऊपर फ़ोल्डर URL चिपकाएँ।",
  targetResolving: "Drive में फ़ोल्डर खोजा जा रहा है…",
  targetFailed: (reason) => `✗ ${reason}`,
  targetOnSharedDrive: (path) => `शेयर्ड ड्राइव - ${path}`,
  targetOnMyDrive: (path) => `मेरी ड्राइव - ${path}`,
  targetMyDriveWarning:
    "⚠ मेरी ड्राइव (निजी) की फ़ाइलें किसी और तक नहीं पहुँचतीं। टीम सिंक के लिए शेयर्ड ड्राइव का फ़ोल्डर इस्तेमाल करें।",

  mountName: "स्थानीय फ़ोल्डर",
  mountDesc:
    "इस वॉल्ट का कौन-सा फ़ोल्डर साझा वॉल्ट है। उसकी सामग्री लक्ष्य फ़ोल्डर की सामग्री से मेल खाती है — फ़ोल्डर का नाम Drive पर नहीं दिखता, इसलिए हर कोई अलग नाम रख सकता है। खाली = पूरा वॉल्ट।",
  mountPlaceholder: "(पूरा वॉल्ट)",
  mountMapping: (local) => `${local}/ ⇄ लक्ष्य फ़ोल्डर`,
  mountMappingWholeVault: "पूरा वॉल्ट ⇄ लक्ष्य फ़ोल्डर",

  // -------------------------------------------------------------------- 同期
  syncHeading: "सिंक",
  syncNowName: "अभी सिंक करें",
  syncNowDescNever: "पिछला सिंक: कभी नहीं",
  syncNowDesc: (rel, abs) => `पिछला सिंक: ${rel} (${abs})`,
  autoSyncName: "स्वचालित सिंक",
  autoSyncDesc: "आपके बदलाव होते ही अपलोड होते हैं, और दूसरों के बदलाव तय अंतराल पर लाए जाते हैं।",
  pollName: "बदलाव जाँचने का अंतराल",
  pollDesc: "दूसरों के बदलाव जाँचने के बीच के मिनट। कोई बदलाव न होने पर जाँच केवल एक हल्का अनुरोध है।",
  pollUnit: "मिनट",
  pollInvalid: "1 या उससे अधिक पूर्ण संख्या (मिनट) दर्ज करें।",
  syncMovedDesc: "सिंक के सारे काम और सेटिंग दाईं साइडबार के सिंक प्रबंधक में हैं।",

  // ------------------------------------------------------------ 同期管理パネル
  panelTitle: "सिंक प्रबंधन",
  panelOpen: "सिंक प्रबंधन खोलें",
  panelNeedsConnection: "कनेक्ट नहीं है। पहले प्लगइन सेटिंग्स में Google Drive से कनेक्ट करें।",
  panelNeedsTarget: "अभी कोई सिंक लक्ष्य नहीं है। प्लगइन सेटिंग्स में फ़ोल्डर URL चिपकाएँ।",
  panelChecking: "बदलाव जाँचे जा रहे हैं…",
  panelReady: "✓ सिंक के लिए तैयार।",
  panelBlocked: "⚠ अपलोड रोक दिए गए हैं।",
  reasonNoBaseline: "इस वॉल्ट को अभी तक Drive से नहीं लाया गया है और दोनों ओर फ़ाइलें हैं। पहले “Drive से लाएँ” चलाएँ।",
  reasonVaultEmpty:
    "रिमोट और स्थानीय में बड़ा अंतर है: Drive में दर्ज कई फ़ाइलें स्थानीय रूप से हटा दी गई हैं। नीचे से उन्हें Drive पर हटाएँ, या “Drive से लाएँ” चलाकर वापस लाएँ।",
  reasonDeleteGuard:
    "यह सिंक सुरक्षा सीमा से अधिक फ़ाइलें हटाने वाला है। नीचे की सूची देखें, या “Drive से लाएँ” चलाकर रिमोट की प्रति वापस लाएँ।",
  panelActions: "कार्य",
  btnClone: "Drive से लाएँ",
  btnRefresh: "स्थिति देखें",
  tipSyncNow: "आपके बदलाव Drive पर भेजता है और दूसरों के बदलाव यहाँ लाता है।",
  tipClone: "Drive की प्रति यहाँ लाता है। स्थानीय कुछ भी नहीं मिटता। जो फ़ाइलें Drive पर नहीं हैं, वे नीचे दिखती हैं।",
  tipRefresh: "सिर्फ़ अंतर फिर से गिनता है। कुछ भी अपलोड, डाउनलोड या डिलीट नहीं होता।",
  panelLastSynced: (rel) => `पिछला सिंक: ${rel}`,
  panelCheckedAt: (rel) => `जाँच: ${rel}`,
  panelHeldDeletes: (n) => `रोके गए हटाने (${n})`,
  panelHeldDeletesDesc:
    "आपकी मंज़ूरी से पहले कुछ नहीं हटाया जाता। मंज़ूर की गई फ़ाइलें ट्रैश में जाती हैं: Drive का ट्रैश 30 दिन बाद खाली होता है, और उसके 25 दिन बाद तक व्यवस्थापक उन्हें लौटा सकते हैं।",
  btnSelectAll: "सभी चुनें",
  btnApproveDeletes: (n) => `चुनी हुई ${n} हटाएँ`,
  tipSelectAll: "ऊपर की सूची की सभी फ़ाइलें चुनें।",
  tipApproveDeletes: "चुनी हुई फ़ाइलें मिटाकर यह सिंक पूरा करें।",
  panelChanges: "बदलाव",
  panelUpload: "अपलोड",
  panelDownload: "डाउनलोड",
  panelConflict: "टकराव",
  panelDeleteLocal: "स्थानीय रूप से हटाएँ",
  panelDeleteRemote: "Drive से हटाएँ",
  panelLocalOnly: "केवल स्थानीय",
  panelNoChanges: "सिंक करने को कुछ नहीं है।",
  panelMore: (n) => `…और ${n} अन्य`,
  cloneDone: (down, conflicts, localOnly) =>
    `clone पूरा — ↓${down}, ${conflicts} टकराव प्रतियाँ, ${localOnly} केवल-स्थानीय फ़ाइलें`,

  // ------------------------------------------------ ローカル固有ファイルの分類
  localIgnoreTitle: "आपके अपने बहिष्करण नियम",
  localIgnoreBody:
    "यहाँ लिखे नियम केवल आपके वॉल्ट पर लागू होते हैं; यह फ़ाइल सिंक नहीं होती। वाक्य-विन्यास _Sync/ignore.md जैसा ही है: # टिप्पणी, * ? ** ग्लोब, शुरुआती / सिंक रूट पर टिकाता है, अंतिम / फ़ोल्डर, ! बहिष्करण हटाता है।",
  panelUnsorted: (n) => `अभी तय नहीं (${n})`,
  panelLocalOnlyDesc: "ये फ़ाइलें Drive पर नहीं हैं। जब तक आप तय नहीं करते, ये यहीं रहती हैं और अपलोड नहीं होतीं।",
  btnShare: "साझा करें",
  btnTrash: "हटाएँ",
  btnShareAll: (n) => `सभी ${n} साझा करें`,
  btnTrashAll: (n) => `सभी ${n} हटाएँ`,
  tipShare: "यह फ़ाइल Drive पर भेजें, ताकि टीम को मिले।",
  tipTrash: "यह फ़ाइल कूड़ेदान में डालें। Drive को कुछ नहीं होता — वहाँ यह फ़ाइल थी ही नहीं।",
  tipShareAll: "सूची की हर फ़ाइल Drive पर भेजें।",
  tipTrashAll: "सूची की हर फ़ाइल कूड़ेदान में डालें।",
  confirmTrashTitle: "क्या ये फ़ाइलें हटानी हैं?",
  confirmTrashBody: (n) => `${n} फ़ाइलें कूड़ेदान में जाएँगी। ये Drive पर नहीं हैं, इसलिए यही अकेली प्रति है — कूड़ेदान से वापस ला सकते हैं।`,
  btnCancel: "रद्द करें",
  sharedDone: (n) => `${n} फ़ाइलें साझा कीं`,
  trashedDone: (n) => `${n} फ़ाइलें कूड़ेदान में डालीं`,

  // ---------------------------------------------------------- 利用者に出る失敗
  errNoOauthClient: "कोई OAuth क्लाइंट सेट नहीं है — सेटिंग्स में क्लाइंट ID और सीक्रेट दर्ज करें, फिर कनेक्ट करें।",
  errNoRefreshToken:
    "कोई रीफ़्रेश टोकन नहीं मिला — myaccount.google.com पर इस ऐप की पहुँच हटाएँ और फिर से कनेक्ट करें।",
  errNotConnected: "पहले Google Drive से कनेक्ट करें।",
  errNoTarget: "कोई सिंक लक्ष्य सेट नहीं है — सेटिंग्स में फ़ोल्डर URL चिपकाएँ।",
  errTargetEmpty: "फ़ोल्डर का URL (या उसका ID) चिपकाएँ।",
  errTargetNotFound: "वह फ़ोल्डर नहीं मिला, या यह खाता उसे नहीं देख सकता।",
  errTargetForbidden: "इस खाते को वह फ़ोल्डर खोलने की अनुमति नहीं है।",
  errTargetNotFolder: "यह लिंक फ़ोल्डर की नहीं, फ़ाइल की ओर इशारा करता है। फ़ोल्डर खोलें और उसका पता कॉपी करें।",
  errEmptyPath: "पथ खाली है",
  errOutsideMount: (path) => `सिंक फ़ोल्डर के बाहर के पथ को छूने से इनकार: ${path}`,
  errLocalMissing: (path) => `स्थानीय फ़ाइल मौजूद नहीं है: ${path}`,
};
