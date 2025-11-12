import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { renderer } from './renderer'

type Bindings = {
  DB: D1Database;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS設定
app.use('/api/*', cors())

// レンダラー
app.use(renderer)

// ======================
// LINE通知関数
// ======================
async function sendLineNotification(
  accessToken: string | undefined,
  customerName: string,
  changeAmount: number,
  newCount: number
) {
  if (!accessToken) {
    console.log('LINE_CHANNEL_ACCESS_TOKEN is not set. Skipping LINE notification.')
    return
  }

  const message = changeAmount > 0
    ? `【チケット追加】\n${customerName}様\nチケットを${changeAmount}枚追加しました。\n残り: ${newCount}枚`
    : `【チケット使用】\n${customerName}様\nチケットを${Math.abs(changeAmount)}枚使用しました。\n残り: ${newCount}枚`

  try {
    // LINE Messaging APIへのブロードキャストメッセージ送信
    const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      })
    })

    if (!response.ok) {
      console.error('LINE notification failed:', await response.text())
    }
  } catch (error) {
    console.error('LINE notification error:', error)
  }
}

// ======================
// API: 顧客一覧取得
// ======================
app.get('/api/customers', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM customers ORDER BY name ASC'
    ).all()

    return c.json({ customers: results })
  } catch (error) {
    return c.json({ error: 'Failed to fetch customers' }, 500)
  }
})

// ======================
// API: 顧客詳細取得
// ======================
app.get('/api/customers/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const customer = await c.env.DB.prepare(
      'SELECT * FROM customers WHERE id = ?'
    ).bind(id).first()

    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404)
    }

    const { results: history } = await c.env.DB.prepare(
      'SELECT * FROM ticket_history WHERE customer_id = ? ORDER BY created_at DESC'
    ).bind(id).all()

    return c.json({ customer, history })
  } catch (error) {
    return c.json({ error: 'Failed to fetch customer' }, 500)
  }
})

// ======================
// API: 顧客追加
// ======================
app.post('/api/customers', async (c) => {
  try {
    const { name, phone, email, ticket_count } = await c.req.json()

    if (!name) {
      return c.json({ error: 'Name is required' }, 400)
    }

    const result = await c.env.DB.prepare(
      'INSERT INTO customers (name, phone, email, ticket_count) VALUES (?, ?, ?, ?)'
    ).bind(name, phone || null, email || null, ticket_count || 0).run()

    const customerId = result.meta.last_row_id

    // 初期チケットがある場合は履歴に記録
    if (ticket_count && ticket_count > 0) {
      await c.env.DB.prepare(
        'INSERT INTO ticket_history (customer_id, change_amount, previous_count, new_count, note) VALUES (?, ?, ?, ?, ?)'
      ).bind(customerId, ticket_count, 0, ticket_count, '初回登録').run()
    }

    return c.json({ 
      id: customerId, 
      name, 
      phone, 
      email, 
      ticket_count: ticket_count || 0 
    })
  } catch (error) {
    return c.json({ error: 'Failed to create customer' }, 500)
  }
})

// ======================
// API: チケット増減
// ======================
app.post('/api/customers/:id/tickets', async (c) => {
  const id = c.req.param('id')

  try {
    const { change_amount, note } = await c.req.json()

    if (change_amount === undefined || change_amount === 0) {
      return c.json({ error: 'change_amount is required and must not be zero' }, 400)
    }

    // 現在のチケット数を取得
    const customer = await c.env.DB.prepare(
      'SELECT * FROM customers WHERE id = ?'
    ).bind(id).first<{ id: number; name: string; ticket_count: number }>()

    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404)
    }

    const previousCount = customer.ticket_count
    const newCount = previousCount + change_amount

    if (newCount < 0) {
      return c.json({ error: 'Insufficient tickets' }, 400)
    }

    // チケット数を更新
    await c.env.DB.prepare(
      'UPDATE customers SET ticket_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(newCount, id).run()

    // 履歴を記録
    await c.env.DB.prepare(
      'INSERT INTO ticket_history (customer_id, change_amount, previous_count, new_count, note) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, change_amount, previousCount, newCount, note || null).run()

    // LINE通知を送信
    await sendLineNotification(
      c.env.LINE_CHANNEL_ACCESS_TOKEN,
      customer.name,
      change_amount,
      newCount
    )

    return c.json({
      customer_id: id,
      previous_count: previousCount,
      change_amount,
      new_count: newCount
    })
  } catch (error) {
    console.error('Ticket update error:', error)
    return c.json({ error: 'Failed to update tickets' }, 500)
  }
})

// ======================
// API: 顧客削除
// ======================
app.delete('/api/customers/:id', async (c) => {
  const id = c.req.param('id')

  try {
    await c.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run()
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: 'Failed to delete customer' }, 500)
  }
})

// ======================
// フロントエンド
// ======================
app.get('/', (c) => {
  return c.render(
    <div class="container">
      <header>
        <h1>🎫 ダンススクール チケット管理</h1>
      </header>

      <div class="main-content">
        {/* 顧客一覧 */}
        <div class="section">
          <div class="section-header">
            <h2>顧客一覧</h2>
            <button onclick="showAddCustomerModal()" class="btn btn-primary">
              ➕ 新規顧客登録
            </button>
          </div>
          <div id="customerList" class="customer-list">
            <p class="loading">読み込み中...</p>
          </div>
        </div>

        {/* 顧客詳細 */}
        <div class="section" id="customerDetailSection" style="display: none;">
          <div class="section-header">
            <h2>顧客詳細</h2>
            <button onclick="closeCustomerDetail()" class="btn btn-secondary">✕ 閉じる</button>
          </div>
          <div id="customerDetail"></div>
        </div>
      </div>

      {/* 新規顧客登録モーダル */}
      <div id="addCustomerModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>新規顧客登録</h3>
            <button onclick="closeAddCustomerModal()" class="btn btn-text">✕</button>
          </div>
          <form id="addCustomerForm">
            <div class="form-group">
              <label>氏名 *</label>
              <input type="text" name="name" required />
            </div>
            <div class="form-group">
              <label>電話番号</label>
              <input type="tel" name="phone" />
            </div>
            <div class="form-group">
              <label>メールアドレス</label>
              <input type="email" name="email" />
            </div>
            <div class="form-group">
              <label>初期チケット枚数</label>
              <input type="number" name="ticket_count" min="0" value="0" />
            </div>
            <div class="form-actions">
              <button type="button" onclick="closeAddCustomerModal()" class="btn btn-secondary">
                キャンセル
              </button>
              <button type="submit" class="btn btn-primary">登録</button>
            </div>
          </form>
        </div>
      </div>

      {/* チケット増減モーダル */}
      <div id="ticketModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>チケット増減</h3>
            <button onclick="closeTicketModal()" class="btn btn-text">✕</button>
          </div>
          <form id="ticketForm">
            <input type="hidden" id="ticketCustomerId" />
            <div class="form-group">
              <label>変更枚数</label>
              <input 
                type="number" 
                id="ticketChangeAmount" 
                name="change_amount" 
                required 
                placeholder="正の数で追加、負の数で減少"
              />
            </div>
            <div class="form-group">
              <label>メモ</label>
              <textarea name="note" rows="3" placeholder="例: 10回チケット購入"></textarea>
            </div>
            <div class="form-actions">
              <button type="button" onclick="closeTicketModal()" class="btn btn-secondary">
                キャンセル
              </button>
              <button type="submit" class="btn btn-primary">更新</button>
            </div>
          </form>
        </div>
      </div>

      <script src="/static/app.js"></script>
    </div>
  )
})

export default app
