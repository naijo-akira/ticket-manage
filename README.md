# 🎫 ダンススクール チケット管理システム

## プロジェクト概要

ダンススクール向けの顧客チケット管理アプリケーションです。顧客ごとのチケット枚数を管理し、チケットの追加・使用をリアルタイムで記録します。チケット増減時にはLINE通知を送信する機能も搭載しています。

## 主な機能

### ✅ 完成済み機能

1. **顧客管理**
   - 顧客の新規登録（氏名、電話番号、メールアドレス、初期チケット枚数）
   - 顧客一覧表示
   - 顧客詳細表示
   - 顧客情報編集
   - 顧客削除
   - LINE友達追加時の自動登録（Webhook）

2. **チケット管理**
   - チケット追加（購入時）
   - チケット使用（レッスン受講時）
   - 残チケット枚数の表示
   - チケット増減履歴の記録と表示

3. **LINE連携機能**
   - チケット追加時の個別通知
   - チケット使用時の個別通知
   - 残チケット枚数の通知
   - 友達追加時の自動顧客登録
   - ウェルカムメッセージ送信

4. **履歴管理**
   - チケット増減履歴の保存
   - 変更前後の枚数記録
   - 変更理由のメモ機能

5. **モバイル対応**
   - レスポンシブデザイン
   - スマートフォン最適化
   - タッチ操作対応

## 技術スタック

- **フロントエンド**: HTML/CSS/JavaScript + Tailwind CSS
- **バックエンド**: Hono (TypeScript)
- **データベース**: Cloudflare D1 (SQLite)
- **デプロイ**: Cloudflare Pages
- **通知**: LINE Messaging API

## データモデル

### customers テーブル
| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | INTEGER | 主キー（自動採番） |
| name | TEXT | 顧客氏名（必須） |
| phone | TEXT | 電話番号（任意） |
| email | TEXT | メールアドレス（任意） |
| ticket_count | INTEGER | 現在のチケット枚数 |
| created_at | DATETIME | 登録日時 |
| updated_at | DATETIME | 更新日時 |

### ticket_history テーブル
| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | INTEGER | 主キー（自動採番） |
| customer_id | INTEGER | 顧客ID（外部キー） |
| change_amount | INTEGER | 変更枚数（正=追加、負=使用） |
| previous_count | INTEGER | 変更前の枚数 |
| new_count | INTEGER | 変更後の枚数 |
| note | TEXT | メモ（任意） |
| created_at | DATETIME | 変更日時 |

## API エンドポイント

### 顧客管理API

#### GET /api/customers
顧客一覧を取得

**レスポンス例:**
```json
{
  "customers": [
    {
      "id": 1,
      "name": "山田太郎",
      "phone": "090-1234-5678",
      "email": "yamada@example.com",
      "ticket_count": 10,
      "created_at": "2025-11-12 10:00:00",
      "updated_at": "2025-11-12 10:00:00"
    }
  ]
}
```

#### GET /api/customers/:id
顧客詳細とチケット履歴を取得

**レスポンス例:**
```json
{
  "customer": {
    "id": 1,
    "name": "山田太郎",
    "ticket_count": 10
  },
  "history": [
    {
      "id": 1,
      "customer_id": 1,
      "change_amount": 10,
      "previous_count": 0,
      "new_count": 10,
      "note": "初回購入",
      "created_at": "2025-11-12 10:00:00"
    }
  ]
}
```

#### POST /api/customers
新規顧客を登録

**リクエストボディ:**
```json
{
  "name": "山田太郎",
  "phone": "090-1234-5678",
  "email": "yamada@example.com",
  "ticket_count": 10
}
```

#### DELETE /api/customers/:id
顧客を削除

### チケット管理API

#### POST /api/customers/:id/tickets
チケット枚数を増減

**リクエストボディ:**
```json
{
  "change_amount": 5,
  "note": "10回チケット購入"
}
```

**レスポンス例:**
```json
{
  "customer_id": 1,
  "previous_count": 10,
  "change_amount": 5,
  "new_count": 15
}
```

### LINE Webhook API

#### POST /api/line/webhook
LINE Messaging APIからのWebhookイベントを受信

**イベント種類:**
- `follow`: 友達追加イベント → 自動顧客登録＋ウェルカムメッセージ
- `unfollow`: ブロックイベント → ログ記録

