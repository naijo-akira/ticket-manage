-- LINE User IDカラムを追加
ALTER TABLE customers ADD COLUMN line_user_id TEXT;

-- インデックス作成（検索の高速化）
CREATE INDEX IF NOT EXISTS idx_customers_line_user_id ON customers(line_user_id);
