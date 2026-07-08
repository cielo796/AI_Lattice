export const GUIDE_STORAGE_KEY = "ai-lattice:beginner-guide:v1";
export const GUIDE_ANCHOR_ATTRIBUTE = "data-guide";

export type GuidePlacement = "top" | "right" | "bottom" | "left" | "center";

export interface GuideStepCondition {
  all?: string[];
  any?: string[];
  none?: string[];
}

export interface GuideStep {
  id: string;
  title: string;
  body: string;
  selector: string;
  placement?: GuidePlacement;
  condition?: GuideStepCondition;
}

export interface GuideTour {
  id: string;
  label: string;
  routePatterns: string[];
  steps: GuideStep[];
}

function anchor(name: string) {
  return `[${GUIDE_ANCHOR_ATTRIBUTE}="${name}"]`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function routePatternMatches(pattern: string, pathname: string) {
  const normalizedPathname = pathname.replace(/\/$/, "") || "/";
  const normalizedPattern = pattern.replace(/\/$/, "") || "/";
  const segments = normalizedPattern.split("/").map((segment) => {
    if (!segment) {
      return "";
    }

    if (segment === "*") {
      return ".*";
    }

    if (segment.startsWith("[") && segment.endsWith("]")) {
      return "[^/]+";
    }

    return escapeRegExp(segment);
  });

  return new RegExp(`^${segments.join("/")}$`).test(normalizedPathname);
}

function conditionMatches(
  condition: GuideStepCondition | undefined,
  anchors: ReadonlySet<string>
) {
  if (!condition) {
    return true;
  }

  if (condition.all?.some((item) => !anchors.has(item))) {
    return false;
  }

  if (condition.any && condition.any.length > 0) {
    return condition.any.some((item) => anchors.has(item));
  }

  if (condition.none?.some((item) => anchors.has(item))) {
    return false;
  }

  return true;
}

export function getGuideTourForPathname(pathname: string | null | undefined) {
  if (!pathname) {
    return null;
  }

  if (/^\/run\/[^/]+\/approvals\/?$/.test(pathname)) {
    return GUIDE_TOURS.find((tour) => tour.id === "approvals") ?? null;
  }

  return GUIDE_TOURS.find((tour) =>
    tour.routePatterns.some((pattern) => routePatternMatches(pattern, pathname))
  ) ?? null;
}

export function getGuideTourById(tourId: string | null | undefined) {
  if (!tourId) {
    return null;
  }

  return GUIDE_TOURS.find((tour) => tour.id === tourId) ?? null;
}

export function getVisibleGuideSteps(
  tour: GuideTour | null | undefined,
  anchors: ReadonlySet<string>
) {
  if (!tour) {
    return [];
  }

  return tour.steps.filter((step) => conditionMatches(step.condition, anchors));
}

export const GUIDE_TOURS: GuideTour[] = [
  {
    id: "home",
    label: "ホーム",
    routePatterns: ["/home"],
    steps: [
      {
        id: "home-create",
        title: "まずはアプリを作成します",
        body: "業務アプリを追加する入口です。AI に作りたい内容を伝えると、テーブルや項目のたたき台を作成できます。",
        selector: anchor("home-create-app"),
        placement: "bottom",
      },
      {
        id: "home-empty",
        title: "最初のアプリを作りましょう",
        body: "まだアプリがない状態です。左上またはこの画面の作成ボタンから、最初のアプリ作成に進みます。",
        selector: anchor("home-empty-state"),
        placement: "top",
        condition: { any: ["home-empty-state"] },
      },
      {
        id: "home-stats",
        title: "全体の状況を確認します",
        body: "レコード数、承認待ち、AI 実行状況など、運用中の状態をここで素早く確認できます。",
        selector: anchor("home-stats"),
        placement: "bottom",
        condition: { any: ["home-stats"] },
      },
      {
        id: "home-app-card",
        title: "アプリを開きます",
        body: "アプリカードから実行画面や設定へ移動します。日常の入力作業はアプリを開いて始めます。",
        selector: anchor("home-app-card"),
        placement: "top",
        condition: { any: ["home-app-card"] },
      },
      {
        id: "home-sidebar",
        title: "左メニューから移動できます",
        body: "現在のアプリに応じて、テーブル、ワークフロー、承認、設定などの画面へ移動できます。",
        selector: anchor("sidebar-nav"),
        placement: "right",
      },
    ],
  },
  {
    id: "ai-builder",
    label: "AI アプリ作成",
    routePatterns: ["/apps/new/ai"],
    steps: [
      {
        id: "ai-prompt",
        title: "作りたいアプリを文章で伝えます",
        body: "業務名、管理したい項目、承認が必要な条件などを自然文で入力します。あとから修正できるので、最初は大まかで大丈夫です。",
        selector: anchor("ai-builder-prompt"),
        placement: "bottom",
      },
      {
        id: "ai-generate",
        title: "設計案を生成します",
        body: "入力内容から、アプリ、テーブル、フィールドの設計案を作成します。",
        selector: anchor("ai-builder-generate"),
        placement: "left",
      },
      {
        id: "ai-blueprint",
        title: "生成結果を確認します",
        body: "生成後は設計案を確認し、必要に応じてテーブル名や項目を調整して保存します。",
        selector: anchor("ai-builder-blueprint"),
        placement: "top",
        condition: { any: ["ai-builder-blueprint"] },
      },
    ],
  },
  {
    id: "runtime-app",
    label: "アプリトップ",
    routePatterns: ["/run/[appCode]"],
    steps: [
      {
        id: "runtime-summary",
        title: "このアプリの入口です",
        body: "アプリの概要、テーブル数、承認待ち件数を確認できます。",
        selector: anchor("runtime-app-summary"),
        placement: "bottom",
      },
      {
        id: "runtime-actions",
        title: "関連画面へ移動します",
        body: "ダッシュボードでは集計、承認では承認待ちの判断、テーブルでは日々のレコード入力を行います。",
        selector: anchor("runtime-app-actions"),
        placement: "left",
      },
      {
        id: "runtime-tables",
        title: "入力するテーブルを選びます",
        body: "テーブルを開くと、レコードの一覧表示、作成、編集ができます。",
        selector: anchor("runtime-table-list"),
        placement: "top",
      },
    ],
  },
  {
    id: "runtime-dashboard",
    label: "ダッシュボード",
    routePatterns: ["/run/[appCode]/dashboard"],
    steps: [
      {
        id: "dashboard-summary",
        title: "アプリ全体の数値を確認します",
        body: "レコード件数、承認待ち、テーブル数など、運用状況の入口になる数値です。",
        selector: anchor("runtime-dashboard-summary"),
        placement: "bottom",
      },
      {
        id: "dashboard-table",
        title: "テーブル別の状況を見ます",
        body: "各テーブルの集計や分布を確認し、必要なテーブルへ移動できます。",
        selector: anchor("runtime-dashboard-table"),
        placement: "top",
        condition: { any: ["runtime-dashboard-table"] },
      },
    ],
  },
  {
    id: "runtime-table",
    label: "レコード操作",
    routePatterns: ["/run/[appCode]/[table]"],
    steps: [
      {
        id: "record-create",
        title: "新しいレコードを作成します",
        body: "申請や案件など、新しいデータを登録する時に使います。権限がない場合はボタンが無効になります。",
        selector: anchor("runtime-record-create-button"),
        placement: "bottom",
      },
      {
        id: "record-view-tabs",
        title: "表示方法を切り替えます",
        body: "一覧、カンバン、カレンダー、集計など、作業に合わせて View を切り替えます。",
        selector: anchor("runtime-view-tabs"),
        placement: "bottom",
        condition: { any: ["runtime-view-tabs"] },
      },
      {
        id: "record-empty",
        title: "まずはレコードを追加します",
        body: "まだデータがない状態です。新規レコードを作成すると、ここに一覧として表示されます。",
        selector: anchor("runtime-empty-records"),
        placement: "top",
        condition: { any: ["runtime-empty-records"] },
      },
      {
        id: "record-list",
        title: "レコードを選びます",
        body: "一覧からレコードを選ぶと、詳細確認、コメント、添付、承認申請ができます。",
        selector: anchor("runtime-record-card"),
        placement: "right",
        condition: { any: ["runtime-record-card"] },
      },
      {
        id: "record-form",
        title: "入力フォームです",
        body: "必要な項目を入力して保存します。フォーム設定で表示項目や補助文を調整できます。",
        selector: anchor("runtime-record-form"),
        placement: "top",
        condition: { any: ["runtime-record-form"] },
      },
      {
        id: "record-detail",
        title: "詳細と履歴を確認します",
        body: "レコードの内容、コメント、添付ファイル、承認状況をまとめて確認できます。",
        selector: anchor("runtime-record-detail"),
        placement: "left",
        condition: { any: ["runtime-record-detail"] },
      },
      {
        id: "record-approval",
        title: "承認申請を行います",
        body: "承認設定が有効なアプリでは、ここから承認依頼を作成します。承認待ちがある時は重複申請を防ぎます。",
        selector: anchor("runtime-approval-panel"),
        placement: "top",
        condition: { any: ["runtime-approval-panel"] },
      },
      {
        id: "record-ai",
        title: "AI が作業を補助します",
        body: "選択中のレコードに応じて、要約や次のアクションの候補を確認できます。",
        selector: anchor("runtime-ai-panel"),
        placement: "left",
        condition: { any: ["runtime-ai-panel"] },
      },
    ],
  },
  {
    id: "builder-tables",
    label: "テーブル設計",
    routePatterns: ["/apps/[appId]/tables"],
    steps: [
      {
        id: "table-sidebar",
        title: "テーブルを選びます",
        body: "アプリ内のテーブル一覧です。テーブルを選ぶと、右側でフィールド、View、フォームを設定できます。",
        selector: anchor("builder-table-sidebar"),
        placement: "right",
      },
      {
        id: "table-form",
        title: "テーブルを追加・編集します",
        body: "業務で管理したいデータ単位をテーブルとして作成します。例: 経費申請、社員、取引先。",
        selector: anchor("builder-table-form"),
        placement: "right",
      },
      {
        id: "view-section",
        title: "View を作ります",
        body: "Runtime の見え方を設定します。ステータス別、承認待ち、カレンダーなどの一覧を作れます。",
        selector: anchor("builder-view-section"),
        placement: "left",
      },
      {
        id: "form-section",
        title: "入力フォームを整えます",
        body: "レコード作成・編集時に表示する項目や順番を設定します。",
        selector: anchor("builder-form-section"),
        placement: "left",
      },
      {
        id: "field-form",
        title: "フィールドを追加します",
        body: "テキスト、日付、数値、選択肢、参照など、レコードに保存する項目を定義します。",
        selector: anchor("builder-field-form"),
        placement: "top",
      },
      {
        id: "field-list",
        title: "フィールド一覧を確認します",
        body: "作成済みの項目を確認し、必要に応じて編集・削除します。",
        selector: anchor("builder-field-list"),
        placement: "top",
      },
    ],
  },
  {
    id: "app-settings",
    label: "アプリ設定",
    routePatterns: ["/apps/[appId]/settings"],
    steps: [
      {
        id: "settings-basic",
        title: "基本情報を設定します",
        body: "アプリ名、説明、アイコンなど、利用者に見える基本情報を編集します。",
        selector: anchor("app-settings-basic"),
        placement: "bottom",
      },
      {
        id: "approval-card",
        title: "承認をアプリに紐づけます",
        body: "このアプリで承認申請を受け付けるか、対象テーブルや承認方式を設定します。",
        selector: anchor("app-settings-approval"),
        placement: "top",
      },
      {
        id: "approval-toggle",
        title: "承認受付を有効にします",
        body: "チェックを入れると、対象テーブルのレコードから承認申請できるようになります。",
        selector: anchor("app-settings-approval-toggle"),
        placement: "right",
      },
      {
        id: "approval-approvers",
        title: "承認者を追加します",
        body: "個別ユーザーまたはロールのどちらか一方を選び、承認者を設定します。",
        selector: anchor("app-settings-approval-approvers"),
        placement: "right",
      },
      {
        id: "approval-statuses",
        title: "判定後のステータスを決めます",
        body: "申請中、承認完了、却下、差戻しのステータス名を指定します。View の絞り込みにも使います。",
        selector: anchor("app-settings-approval-statuses"),
        placement: "top",
      },
      {
        id: "approval-templates",
        title: "承認依頼の文面を整えます",
        body: "{{recordTitle}} はレコード名、{{tableName}} はテーブル名に置き換わります。承認者が判断しやすい件名と本文にします。",
        selector: anchor("app-settings-approval-templates"),
        placement: "top",
      },
      {
        id: "approval-actions",
        title: "判定後のレコード変更です",
        body: "保存先フィールドと、承認・却下・差戻しごとに自動保存する値を指定します。",
        selector: anchor("app-settings-approval-actions"),
        placement: "top",
      },
      {
        id: "approval-save",
        title: "設定を保存します",
        body: "承認者やステータスを変更したら保存します。必要に応じてステータス別 View も作成できます。",
        selector: anchor("app-settings-approval-save"),
        placement: "top",
      },
    ],
  },
  {
    id: "workflow-editor",
    label: "ワークフロー",
    routePatterns: ["/apps/[appId]/workflows"],
    steps: [
      {
        id: "workflow-list",
        title: "ワークフローを選びます",
        body: "このアプリに紐づくワークフロー一覧です。新規作成や既存ワークフローの選択を行います。",
        selector: anchor("workflow-list"),
        placement: "right",
      },
      {
        id: "workflow-save",
        title: "保存または有効化します",
        body: "下書き保存と有効化を使い分けます。有効化したワークフローだけが運用に反映されます。",
        selector: anchor("workflow-save-actions"),
        placement: "bottom",
      },
      {
        id: "workflow-canvas",
        title: "処理の流れを確認します",
        body: "トリガー、条件、承認、通知などのノードを線でつないで、処理の順番を表します。",
        selector: anchor("workflow-canvas"),
        placement: "center",
      },
      {
        id: "workflow-details",
        title: "選択中の設定を調整します",
        body: "右側では通知先やメッセージなど、選択中のワークフロー設定を編集します。",
        selector: anchor("workflow-details"),
        placement: "left",
        condition: { any: ["workflow-details"] },
      },
    ],
  },
  {
    id: "approvals",
    label: "承認一覧",
    routePatterns: ["/admin/approvals", "/run/[appCode]/approvals"],
    steps: [
      {
        id: "approval-summary",
        title: "承認状況の概要です",
        body: "承認待ち件数や選択中の承認を確認します。急ぎの判断が必要なものを見つけやすくします。",
        selector: anchor("approvals-summary"),
        placement: "bottom",
        condition: { any: ["approvals-summary"] },
      },
      {
        id: "approval-filters",
        title: "表示する承認を絞り込みます",
        body: "承認待ち、承認済み、却下、差戻しなど、確認したい状態で一覧を切り替えます。",
        selector: anchor("approvals-filters"),
        placement: "bottom",
      },
      {
        id: "approval-list",
        title: "承認依頼を選びます",
        body: "一覧から依頼を選択すると、右側に詳細と判定ボタンが表示されます。",
        selector: anchor("approvals-list"),
        placement: "right",
      },
      {
        id: "approval-detail",
        title: "内容を確認して判断します",
        body: "申請者、対象レコード、承認者、コメントを確認し、承認・却下・差戻しを選びます。",
        selector: anchor("approvals-detail"),
        placement: "left",
      },
      {
        id: "approval-actions",
        title: "判定を登録します",
        body: "必要に応じてコメントを残してから、承認・却下・差戻しを実行します。",
        selector: anchor("approvals-actions"),
        placement: "top",
        condition: { any: ["approvals-actions"] },
      },
    ],
  },
  {
    id: "admin-generic",
    label: "管理画面",
    routePatterns: [
      "/apps/[appId]/permissions",
      "/admin/users",
      "/admin/roles",
      "/admin/tenant",
      "/admin/openai",
      "/admin/prompt-templates",
      "/admin/ai-logs",
      "/admin/audit-logs",
      "/notifications",
      "/settings/profile",
      "/tenants",
    ],
    steps: [
      {
        id: "admin-topbar",
        title: "画面名と現在位置を確認します",
        body: "上部には現在の画面やパンくずが表示されます。右上から通知や設定にも移動できます。",
        selector: anchor("topbar"),
        placement: "bottom",
      },
      {
        id: "admin-content",
        title: "この画面の設定を確認します",
        body: "管理画面では、ユーザー、権限、テナント、OpenAI 設定、監査ログなどを確認・更新します。",
        selector: anchor("page-content"),
        placement: "center",
      },
      {
        id: "admin-sidebar",
        title: "管理メニューを切り替えます",
        body: "左メニューから、他の管理画面やアプリ画面へ移動できます。",
        selector: anchor("sidebar-nav"),
        placement: "right",
      },
    ],
  },
];
