-- テストデータ
INSERT OR IGNORE INTO customers (id, name, phone, email, ticket_count) VALUES 
  (1, '山田太郎', '090-1234-5678', 'yamada@example.com', 10),
  (2, '佐藤花子', '090-2345-6789', 'sato@example.com', 5),
  (3, '鈴木一郎', '090-3456-7890', 'suzuki@example.com', 3);

-- 初期チケット履歴
INSERT OR IGNORE INTO ticket_history (customer_id, change_amount, previous_count, new_count, note) VALUES 
  (1, 10, 0, 10, '初回購入'),
  (2, 5, 0, 5, '初回購入'),
  (3, 3, 0, 3, '初回購入');
