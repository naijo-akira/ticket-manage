import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'

type Bindings = {
  DB: D1Database;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// 静的ファイル配信
app.use('/static/*', serveStatic({ root: './' }))

// CORS設定
app.use('/api/*', cors())

// レンダラー
app.use(renderer)

// ======================
// ユーティリティ関数
// ======================
function getCurrentJSTTimestamp() {
  // 日本時間（JST = UTC+9）のタイムスタンプを 'YYYY-MM-DD HH:MM:SS' 形式で取得
  const now = new Date();
  const jst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return jst.toISOString().slice(0, 19).replace('T', ' ');
}

// ======================
// LINE通知関数（個別送信）
// ======================
async function sendLineNotification(
  accessToken: string | undefined,
  lineUserId: string | null,
  customerName: string,
  changeAmount: number,
  newCount: number
) {
  // トークンまたはUser IDがない場合はスキップ
  if (!accessToken) {
    console.log('LINE_CHANNEL_ACCESS_TOKEN is not set. Skipping LINE notification.')
    return
  }

  if (!lineUserId) {
    console.log(`LINE User ID not set for customer: ${customerName}. Skipping LINE notification.`)
    return
  }

  const message = changeAmount > 0
    ? `【チケット追加】\n${customerName}様\nチケットを${changeAmount}枚追加しました。\n残り: ${newCount}枚`
    : `【チケット使用】\n${customerName}様\nチケットを${Math.abs(changeAmount)}枚使用しました。\n残り: ${newCount}枚`

  try {
    // LINE Messaging APIへの個別メッセージ送信（Push Message）
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('LINE notification failed:', errorText)
    } else {
      console.log(`LINE notification sent to ${customerName} (${lineUserId})`)
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
    const { name, phone, email, ticket_count, line_user_id } = await c.req.json()

    if (!name) {
      return c.json({ error: 'Name is required' }, 400)
    }

    const jstNow = getCurrentJSTTimestamp()
    
    const result = await c.env.DB.prepare(
      'INSERT INTO customers (name, phone, email, ticket_count, line_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(name, phone || null, email || null, ticket_count || 0, line_user_id || null, jstNow, jstNow).run()

    const customerId = result.meta.last_row_id

    // 初期チケットがある場合は履歴に記録
    if (ticket_count && ticket_count > 0) {
      await c.env.DB.prepare(
        'INSERT INTO ticket_history (customer_id, change_amount, previous_count, new_count, note, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(customerId, ticket_count, 0, ticket_count, '初回登録', jstNow).run()
    }

    return c.json({ 
      id: customerId, 
      name, 
      phone, 
      email, 
      ticket_count: ticket_count || 0,
      line_user_id: line_user_id || null
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

    // 現在のチケット数とLINE User IDを取得
    const customer = await c.env.DB.prepare(
      'SELECT * FROM customers WHERE id = ?'
    ).bind(id).first<{ id: number; name: string; ticket_count: number; line_user_id: string | null }>()

    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404)
    }

    const previousCount = customer.ticket_count
    const newCount = previousCount + change_amount

    if (newCount < 0) {
      return c.json({ error: 'Insufficient tickets' }, 400)
    }

    const jstNow = getCurrentJSTTimestamp()
    
    // チケット数を更新
    await c.env.DB.prepare(
      'UPDATE customers SET ticket_count = ?, updated_at = ? WHERE id = ?'
    ).bind(newCount, jstNow, id).run()

    // 履歴を記録
    await c.env.DB.prepare(
      'INSERT INTO ticket_history (customer_id, change_amount, previous_count, new_count, note, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, change_amount, previousCount, newCount, note || null, jstNow).run()

    // LINE通知を送信（個別送信）
    await sendLineNotification(
      c.env.LINE_CHANNEL_ACCESS_TOKEN,
      customer.line_user_id,
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
// API: 顧客情報編集
// ======================
app.put('/api/customers/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const { name, phone, email, line_user_id } = await c.req.json()

    if (!name) {
      return c.json({ error: 'Name is required' }, 400)
    }

    // 既存の顧客を確認
    const customer = await c.env.DB.prepare(
      'SELECT * FROM customers WHERE id = ?'
    ).bind(id).first()

    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404)
    }

    const jstNow = getCurrentJSTTimestamp()
    
    // 顧客情報を更新（チケット数は編集しない）
    await c.env.DB.prepare(
      'UPDATE customers SET name = ?, phone = ?, email = ?, line_user_id = ?, updated_at = ? WHERE id = ?'
    ).bind(name, phone || null, email || null, line_user_id || null, jstNow, id).run()

    return c.json({ 
      id, 
      name, 
      phone, 
      email,
      line_user_id
    })
  } catch (error) {
    console.error('Customer update error:', error)
    return c.json({ error: 'Failed to update customer' }, 500)
  }
})

// ======================
// フロントエンド
// ======================
app.get('/', (c) => {
  return c.render(
    <div class="container">
      {/* 顧客一覧画面 */}
      <div id="customerListScreen" class="screen active">
        <div class="section full-width">
          <div class="section-header">
            <h2>🎫 顧客一覧</h2>
            <button onclick="showAddCustomerModal()" class="btn btn-primary">
              ➕ 新規顧客登録
            </button>
          </div>
          <div id="customerList">
            <p class="loading">読み込み中...</p>
          </div>
        </div>
      </div>

      {/* 顧客詳細画面 */}
      <div id="customerDetailScreen" class="screen">
        <div class="section full-width">
          <div class="section-header">
            <button onclick="backToCustomerList()" class="btn btn-secondary">
              ← 一覧に戻る
            </button>
            <h2>👤 顧客詳細</h2>
            <div></div>
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
            <div class="form-group">
              <label>LINE User ID（任意）</label>
              <input type="text" name="line_user_id" placeholder="U1234567890abcdef..." />
              <small style="color: #6b7280; font-size: 12px; display: block; margin-top: 4px;">
                LINEで通知を受け取る場合は、User IDを入力してください
              </small>
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

      {/* 顧客情報編集モーダル */}
      <div id="editCustomerModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>顧客情報編集</h3>
            <button onclick="closeEditCustomerModal()" class="btn btn-text">✕</button>
          </div>
          <form id="editCustomerForm">
            <input type="hidden" id="editCustomerId" />
            <div class="form-group">
              <label>氏名 *</label>
              <input type="text" id="editCustomerName" name="name" required />
            </div>
            <div class="form-group">
              <label>電話番号</label>
              <input type="tel" id="editCustomerPhone" name="phone" />
            </div>
            <div class="form-group">
              <label>メールアドレス</label>
              <input type="email" id="editCustomerEmail" name="email" />
            </div>
            <div class="form-group">
              <label>LINE User ID（任意）</label>
              <input type="text" id="editCustomerLineUserId" name="line_user_id" placeholder="U1234567890abcdef..." />
              <small style="color: #6b7280; font-size: 12px; display: block; margin-top: 4px;">
                LINEで通知を受け取る場合は、User IDを入力してください
              </small>
            </div>
            <div class="form-actions">
              <button type="button" onclick="closeEditCustomerModal()" class="btn btn-secondary">
                キャンセル
              </button>
              <button type="submit" class="btn btn-primary">保存</button>
            </div>
          </form>
        </div>
      </div>

      <script src="/static/app.js"></script>
    </div>
  )
})

export default app