**リクエストボディ例（LINE送信）:**
```json
{
  "events": [
    {
      "type": "follow",
      "timestamp": 1234567890123,
      "source": {
        "type": "user",
        "userId": "U1234567890abcdef..."
      }
    }
  ]
}
```

**処理フロー:**
1. LINE User IDからプロフィール情報を取得
2. 既存顧客チェック（重複登録防止）
3. 新規顧客として登録（氏名=表示名、LINE User ID保存）
4. ウェルカムメッセージ送信

## セットアップ手順

### 1. 依存パッケージのインストール

```bash
cd /home/user/webapp
npm install
```

### 2. データベースのセットアップ

```bash
# ローカルマイグレーション実行
npm run db:migrate:local

# テストデータ投入
npm run db:seed
```

### 3. LINE通知の設定（任意）

LINE通知を使用する場合は、以下の手順で設定してください：

1. [LINE Developers Console](https://developers.line.biz/console/) にアクセス
2. Messaging APIチャネルを作成
3. チャネルアクセストークンを取得
4. `.dev.vars`ファイルを作成（`.dev.vars.example`をコピー）
5. `LINE_CHANNEL_ACCESS_TOKEN`に取得したトークンを設定

```bash
# .dev.varsファイルを作成
cp .dev.vars.example .dev.vars

# エディタで.dev.varsを編集し、トークンを設定
```

#### LINE Webhook設定（友達追加時の自動登録）

LINE友達追加時に自動で顧客登録する機能を使用する場合：

1. LINE Developers Consoleでチャネル設定を開く
2. 「Messaging API設定」タブを選択
3. 「Webhook URL」を設定:
   - **開発環境**: `https://your-sandbox-url.sandbox.novita.ai/api/line/webhook`
   - **本番環境**: `https://dance-ticket-manager.pages.dev/api/line/webhook`
4. 「Webhookの利用」を**ON**に設定
5. 「検証」ボタンでWebhook URLが正しく設定されているか確認

**動作の流れ:**
1. ユーザーがLINE公式アカウントを友達追加
2. LINE Messaging APIがWebhook URLにイベントを送信
3. アプリがユーザープロフィール（表示名）を取得
4. データベースに新規顧客として自動登録（LINE User ID付き）
5. ウェルカムメッセージを送信

**注意**: LINE通知を設定しない場合でも、アプリケーションは正常に動作します。通知機能のみがスキップされます。

### 4. 開発サーバーの起動

```bash
# ビルド
npm run build

# PM2でサービス起動
pm2 start ecosystem.config.cjs

# サービス確認
pm2 list
pm2 logs dance-ticket-manager --nostream
```

### 5. アクセス確認

- **ローカル**: http://localhost:3000
- **サンドボックス**: https://3000-ihk23w8u1r0otk6mzo59l-82b888ba.sandbox.novita.ai

## 使い方

### 顧客を登録する

1. トップページの「➕ 新規顧客登録」ボタンをクリック
2. 氏名、電話番号、メールアドレス、初期チケット枚数を入力
3. 「登録」ボタンをクリック

### チケットを追加する

1. 顧客カードをクリックして詳細画面を表示
2. 「➕ チケット追加」ボタンをクリック
3. 追加枚数とメモを入力（例: 変更枚数=10、メモ=10回チケット購入）
4. 「更新」ボタンをクリック

### チケットを使用する

1. 顧客カードをクリックして詳細画面を表示
2. 「➖ チケット使用」ボタンをクリック
3. 使用枚数を負の数で入力（例: 変更枚数=-1、メモ=レッスン受講）
4. 「更新」ボタンをクリック

### 履歴を確認する

顧客詳細画面の下部に「📋 チケット履歴」が表示されます。各履歴には以下が記録されます：
- 日時
- 変更枚数（+5枚、-1枚など）
- 変更前後の枚数
- メモ

## デプロイ手順

### Cloudflare Pagesへのデプロイ

1. **Cloudflare API Key設定**（初回のみ）
```bash
# setup_cloudflare_api_keyツールを使用してAPIキーを設定
```

2. **本番用D1データベースの作成**（初回のみ）
```bash
# D1データベースを作成
npx wrangler d1 create dance-ticket-db

# 出力されたdatabase_idをwrangler.jsonc に設定
# "database_id": "your-production-database-id"
```

3. **本番環境のマイグレーション**（初回のみ）
```bash
npm run db:migrate:prod
```

4. **LINE通知の本番設定**（任意）
```bash
# 本番環境にLINEトークンを設定
npx wrangler pages secret put LINE_CHANNEL_ACCESS_TOKEN --project-name dance-ticket-manager
# プロンプトでトークンを入力
```

5. **デプロイ実行**
```bash
npm run deploy:prod
```

6. **デプロイ確認**

デプロイが完了すると、以下のようなURLが表示されます：
- Production: https://dance-ticket-manager.pages.dev

## npm スクリプト

| コマンド | 説明 |
|---------|------|
| `npm run dev` | Vite開発サーバー起動 |
| `npm run dev:sandbox` | Wrangler開発サーバー起動（サンドボックス用） |
| `npm run build` | プロジェクトビルド |
| `npm run preview` | ビルド結果のプレビュー |
| `npm run deploy:prod` | 本番環境へデプロイ |
| `npm run db:migrate:local` | ローカルDBマイグレーション |
| `npm run db:migrate:prod` | 本番DBマイグレーション |
| `npm run db:seed` | テストデータ投入 |
| `npm run db:reset` | ローカルDB初期化とシード |
| `npm run clean-port` | ポート3000のクリーンアップ |
| `npm run test` | サービス疎通確認 |

## トラブルシューティング

### ポート3000が使用中の場合

```bash
npm run clean-port
# または
fuser -k 3000/tcp
```

### データベースをリセットしたい場合

```bash
npm run db:reset
```

### PM2サービスが起動しない場合

```bash
# PM2のログを確認
pm2 logs dance-ticket-manager

# サービスを再起動
pm2 restart dance-ticket-manager

# サービスを削除して再起動
pm2 delete dance-ticket-manager
npm run build
pm2 start ecosystem.config.cjs
```

### LINE通知が送信されない場合

1. `LINE_CHANNEL_ACCESS_TOKEN`が正しく設定されているか確認
2. LINE Developers Consoleでチャネルが有効か確認
3. Messaging APIの設定が完了しているか確認
4. ブロードキャストメッセージが許可されているか確認

## 今後の改善案

### 未実装機能

1. **認証機能**
   - スタッフ用ログイン機能
   - 権限管理（管理者、スタッフ）

2. **レポート機能**
   - 月次売上レポート
   - チケット販売統計
   - 顧客来店頻度分析

3. **通知機能の拡張**
   - 個別顧客へのLINE通知（ブロードキャストではなく）
   - チケット残数が少ない顧客への自動通知
   - メール通知機能

4. **予約管理機能**
   - レッスン予約機能
   - 予約時の自動チケット消費
   - 予約カレンダー表示

5. **チケット種類の管理**
   - 複数種類のチケット対応（1回券、5回券、10回券など）
   - 有効期限管理
   - チケット種別ごとの価格設定

6. **UI/UX改善**
   - ダークモード対応
   - モバイルアプリ化（PWA）
   - 多言語対応

## プロジェクト構成

```
webapp/
├── src/
│   ├── index.tsx          # メインアプリケーション
│   └── renderer.tsx       # HTMLレンダラー
├── public/
│   └── static/
│       ├── app.js         # フロントエンドJavaScript
│       └── style.css      # カスタムCSS
├── migrations/
│   └── 0001_initial_schema.sql  # DBマイグレーション
├── dist/                  # ビルド出力（自動生成）
├── .wrangler/             # Wranglerローカル状態（自動生成）
├── ecosystem.config.cjs   # PM2設定
├── wrangler.jsonc        # Cloudflare設定
├── package.json          # 依存関係とスクリプト
├── seed.sql              # テストデータ
└── README.md             # このファイル
```

## ライセンス

このプロジェクトは教育目的で作成されています。

## サポート

問題や質問がある場合は、GitHubのIssuesでお知らせください。

---

**最終更新日**: 2025-11-12  
**ステータス**: ✅ 開発完了（ローカル動作確認済み）  
**デプロイ**: 未デプロイ（Cloudflare Pages準備完了）
