# ワークフロー機能 要件定義

## 背景

現状のワークフロー機能は、ワークフロー定義の保存や一部ノードの実行はできていますが、ユーザーが見る「ノードと線で構成されたワークフロー」と、サーバー側の実行ロジックがまだ一貫した仕組みになっていません。

大きな問題は、画面上ではノードとエッジでフローを表現している一方で、実行エンジンは保存されたエッジ構造をほぼ参照せず、ノード配列を順番に処理している点です。そのため、条件分岐、承認後の後続処理、ユーザーが編集したフロー構造が期待どおりに動かない可能性があります。

## 現状の実装

- ワークフローは `workflows` テーブルに保存され、`name`、`triggerType`、`status`、`definitionJson` を持つ。
- 承認は `approvals` テーブルに保存され、管理画面またはランタイム承認画面から承認・却下できる。
- レコード作成、更新、ステータス変更を契機に active なワークフローを起動できる。
- schedule ワークフローは、保護された internal cron endpoint から実行できる。
- 現在認識されているノード種別は `trigger`、`condition`、`approval`、`notification`、`status_update`、`api_call`、`ai_action`。
- ワークフローエディタでは、一覧表示、新規作成、保存、有効化、削除ができる。
- キャンバスでは既存の React Flow ノードを表示・移動できる。
- 通知ノードの設定は右側パネルから編集できる。
- ワークフローサービス、スケジューラ、ワークフロー/承認 API の既存テストは通っている。

## 確認済みのギャップ

### エディタ側のギャップ

- 選択、ノード追加、パン、ズームのツールボタンは見た目だけで、実際のモード切り替えやノード追加にはつながっていない。
- キャンバス上でエッジを作成・削除する編集フローがない。
- trigger、condition、approval、status_update、api_call、ai_action の設定インスペクタがない。
- ワークフロー名とトリガー種別をエディタ上で編集できない。
- 新規ワークフロー作成は現在のドラフト形状をコピーし、triggerType は `update` 固定になる。空テンプレートや承認テンプレートの明示的な選択がない。
- AI コマンドバーは見た目だけで、ワークフロー生成や差分適用には接続されていない。
- 有効化前にグラフ全体の検証エラーを表示する仕組みがない。

### 実行側のギャップ

- 実行時に保存済みのエッジグラフを辿っていない。ノード配列順に処理している。
- condition ノードはワークフロー全体の事前条件のように扱われ、`yes` / `no` エッジラベルは無視される。
- 既定フローは見た目上 `no` 分岐を持つが、条件が false の場合は `no` 側へ進まず、ワークフロー全体がスキップされる。
- notification、status_update、api_call、ai_action は、グラフ上で到達したときではなく、ノード配列上で見つかったときに実行される。
- approval ノードは pending approval を作成するが、そこでワークフロー実行を一時停止し、承認後に後続ノードを再開する仕組みがない。
- 「承認判断後に通知する」と見える通知ノードが、承認判断前に実行される可能性がある。
- 既存の重複承認チェックは workflow + record 単位であり、workflow node / run 単位ではない。そのため、1つのワークフロー内に複数の承認ノードを置けない。
- ワークフロー実行インスタンスやノード実行状態が永続化されていない。
- webhook trigger type はモデル上存在するが、実際の受信エンドポイントはまだない。

### テストのギャップ

- 既存テストは、保存、単純な承認作成、ステータス更新ノード、スケジューラ起動、API route 接続をカバーしている。
- エッジ走査、yes/no 分岐、承認後の再開、複数承認ノード、エディタ操作、AI コマンド適用はテストされていない。

## 目標要件

## 追加前提: アプリ単位の承認ポリシー

承認は基本的に workflow node に閉じた設定ではなく、アプリに紐づく承認ポリシーとして扱う。workflow の approval node は、必要に応じてアプリ承認ポリシーを参照して承認を発生させる。

この前提により、承認者、承認方式、承認後ステータス、却下後ステータス、承認時に変更するレコード内容、承認状況別 View は、アプリ単位で一貫して管理する。

### A1. アプリ承認設定

