// グローバル変数
let customers = [];
let currentCustomer = null;

// ======================
// 初期化
// ======================
document.addEventListener('DOMContentLoaded', () => {
  showCustomerListScreen();
  loadCustomers();
});

// ======================
// 画面切り替え
// ======================
function showCustomerListScreen() {
  document.getElementById('customerListScreen').classList.add('active');
  document.getElementById('customerDetailScreen').classList.remove('active');
}

function showCustomerDetailScreen() {
  console.log('showCustomerDetailScreen called');
  const listScreen = document.getElementById('customerListScreen');
  const detailScreen = document.getElementById('customerDetailScreen');
  console.log('List screen element:', listScreen);
  console.log('Detail screen element:', detailScreen);
  listScreen.classList.remove('active');
  detailScreen.classList.add('active');
  console.log('Classes updated - list:', listScreen.className, 'detail:', detailScreen.className);
}

function backToCustomerList() {
  showCustomerListScreen();
  currentCustomer = null;
  loadCustomers(); // データを再読み込み
}

// ======================
// 顧客一覧の読み込み
// ======================
async function loadCustomers() {
  try {
    const response = await fetch('/api/customers');
    const data = await response.json();
    customers = data.customers;
    renderCustomerList();
  } catch (error) {
    console.error('Failed to load customers:', error);
    document.getElementById('customerList').innerHTML = '<p class="empty">顧客データの読み込みに失敗しました</p>';
  }
}

function renderCustomerList() {
  const container = document.getElementById('customerList');
  
  if (customers.length === 0) {
    container.innerHTML = '<p class="empty">顧客が登録されていません</p>';
    return;
  }

  container.innerHTML = `
    <table class="customer-table">
      <thead>
        <tr>
          <th>氏名</th>
          <th>連絡先</th>
          <th class="ticket-cell">チケット残数</th>
          <th class="action-cell">操作</th>
        </tr>
      </thead>
      <tbody>
        ${customers.map(customer => `
          <tr onclick="loadCustomerDetail(${customer.id})">
            <td class="name-cell">${escapeHtml(customer.name)}</td>
            <td class="contact-cell">
              ${customer.phone ? `📞 ${escapeHtml(customer.phone)}` : ''}
              ${customer.phone && customer.email ? '<br>' : ''}
              ${customer.email ? `📧 ${escapeHtml(customer.email)}` : ''}
              ${!customer.phone && !customer.email ? '未登録' : ''}
            </td>
            <td class="ticket-cell">
              <span class="ticket-badge">${customer.ticket_count}枚</span>
            </td>
            <td class="action-cell">
              <button onclick="event.stopPropagation(); loadCustomerDetail(${customer.id})" class="btn btn-primary" style="font-size: 12px; padding: 6px 12px;">
                詳細
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ======================
// 顧客詳細の読み込み
// ======================
async function loadCustomerDetail(customerId) {
  console.log('loadCustomerDetail called with ID:', customerId);
  try {
    const response = await fetch(`/api/customers/${customerId}`);
    console.log('API response status:', response.status);
    const data = await response.json();
    console.log('Customer data:', data);
    currentCustomer = data.customer;
    renderCustomerDetail(data.customer, data.history);
    console.log('About to show detail screen');
    showCustomerDetailScreen();
    console.log('Detail screen should be visible now');
  } catch (error) {
    console.error('Failed to load customer detail:', error);
    alert('顧客詳細の読み込みに失敗しました');
  }
}

function renderCustomerDetail(customer, history) {
  const container = document.getElementById('customerDetail');
  
  container.innerHTML = `
    <div class="detail-card">
      <h3 style="font-size: 24px; font-weight: bold; color: #333; margin-bottom: 20px;">
        ${escapeHtml(customer.name)}
      </h3>
      
      <div class="detail-info">
        <div class="info-item">
          <div class="info-label">電話番号</div>
          <div class="info-value">${customer.phone ? escapeHtml(customer.phone) : '未登録'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">メールアドレス</div>
          <div class="info-value">${customer.email ? escapeHtml(customer.email) : '未登録'}</div>
        </div>
        <div class="info-item" style="grid-column: 1 / -1;">
          <div class="info-label">現在のチケット</div>
          <div class="info-value">
            <span class="ticket-badge" style="font-size: 24px; padding: 12px 24px;">${customer.ticket_count}枚</span>
          </div>
        </div>
      </div>
      
      <div class="ticket-actions">
        <button onclick="showTicketModal(${customer.id}, 1)" class="btn btn-success">
          ➕ チケット追加
        </button>
        <button onclick="showTicketModal(${customer.id}, -1)" class="btn btn-danger">
          ➖ チケット使用
        </button>
        <button onclick="deleteCustomer(${customer.id})" class="btn btn-secondary">
          🗑️ 顧客削除
        </button>
      </div>
    </div>

    <div class="history-section">
      <h3>📋 チケット履歴</h3>
      <div class="history-list">
        ${history.length === 0 
          ? '<p class="empty">履歴がありません</p>' 
          : history.map(h => `
            <div class="history-item">
              <div class="history-info">
                <div class="history-date">${formatDate(h.created_at)}</div>
                <div class="history-change ${h.change_amount > 0 ? 'positive' : 'negative'}">
                  ${h.change_amount > 0 ? '+' : ''}${h.change_amount}枚
                </div>
                ${h.note ? `<div class="history-note">${escapeHtml(h.note)}</div>` : ''}
              </div>
              <div class="history-count">
                ${h.previous_count}枚 → ${h.new_count}枚
              </div>
            </div>
          `).join('')
        }
      </div>
    </div>
  `;
}

// ======================
// 新規顧客登録モーダル
// ======================
function showAddCustomerModal() {
  document.getElementById('addCustomerModal').classList.add('active');
  document.getElementById('addCustomerForm').reset();
}

function closeAddCustomerModal() {
  document.getElementById('addCustomerModal').classList.remove('active');
}

document.getElementById('addCustomerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const data = {
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    ticket_count: parseInt(formData.get('ticket_count')) || 0
  };

  try {
    const response = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      closeAddCustomerModal();
      await loadCustomers();
      alert('顧客を登録しました');
    } else {
      const error = await response.json();
      alert('登録に失敗しました: ' + error.error);
    }
  } catch (error) {
    console.error('Failed to add customer:', error);
    alert('登録に失敗しました');
  }
});

