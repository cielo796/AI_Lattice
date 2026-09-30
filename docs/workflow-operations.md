# ワークフローの永続実行と復旧

## 保存と実行待ち

レコードの作成・更新、監査ログ、該当する有効ワークフローの `workflow_runs` 登録を同じDBトランザクションで保存します。登録が失敗した場合、レコードも保存しません。更新は対象レコードをロックし、同時のステータス変更とデータ変更が互いに古い値へ戻らないようにします。

`ready` の実行行が永続outboxです。別のイベントテーブルは不要です。登録時の定義とレコード状態を保存し、最初の条件判定は後の編集値ではなく、そのイベントの値を使います。実行内のステータス更新・承認・AIフィールド出力、および承認判断からの再開時にレコードsnapshotを更新します。

既定では保存後にその場で実行します。保存後のDB接続障害などでdispatchできない場合も、保存済みレコードを成功として返します。レスポンスの `workflowRunIds` で実行を追跡でき、`workflowDispatchPending: true` の場合は実行待ちです。クライアントに保存済みレコードの再作成を求めません。

`WORKFLOW_INLINE_DISPATCH=false` なら保存後の実行をworkerへ任せます。この設定は、以下のworkerを定期実行してから有効にしてください。アプリ内の常駐workerや自動cron登録は行いません。

## Workerの起動

1. `app/` で `npm run db:migrate:deploy` を実行します。16番目のmigrationが実行権の列と索引を追加します。
2. 実行環境に32文字以上のランダムな `CRON_SECRET` を設定します。未設定・短すぎる値・サンプルの置換前の値は503になります。秘密はソースやGitへ入れません。
3. 信頼できる外部schedulerから、毎分程度、次のendpointをPOSTします。Cookieログインだけでは呼び出せません。

```powershell
Invoke-RestMethod -Method Post -Uri "https://your-host/api/internal/workflows/dispatch?limit=10" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

`limit` は1〜50、既定10です。古い `ready` と判断済みの「現在の」承認待ちを優先します。未判断の承認を大量に残していても実行待ちを塞ぎません。同じendpointを複数workerが呼んでも実行権を取れたworkerだけが処理します。長いグラフは45秒の実行枠を超えるとノードのcheckpoint間で `ready` へ戻し、次回workerへ引き継ぎます。実行途中のノードを打ち切って再送するものではありません。

レスポンスは `recovered`（期限切れ回復）、`processed`（処理後の状態）、`failures`（インフラ等のdispatchエラー）です。`processed` はすべて成功という意味ではなく、`failed`・`waiting`・`interrupted` も含みます。dispatchエラーがある場合は207、その他は200です。監視はHTTPだけでなく実行状態も確認してください。次のノード開始まで待つ長時間の処理があるため、ホスティング側の実行時間上限も確認します。

スケジュール用endpointも同じ `CRON_SECRET` の条件で保護します。`schedules/run` はscheduleイベントの登録・実行用、`dispatch` は永続実行待ち・承認再開・停止回復用です。workerがscheduleを自動作成するわけではありません。

## 実行権と停止回復

- 実行権はランダムtokenと5分の期限で管理します。期限はDBの時計で延長し、DB接続はUTCに統一します。
- ノードを実行する前に実行行をロックし、tokenが自分のものか確認します。副作用とcheckpointを同じトランザクションで確定します。停止回復側は `SKIP LOCKED` により実行中のノードのDBトランザクションを避けます。
- 旧workerのtokenではcheckpoint・完了・失敗を書き換えられません。承認待ち・完了・失敗・結果確認待ちでは実行権を解放します。
- 停止時に未確定だったtrigger・condition・approval・notification・status_updateはDB内の変更とcheckpointが原子的なため、期限切れ後にworkerが安全に再開できます。確定済みノードは再実行しません。
- 未確定のAPI・AI、判別できないノードは `interrupted`（結果確認が必要）に隔離します。APIの応答消失や外部処理後の保存失敗も、自動再送ではなく結果確認を要求します。
- 外部APIには `実行ID:ノードID` の固定 `Idempotency-Key` を送ります。ただし送信先が対応しているとは限らず、AIの二重課金も防げないため、厳密なexactly-onceを保証しません。

## 管理者の判断

エディタの「実行履歴」で結果確認が必要な実行を開きます。`workflow:manage` が必要です。判断理由、元の更新時刻、外部結果と重複リスクの確認を送信し、別の管理者が先に判断していた場合は409になります。

| 操作 | 挙動 |
| --- | --- |
| 再試行 | 不明なノードをもう一度実行します。同じAPI idempotency keyを使いますが、二重実行・二重課金のリスクを確認してから選びます。 |
| 処理済みとして次へ | 当該ノードをskipとして記録し、後続を実行します。AIのコメント・フィールド出力を復元する操作ではありません。必要なデータは先に確認・修復してください。 |
| 失敗として終了 | 不明なノードを失敗として記録し、後続を実行しません。 |

判断者・理由・操作・元の実行者は `WORKFLOW_RECOVERY_DECISION` に記録します。再開後も元の実行者の状態・権限・テナント・対象レコードを再検証するため、管理者の権限で元の実行者の権限不足を迂回しません。

## 配置時の注意

旧バージョンの実行プロセスを停止し、処理中リクエストをdrainしてからmigrationと新バージョンを配置してください。旧workerはtokenによるfencingを理解しません。移行前から `running` のまま残っている実行は、最終更新から5分経過後に同じ安全判定で回復・隔離します。外部結果は必ず確認してください。

DBのlease列は `timestamptz` です。接続の `timezone=UTC` はPrismaの日時保存とDB時刻を一致させるために必要で、接続URLの他のoptionsは保持します。

## 検証と残る領域

実PostgreSQLの専用スキーマで、保存とqueueのrollback、保存後dispatch失敗、イベントsnapshot、同時更新、期限切れ回復の競合、実行中row lockの回避、旧tokenの拒否、外部結果不明の隔離、管理者のretry/skip/fail・別テナント拒否を統合テストします。外部通信はmockであり、実サービスの結果や課金の評価を済ませたことにはなりません。

Webhook受信、scheduleの公平性・イベント間隔制御、全権限組み合わせ、実プロセスを強制終了する長時間fault injection、実外部API・実AIモデルの評価と配置先の定期実行監視は引き続き必要です。