- アプリごとに承認機能を有効/無効にできる。
- アプリごとに複数の承認者を設定できる。
- 承認者は user 単位、role 単位、または app role assignment 単位で指定できる。
- 承認者には表示順、必須/任意、代理可否、有効/無効を設定できる。
- 承認方式を選択できる。
- `any`: 承認者のうち1人が承認すれば完了。
- `all`: 全承認者の承認が必要。
- `sequential`: 承認者の順番どおりに承認する。
- `quorum`: N人以上の承認で完了。
- 承認依頼タイトル・本文テンプレートをアプリ単位で設定できる。
- 承認依頼の対象テーブルを指定できる。未指定の場合はアプリ内の主要テーブルを対象とする。
- 承認依頼を作成する条件を設定できる。例: status が `submitted`、金額が一定以上、特定フィールドが変更された場合。
- 既定の pending status、approved status、rejected status、returned status を設定できる。
- 承認設定は公開済みアプリの version snapshot に含める。

### A2. アプリ承認データモデル

- `app_approval_settings` 相当の設定を持つ。
- 主な項目: `tenantId`、`appId`、`enabled`、`approvalMode`、`targetTableId`、`pendingStatus`、`approvedStatus`、`rejectedStatus`、`returnedStatus`、`requestTitleTemplate`、`requestBodyTemplate`、`conditionJson`、`postApprovalActionsJson`。
- `app_approval_approvers` 相当の承認者リストを持つ。
- 主な項目: `settingId`、`approverType`、`userId`、`roleId`、`roleType`、`sortOrder`、`required`、`active`。
- 既存の `approvals` は app-scoped approval request として拡張する。
- `approvals` には、単一 `approverId` だけでなく、承認グループまたは承認ステップを表現できる構造が必要。
- 複数承認者に対応するため、`approval_steps` または `approval_assignees` 相当の子テーブルを追加する。
- 各承認者の判断履歴として、status、comment、actedAt、actedById を個別に保持する。
- 既存 approval record は後方互換で読み込める。

### A3. 承認ライフサイクル

- 対象レコードが承認条件を満たすと、アプリ承認設定から approval request を作成する。
- approval request 作成時、対象レコードの status を pending status に変更する。
- `sequential` の場合、現在ステップの承認者だけに通知する。
- `any` / `all` / `quorum` の場合、対象承認者へ同時に通知する。
- 承認者ごとの判断を記録し、承認方式に応じて全体の approval status を算出する。
- 全体が approved になった場合、対象レコードを approved status に変更する。
- 全体が rejected になった場合、対象レコードを rejected status に変更する。
- 差戻しを使う場合、対象レコードを returned status に変更し、申請者が再申請できる。
- 承認完了後、同じレコードに未完了 approval が残らないようにする。
- 再申請時は新しい approval request を作成し、過去の approval request は履歴として残す。

### A4. 承認後ステータスとレコード更新

- 承認後、却下後、差戻し後に実行する record update action をアプリ承認設定に定義できる。
- 更新対象は以下を選べる。
- 現在の対象レコード。
- 同じアプリ内の指定テーブル・指定レコード。
- 対象レコードの master_ref / user_ref / lookup field から辿れる関連レコード。
- 条件に一致する同一テーブル内のレコード。ただし一括更新は件数上限と確認を必須にする。
- 更新内容は以下を設定できる。
- `status` の変更。
- 任意 field の値設定。
- 承認者名、承認日時、承認コメント、却下理由の書き込み。
- boolean flag の切り替え。
- number field の加算/減算。
- date/datetime field への現在日時設定。
- 更新前後の値を audit log に記録する。
- 関連レコード更新で権限不足や対象不明が起きた場合の failure policy を設定できる。
- `fail`: 承認完了処理を失敗としてロールバックまたはエラーにする。
- `continue`: 承認は完了し、更新失敗を audit log と通知に残す。
- 承認後更新は冪等にし、同じ approval decision の再送で二重更新しない。

### A5. ステータス View

- アプリ承認設定を有効にしたとき、対象テーブルに承認状況別 View を自動作成できる。
- 最低限、以下の View を生成できる。
- 申請前 / Draft: `status in draft/open/active` など、承認前の作業中レコード。
- 承認待ち / Pending Approval: `status = pendingStatus`。
- 承認済み / Approved: `status = approvedStatus`。
- 却下 / Rejected: `status = rejectedStatus`。
- 差戻し / Returned: `status = returnedStatus`。
- 自分の承認待ち: approval assignee が自分、かつ approval status が pending。
- 自分が申請した承認: requester が自分。
- View は既存の `AppView` として保存し、`settingsJson.filters` に status / approval 条件を持たせる。
- 既存 View と名前が重複する場合は更新するか、サフィックスを付けて作成する。
- 承認ステータス名を変更した場合、関連 View の filter も同期更新できる。
- View 自動生成は初回のみ、または「再生成」ボタンで明示的に実行する。
- Runtime では承認 View を通常の一覧 View と同じ導線から選べる。