// ======================
// チケット増減モーダル
// ======================
function showTicketModal(customerId, defaultAmount) {
  document.getElementById('ticketCustomerId').value = customerId;
  document.getElementById('ticketChangeAmount').value = defaultAmount;
  document.getElementById('ticketModal').classList.add('active');
}

function closeTicketModal() {
  document.getElementById('ticketModal').classList.remove('active');
  document.getElementById('ticketForm').reset();
}

document.getElementById('ticketForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const customerId = document.getElementById('ticketCustomerId').value;
  const formData = new FormData(e.target);
  const data = {
    change_amount: parseInt(formData.get('change_amount')),
    note: formData.get('note')
  };

  if (data.change_amount === 0) {
    alert('変更枚数を入力してください');
    return;
  }

  try {
    const response = await fetch(`/api/customers/${customerId}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      closeTicketModal();
      await loadCustomerDetail(customerId);
      alert('チケットを更新しました');
    } else {
      const error = await response.json();
      alert('更新に失敗しました: ' + error.error);
    }
  } catch (error) {
    console.error('Failed to update tickets:', error);
    alert('更新に失敗しました');
  }
});

// ======================
// 顧客削除
// ======================
async function deleteCustomer(customerId) {
  if (!confirm('この顧客を削除してもよろしいですか？')) {
    return;
  }

  try {
    const response = await fetch(`/api/customers/${customerId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      alert('顧客を削除しました');
      backToCustomerList();
    } else {
      alert('削除に失敗しました');
    }
  } catch (error) {
    console.error('Failed to delete customer:', error);
    alert('削除に失敗しました');
  }
}

// ======================
// ユーティリティ関数
// ======================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  // SQLiteからの日付文字列を日本時間として解釈
  // データベースの日付は 'YYYY-MM-DD HH:MM:SS' 形式
  const date = new Date(dateStr + ' UTC'); // UTCとして解釈してから変換
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo'
  });
}
