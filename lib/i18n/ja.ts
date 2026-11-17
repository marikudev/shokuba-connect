// All user-facing Japanese UI strings live in this file (PRD section 6).
// Wording marked as fixed copy in the PRD must not be reworded.
export const ja = {
  appTitle: "朝礼コネクト",
  appDescription: "朝礼と面談の翻訳で、職場の言葉の壁をなくすWebアプリ",

  // Shokuba Connect (umbrella) strings.
  shokubaTitle: "職場コネクト",
  shokubaLead:
    "職場コネクトは、朝礼の連絡と面談の会話を、スタッフ一人ひとりの母国語に翻訳するWebアプリです。",
  choureiTagline:
    "朝礼の連絡事項を7言語に翻訳し、カードに保存して、そのままモニターに表示できます。",
  mendanName: "面談コネクト",
  mendanTagline:
    "面談での会話を、音声で双方向に翻訳します。評価や相談の場面で、言葉の壁を下げるための補助ツールです。",
  mendanComingLabel: "公開準備中",
  openButton: "開く",
  productHomeLead: "利用するサービスを選んでください。",
  // GC-06 layer 1: a free-tier account has provably never
  // bought credit, so paid models are disabled outright for it.
  freeTierNotice:
    "このアカウントにはクレジットがありません、無料モデルのご利用のみ。有料モデルを使うには、クレジットを追加してください。",
  creditFloorNotice:
    "クレジット残高が少なくなりました。有料モデルを使うには、クレジットを追加するか、無料モデルに切り替えてください。",
  mendanIntro:
    "面談コネクトは、スタッフと外国人スタッフの面談を、音声と文字で双方向に翻訳する製品です。現在、公開に向けて準備中です。",
  mendanPrinciples: [
    {
      title: "開始前に、双方が同意します",
      text: "セッションの前に、AIが翻訳すること、音声がブラウザの音声認識サービスで処理されること、本アプリが録音・保存をしないことを、双方の言語で伝え、同意を得てから開始します。",
    },
    {
      title: "大切な決定では、人の通訳への確認を促します",
      text: "契約に関わる評価、注意・指導、退職など、間違えられない内容に触れたときは、システムが警告を表示し、人の通訳に確認するよう促します。",
    },
    {
      title: "通訳の代わりではなく、補助です",
      text: "面談コネクトは通訳の補助ツールです。正式な場面では、人の通訳とあわせてご利用ください。",
    },
  ],
  backToTopLabel: "トップへ戻る",

  // The prohibition sentence: it lives in the gate's consent
  // box and above the translate button as the input helper text.
  gatePrivacyWarning: "個人情報・社内機密は入力しないでください。",

  // Context bar (labels from the PRD section 6 layout)
  industryLabel: "業種",
  industryValue: "自動車",
  // The dropdown's unselected prompt : the industry
  // became a required choice like division and topic — translation
  // stays disabled while this prompt is showing.
  industryPlaceholder: "業種を選択",
  // Shown as a disabled dropdown entry: the industry groundwork for
  // future support; automotive is the only working industry today.
  industryFoodProcessingSoon: "食品加工（準備中）",
  // "Coming soon" industries; the
  // manufacturing entry was renamed to 工業製品製造):
  // industrial-product manufacturing, construction, food
  // processing, others. All non-automotive entries stay disabled
  // placeholders.
  industryManufacturingSoon: "工業製品製造（準備中）",
  industryConstructionSoon: "建設（準備中）",
  industryOthersSoon: "その他（準備中）",
  divisionLabel: "部署",
  divisionPlaceholder: "例：組立",
  // Division and topic are required . The marker is a small red superscript asterisk that
  // ContextBar renders next to these two labels — it replaced the
  // （必須） suffix the same evening so the context bar, including
  // the delete-session button, fits on one line.
  topicLabel: "話題",
  topicPlaceholder: "例：ボルトの締め付け不足",

  // Input panel
  sourceLabel: "日本語（原文）",
  inputPlaceholder: "内容が正しく伝わるよう、文脈を含めて入力してください",
  helperText: "個人情報・社内機密は入力しないでください",
  charUnit: "文字",
  translateButton: "翻訳する",

  // Card sidebar (status names are the PRD's own terms)
  cardsTitle: "カード",
  statusEmpty: "空",
  statusSaved: "保存済み（未翻訳）",
  statusTranslated: "翻訳済み",
  statusStale: "要再翻訳",

  // Save button (from the PRD section 6 layout) and the save dialog
  //. The button both saves a new card and edits the
  // active one, and its label says so.
  saveButton: "保存・編集",
  // No longer a bare title: the heading is the guidance itself
  // — select a card, enter a title, save.
  saveDialogTitle: "空のカードを選択し、タイトルを入力して保存してください。",
  // The title became required (was 任意）.
  titleLabel: "タイトル（必須）",
  overwriteWarning: "このスロットには既にカードが保存されています。",
  overwriteButton: "上書きする",
  clearButton: "空にする",
  clearConfirmMessage: "このカードを空にしますか？",
  saveConfirmButton: "保存する",
  cancelButton: "キャンセル",

  // Delete session (the button name is the PRD's own term)
  deleteSessionButton: "セッションを削除",
  deleteSessionConfirmMessage:
    "セッションを削除しますか？保存したカードと入力内容はすべて消えます。",
  deleteConfirmButton: "削除する",

  // Shown in the context bar during the last hour before the
  // session cookie expires . {minutes} is replaced with the rounded minutes left.
  sessionExpiryWarning:
    "セッションの有効期限まで残り約{minutes}分です。期限が切れると、APIキーの入力が再度必要になります。",

  // Shown when sessionStorage refuses a write (storage quota handling)
  storageErrorMessage: "保存できませんでした（ストレージ容量不足）",

  // Guidance line above the card slots .
  cardsGuideText: "翻訳結果は、以下のカードに保存できます。",

  // API-key gate. The consent label and the start
  gateTitle: "OpenRouter APIキーの入力",
  // How the BYOK flow works and what happens to the key.
  gateGuide: [
    "このアプリは、利用者ご自身のOpenRouter APIキーで動作します。キーをお持ちでない方は、OpenRouterに登録のうえ、キーを作成してください。",
    "有料モデルをご利用いただくには、OpenRouterのアカウントへのクレジットのご入金が必要です。APIキーだけでは翻訳できません。",
    // GC-06 layer 2 guidance: a key limit makes the $1 floor
    // verifiable instead of assumed.
    "APIキーには上限額（キーリミット）の設定をおすすめします。キーの残り枠が少なくなると、有料モデルは自動で停止します。",
    // The free-model exception, stated before the operator starts
    //; it sits directly under the paid-model line above.
    "無料モデルを選んだ場合、入力した文章が提供元の学習に利用される場合があります。",
    "入力したAPIキーは、このブラウザのCookieにのみ保存されます（セッションの有効期間は24時間）。本アプリのサーバーやログに保存されることはなく、入力後に画面へ表示されることもありません。",
    "APIキーのセッションは24時間で自動的に終了します。終了後は、APIキーを入力し直すだけで再開できます。共有のパソコンをご利用の場合は、作業の終了時に必ず「セッションを削除」を押してください。",
  ],
  getKeyButton: "OpenRouterでキーを取得・確認する",
  // Separator between the start button and the key button, which
  // moved below it.
  gateOrText: "または",

  // Home (landing) screen shown before the key gate to visitors
  // without a stored key: one screen, no scroll, concise content
  // over the illustration. The headline and lead wording below is
  // fixed copy — do not reword it.
  // the "できること" heading is gone, the checks benefit was
  // deleted (two benefits remain, for a roomier screen), the first
  // benefit carries his new sentence (note HIS language order and
  // his タガログ語 naming in this sentence), the start button is
  // just 「始める」, and the steps + the note under the button moved
  // to the API-key gate screen.
  homeLead:
    "朝礼での連絡事項を、スタッフ一人ひとりの母国語にその場で翻訳し、モニターにそのまま表示できるWebアプリです。",
  homeFeatures: [
    {
      title: "7言語から選んで一括翻訳",
      text: "英語・ベトナム語・インドネシア語・ポルトガル語・中国語・タガログ語・ミャンマー語の７言語から、最大4言語を選んで、一度の操作でまとめて翻訳します。",
    },
    {
      title: "カードに保存して再利用",
      text: "準備した連絡事項は、カードとして保存できます。次回の朝礼では、カードを選ぶだけですぐに表示できます。",
    },
    {
      // Privacy by design: nothing typed is stored on the
      // app's server, and the key lives only in the
      // operator's own browser.
      title: "プライバシーを守る設計",
      text: "入力した文章が、本アプリのサーバーに保存されることはありません。APIキーはお使いのブラウザにのみ保存されます。",
    },
    {
      // The uncertainty feature: when the context is unclear, the
      // AI points out what needs confirming, like an AI
      // interpreter would.
      title: "確認が必要な点",
      text: "文脈があいまいな点があると、AIが「確認が必要な点」として知らせます。AI通訳のように確認を促すので、伝わり違いを防げます。",
    },
  ],
  // Bottom line of the home screen: the rotating provider logos
  // sit beside this text, credit style.
  homeAiCheckLine: "AIが確認します",
  // The usage steps and the note live on the GATE screen, not on
  // the home screen.
  homeStepsTitle: "使い方",
  homeSteps: [
    "OpenRouterでAPIキーを取得する",
    "APIキーを入力して開始する",
    "部署・テーマと連絡事項を入力し、翻訳する",
    "カードに保存し、朝礼で表示する",
  ],
  homeStartButton: "始める",
  homeNote:
    "※ご利用には、ご自身のOpenRouter APIキーが必要です。利用料金は、ご自身のAPIキーにのみ発生します。",
  // Shown instead of the key field when this browser already holds a
  // valid key cookie (e.g. a new tab on the same machine).
  storedKeyNote:
    "APIキーはこのブラウザに保存されています（有効期間内）。そのまま開始できます。",
  // Data-handling explanation on the gate : an enterprise reader must understand BEFORE
  // starting that this web app stores nothing on its server, that
  // work data lives only in this browser, and that the
  // delete-session button wipes it. Draft wording in the polished
  // register of the guide box.
  // Heading of the guide section inside the gate's merged
  // notices box .
  gateGuideTitle: "ご利用にあたって",
  // Hint under the start button while the consent is unchecked
  // .
  startConsentHint:
    "※開始するには、上記の「上記の注意事項を理解しました」へのチェックが必要です。",
  gatePrivacyTitle: "データの取り扱いについて",
  gatePrivacyNotes: [
    "本アプリは、入力した文章・翻訳結果・カードの内容をサーバーに保存しません。企業の情報と機密を守るための仕様です。",
    "翻訳のため、入力した文章はOpenRouterを通じてAIモデルへ送信されます。送信された文章が本アプリ側に蓄積・保存されることはありません。",
    "作業データは、すべてこのブラウザの中にのみ保持されます。「セッションを削除」を押すと、APIキー・カード・入力内容がこのブラウザから消去されます。",
    "カードに保存した内容は、APIキーのセッション（24時間）が終了しても消えません。再度APIキーを入力すれば、そのまま使い続けられます。",
    "残しておきたい翻訳結果は、念のためメモ帳やWordなど、別の文書にもコピーして保存してください。カードの内容が消えるのは、「セッションを削除」を押した場合のみです。",
  ],
  consentLabel: "上記の注意事項を理解しました",
  apiKeyLabel: "APIキー",
  apiKeyPlaceholder: "APIキーを貼り付けてください",
  // Show/hide toggle for the key field.
  apiKeyShow: "表示",
  apiKeyHide: "隠す",
  startButton: "開始",
  // Shown when the key check itself could not be completed (the
  // service did not answer), as opposed to a rejected key.
  gateServiceError:
    "サービスに接続できませんでした。しばらくしてからお試しください",
  networkErrorMessage: "通信に失敗しました",

  // Mock badge (PRD verbatim)
  mockBadge: "開発用モック（実際の翻訳ではありません）",

  // Translating state (PRD section 6). The cancel button reuses
  // cancelButton above.
  translatingLabel: "翻訳中…",

  // Output panels. The panel count words and the fullscreen
  // button names come from the PRD section 6 layout.
  displayLabel: "翻訳パネル数",
  panelCount1: "1枚",
  panelCount2: "2枚",
  panelCount3: "3枚",
  panelCount4: "4枚",
  // The input-column show/hide toggle in the context bar:
  // hiding leaves only the card rail beside the panels
  // (display mode for the big monitor).
  sidebarHideLabel: "入力欄を隠す",
  sidebarShowLabel: "入力欄を表示",
  // The sidebar toggle renders as two small lines in the
  // context bar (line 1 over line 2); the full labels above
  // remain its accessible name.
  sidebarToggleLine1: "入力欄",
  sidebarHideLine2: "（隠す）",
  sidebarShowLine2: "（表示）",
  // The panel language dropdown's unselected entry :
  // a panel in this state is never translated.
  panelLangSelectPrompt: "言語を選択",
  // Body text of a panel whose language has not been chosen yet.
  panelSelectLanguageHint: "言語を選択してください",
  // Text-to-speech buttons: shown only when the
  // device actually has a voice for the panel's language.
  speakButton: "読み上げ",
  speakStopButton: "停止",
  fullscreenButton: "全画面",
  // The fullscreen button's label while the panel IS fullscreen
  // .
  closeButton: "閉じる",
  // Per-panel translation font size buttons .
  fontSmallerLabel: "文字を小さく",
  fontLargerLabel: "文字を大きく",
  untranslatedLabel: "未翻訳",
  retryButton: "再試行",
  translatedButton: "翻訳済み",

  // Checks and notices. The three warning texts are PRD-verbatim.
  numberMismatchWarning: "数字が原文と一致しない可能性があります",
  // Per-panel warning when a prohibition in the source has no
  // matching marker in that panel's translation .
  prohibitionMissingWarning:
    "禁止の意味が訳文に含まれていない可能性があります",
  prohibitionWarning: "禁止表現を含みます。母語話者による確認を推奨します",
  glossarySkippedNotice: "用語集の一部が適用されませんでした",
  uncertainTitle: "確認が必要な点",
  // Fallback entries built by lib/uncertain.ts when a model returns
  // an "uncertain" entry in a language other than Japanese (rule 9
  // violation, seen live with Chinese entries). The
  // operator reads only Japanese, so the foreign text is never
  // shown; {phrase} is the source phrase the model quoted, when it
  // quoted one. Draft wording, like the other check notices.
  uncertainForeignWithPhrase:
    "「{phrase}」について確認が必要です。モデルが確認内容を日本語以外で返したため、そのままでは表示できません。原文のこの部分が何を指すかを確認し、必要に応じて具体的に書き直してください。",
  uncertainForeignGeneric:
    "原文に確認が必要な点があります。モデルが確認内容を日本語以外で返したため、そのままでは表示できません。原文全体を見直し、あいまいな部分がないか確認してください。",
  // Model picker: a rich listbox.
  llmLabel: "モデル",
  // The picker starts on this prompt with no model selected; every
  // translate action stays disabled until the operator picks one, so
  // no token cost can occur by accident .
  modelSelectPrompt: "言語モデルを選択",
  // Picker chips and notes for the rich model list (//: the picker shows provider logo + friendly name +
  // these badges, OpenRouter-list style, at .
  modelChipPaid: "有料",
  modelChipFree: "無料",
  modelChipValue: "割安",
  modelChipRecommended: "おすすめ",
  // One-line descriptions under a model's name in the picker, keyed
  // by model id. Only GPT-6 Luna carries one: a label describing
  // what it offers over Gemma 4, since it costs more.
  modelPickerNotes: {
    // Shortened at only the
    // price-tier phrase remains, shown beside the slug in the same
    // small size (the longer praise sentence was removed).
    "openai/gpt-6-luna": "Gemma 4より高価格帯のモデル",
  } as Record<string, string>,
  // Chip for a model that reasons before answering (GPT-6 Luna:
  // its reasoning tokens were measured in the review).
  modelChipReasoning: "推論",
  // Always-visible warning strip on the main screen while the free
  // model is the selected one: choosing that model is the
  // one case where the provider may train on the input text.
  freeModelWarning:
    "無料モデル使用中：入力した文章は、提供元が学習に利用される場合があります。機密情報は入力しないでください。",
  // Shown in a panel INSTEAD of its translate action when the
  // selected model does not support the panel's language;
  // "{language}" is replaced with the language's Japanese UI name.
  // A stored result from another model may still be displayed —
  // only new translation is blocked.
  unsupportedLanguageNotice:
    "このモデルは{language}に対応していないため、この言語は翻訳できません。",

  // Usage display.
  usageRemainingLabel: "残り",
  // GC-06 honest label: the capped-key figure is the KEY's
  // remaining allowance, not the account balance.
  usageKeyRemainingLabel: "キー残枠",
  usageTodayLabel: "本日利用額",

  // Error messages by API error code (lib/errors.ts). The first five
  // follow the PRD section 6 list; credits_or_quota is a draft.
  errors: {
    unauthorized: "APIキーが正しくありません",
    invalid_input: "入力が無効です",
    too_large: "入力が無効です",
    rate_limited: "利用制限に達しました。しばらくしてからお試しください",
    credits_or_quota: "クレジット残高が不足しています",
    llm_failed: "翻訳に失敗しました",
    timeout: "時間切れです",
    bad_output: "翻訳に失敗しました",
    // the free model's endpoint refused to serve — most
    // often because the key owner's own OpenRouter account does
    // not allow its data to be used for training.
    model_unavailable:
      "このモデルは現在利用できません。OpenRouterのアカウント設定で、データ利用が許可されているかご確認ください。",
  },
} as const;
