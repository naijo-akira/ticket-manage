# 🚀 デプロイ情報

## 本番環境URL

**本番サイト**: https://dance-ticket-manager.pages.dev

**最新デプロイ**: https://ec2ba2ea.dance-ticket-manager.pages.dev

## デプロイ日時

- **初回デプロイ**: 2025-11-12

## Cloudflare設定

### D1 Database
- **Database Name**: dance-ticket-db
- **Database ID**: c3cca33d-27a9-4a93-b2fc-6c22df559143
- **Binding**: DB
- **マイグレーション**: ✅ 適用済み

### Pages Project
- **Project Name**: dance-ticket-manager
- **Production Branch**: main
- **Compatibility Date**: 2025-11-12

### 環境変数
- `LINE_CHANNEL_ACCESS_TOKEN`: 未設定（LINE通知を使用する場合は設定が必要）

## LINE通知の設定方法（任意）

本番環境でLINE通知を有効にする場合：

```bash
# LINEチャネルアクセストークンを設定
npx wrangler pages secret put LINE_CHANNEL_ACCESS_TOKEN --project-name dance-ticket-manager

# プロンプトが表示されたら、トークンを貼り付けてEnter
```

## 再デプロイ方法

コードを変更した後、本番環境に反映するには：

```bash
# 1. ビルド
npm run build

# 2. デプロイ
npx wrangler pages deploy dist --project-name dance-ticket-manager

# または、まとめて実行
npm run deploy:prod
```

## データベース管理

### 本番データベースへのマイグレーション

```bash
# 新しいマイグレーションファイルを作成後
npx wrangler d1 migrations apply dance-ticket-db --remote
```

### 本番データベースのクエリ実行

```bash
# SQLクエリを実行
npx wrangler d1 execute dance-ticket-db --remote --command="SELECT * FROM customers"

# SQLファイルを実行
npx wrangler d1 execute dance-ticket-db --remote --file=./seed.sql
```

## トラブルシューティング

### デプロイエラーが発生した場合

1. ビルドが成功しているか確認
   ```bash
   npm run build
   ```

2. wrangler.jsonc の設定を確認
   - プロジェクト名が正しいか
   - データベースIDが正しいか

3. Cloudflare API認証を確認
   ```bash
   npx wrangler whoami
   ```

### データベース接続エラーが発生した場合

1. D1バインディングが正しく設定されているか確認
2. マイグレーションが適用されているか確認
   ```bash
   npx wrangler d1 migrations list dance-ticket-db --remote
   ```

## 監視とログ

### デプロイメントログの確認

Cloudflare Dashboardで確認：
https://dash.cloudflare.com/ → Pages → dance-ticket-manager → Deployments

### リアルタイムログ（開発中）

```bash
# ローカル開発サーバーでログ確認
npx wrangler pages dev dist --d1=dance-ticket-db --local
```

## バックアップ

本番データベースのバックアップを取る場合：

```bash
# 全テーブルのデータをエクスポート
npx wrangler d1 execute dance-ticket-db --remote --command="SELECT * FROM customers" > customers_backup.json
npx wrangler d1 execute dance-ticket-db --remote --command="SELECT * FROM ticket_history" > history_backup.json
```

---

**管理者**: naijoakira@techtonix.co.jp  
**最終更新**: 2025-11-12