### A6. アプリ設定 UI / API

- `/apps/:id/settings` または専用 `/apps/:id/approvals` に承認設定タブを追加する。
- UI では承認機能の有効化、承認者追加/削除/並び替え、承認方式、対象テーブル、条件、ステータス、承認後アクション、View 自動生成を設定できる。
- 承認者はユーザー検索、ロール選択、既存 app role assignment から選べる。
- ステータスは自由入力ではなく、候補管理または select field 連携を優先する。
- 承認後アクションはプレビューできる。
- 保存前に、対象 field / table / user / role の存在検証を行う。
- API は以下を提供する。
- `GET /api/apps/:appId/approval-settings`
- `PUT /api/apps/:appId/approval-settings`
- `POST /api/apps/:appId/approval-settings/generate-views`
- `POST /api/run/:appCode/:table/:recordId/submit-approval`
- `POST /api/approvals/:approvalId/approve`
- `POST /api/approvals/:approvalId/reject`
- `POST /api/approvals/:approvalId/return`

### R1. ワークフロー定義モデル

- ワークフロー定義は、一意な node と edge を持つ。
- 各 edge は存在する source / target node を参照する。
- 通常実行用の entry trigger node は原則1つにする。
- 有効化前に、node type ごとの config を検証する。
- 既存の workflow definition は後方互換で読み込める。
- 将来の node metadata 拡張に耐えられる schema にする。

### R2. ワークフローエディタ

- ユーザーは空テンプレートまたは承認テンプレートからワークフローを作成できる。
- ユーザーはワークフロー名、trigger type、draft/active status を編集できる。
- ユーザーはキャンバス上で node の追加、移動、複製、削除、接続ができる。
- ユーザーは edge の削除とラベル編集ができる。
- ユーザーは全 node type の設定を編集できる。
- Trigger: trigger type、任意の table scope。
- Condition: field code、operator、expected value、branch label。
- Approval: 参照するアプリ承認ポリシー、必要な場合のみ一時的な override。承認者や基本ステータスは原則アプリ承認設定から解決する。
- Notification: recipient、title/body template、dedupe key、failure policy。
- Status update: target status。
- API call: URL、method、headers/body template、timeout、failure policy。
- AI action: action type、model/prompt key、output destination、failure policy。
- 保存・有効化前に、エディタ上で検証エラーを表示する。
- AI コマンドバーは Prompt to Workflow として実装するか、未実装であることが分かる状態にする。

### R3. 実行セマンティクス

- 実行時は trigger node から開始し、edge を辿って graph traversal する。
- condition node は評価結果に応じて次の edge を選択する。
- side-effect node は graph 上で到達した場合のみ実行する。
- approval node は承認判断が終わるまで workflow run を一時停止する。
- 承認・却下後は、設定された approved/rejected branch から workflow run を再開する。
- ワークフロー実行は決定的で、監査可能である。
- 同じレコードイベントで複数ワークフローが起動した場合、それぞれ独立して実行される。
- 1つのワークフロー内に複数の approval node を置ける。

### R4. トリガー

- record create、update、status_change は record service から自動起動する。
- schedule workflow は保護された cron endpoint から実行できる。
- webhook workflow は、record context を作成または解決して実行開始できる受信 endpoint を持つ。
- manual run はテスト・運用用途として残す。
- trigger node は任意で table scope を指定できる。

### R5. 承認フロー

- pending approval には app approval setting id、workflow id、workflow node id、record id、requester、approver group、title、description、run context を持たせる。
- 承認作成時、対象レコードをアプリ承認設定の pending status に移動する。
- 承認・却下時、アプリ承認設定に応じて approved/rejected/returned status に移動する。
- 複数承認者の判断を approval step / assignee 単位で保持する。
- 承認方式に応じて、全体の approval status を算出する。
- 承認完了時に、設定された record update action を実行する。
- 承認判断時は system comment と audit log を作成する。
- approver には in-app approval notification を送る。
- requester と設定された stakeholder には、必要に応じて判断結果通知を送る。

### R6. 通知

- 通知先は明示 user、role、または runtime actor fallback を指定できる。
- 通知の title/body/dedupe key では、`appCode`、`tableName`、`recordId`、`recordTitle` などのテンプレート変数を使える。
- 通知失敗時の挙動は node ごとに continue / fail を設定できる。
- 通知結果は audit log に記録する。

### R7. 監査・可観測性

- workflow create/update/delete/run は audit log に記録する。
- 各 node execution は success、skip、failure、主要な input/output metadata を記録する。
- required node が失敗した場合、workflow run を停止し、読みやすいエラーを表示する。
- 運用者は record または workflow 単位で直近の workflow run を確認できる。

### R8. RBAC

- ワークフローエディタの閲覧には `workflow:read` が必要。
- ワークフローの作成、更新、削除、有効化、手動実行には `workflow:manage` が必要。
- 承認判断には `approval:manage` が必要。
- ランタイムの record access は既存の app/table/record 権限に従う。

### R9. 互換性

- 既存の default approval workflow は引き続き読み込める。
- 既存の approval record は引き続き承認・却下できる。
- run state metadata を持たない既存 workflow は、新エンジン上で best-effort の graph traversal により実行できる。
- schema migration が必要な場合は、可能な限り additive にする。

## 受け入れ条件

- アプリ設定で承認機能を有効化し、複数承認者を user / role から設定できる。
- 承認方式 `any`、`all`、`sequential`、`quorum` のうち少なくとも MVP 対象方式が期待どおりに approval status を算出する。
- 承認対象レコードが条件を満たした場合、アプリ承認設定に基づいて pending approval が作成される。
- pending approval 作成時、対象レコードがアプリ設定の pending status に変更される。
- 承認完了時、対象レコードが approved status に変更され、設定された field update が1回だけ実行される。
- 却下時、対象レコードが rejected status に変更され、却下理由が system comment / audit log に残る。
- 差戻しを使う場合、対象レコードが returned status に変更され、再申請できる。
- 承認設定から Pending / Approved / Rejected / Returned / 自分の承認待ち View を生成できる。
- 承認ステータス設定を変更した場合、生成済みステータス View の filter を同期または再生成できる。
- レコード作成時、active な create workflow が起動し、graph path が approval node に到達した場合のみ pending approval が作成される。
- レコード更新時、active な update workflow が起動し、condition の `yes` / `no` edge を正しく辿る。
- condition false path で workflow 全体を skip せず、notification/status/API/AI node を実行できる。
- approval node の後ろに置いた notification は、承認または却下の判断後、設定された branch に従って実行される。
- 2つの approval node を持つ workflow で、それぞれの承認を独立して作成・判断できる。
- エディタ上で node 移動と edge 作成を行い、保存・再読み込み後も同じ graph shape で表示・実行できる。
- 不正な workflow を有効化しようとした場合、具体的な検証エラーでブロックされる。
- Prompt to Workflow は preview/apply 付きで機能するか、未利用状態が明確に分かる。
- unit test で graph traversal、branch selection、approval suspend/resume、duplicate approval scoping、node validation をカバーする。
- E2E test で editor save/reload、record-triggered approval、approval decision continuation、runtime approval list をカバーする。

## 推奨実装順

1. アプリ承認設定のデータモデルを追加する。
2. 複数承認者を表現する approval step / assignee モデルを追加する。
3. `/apps/:id/approval-settings` の API と UI を実装する。
4. アプリ承認設定に基づく approval request 作成ロジックを実装する。
5. 承認方式 `any`、`all`、`sequential`、`quorum` の判定ロジックを実装する。
6. 承認後ステータス変更と record update action を実装する。
7. ステータス View 自動生成・再生成を実装する。
8. node id、edge、trigger 数、node type ごとの config を検証する workflow definition validator を追加する。
9. workflow service に graph traversal を実装し、node 配列順への依存をやめる。
10. workflow run state を追加し、approval node で一時停止・再開できるようにする。
11. approval record と workflow node/run identity を紐づける。
12. エディタで node 追加、接続、削除、全 node config 編集を完成させる。
13. AI command bar を接続するか、未実装状態として明確に無効化する。
14. webhook trigger endpoint を追加する。
15. app approval、graph execution、editor flow のテストを追加する。

## 今回の修復パスでは対象外

- 内部常駐 scheduler daemon。既存の外部 cron endpoint 方式は維持してよい。
- 既存の in-app notification を超える Slack / Teams 連携。
- 初回修復に必須でない高度な visual run replay。
