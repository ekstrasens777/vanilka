const API = '';
let orders = [], customers = [], currentStatus = 'all';

// ===== AUTH =====
function checkAuth() {
  const ok = sessionStorage.getItem('vanilkaAdmin');
  if (ok) showPanel(); else showLogin();
}

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminPanel').style.display = 'none';
}

function showPanel() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'flex';
  const user = sessionStorage.getItem('vanilkaAdminUser') || 'admin';
  document.getElementById('adminUsername').textContent = user;
  loadAll();
  setInterval(silentRefresh, 30000);
}

document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  btn.textContent = 'Вход...'; btn.disabled = true;
  document.getElementById('loginError').style.display = 'none';

  try {
    const res = await fetch(`${API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: document.getElementById('username').value, password: document.getElementById('password').value })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      sessionStorage.setItem('vanilkaAdmin', '1');
      sessionStorage.setItem('vanilkaAdminUser', data.user.username);
      showPanel();
    } else {
      document.getElementById('loginError').style.display = 'flex';
    }
  } catch {
    document.getElementById('loginError').style.display = 'flex';
  } finally {
    btn.textContent = 'Войти'; btn.disabled = false;
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  if (confirm('Выйти из панели управления?')) {
    sessionStorage.clear(); showLogin();
  }
});

// ===== TABS =====
document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    document.getElementById('pageTitle').textContent = btn.dataset.tab === 'orders' ? 'Заказы' : 'Клиенты';
    closeSidebar();
  });
});

// ===== MOBILE SIDEBAR =====
const sidebarOverlay = document.createElement('div');
sidebarOverlay.className = 'sidebar-overlay';
document.body.appendChild(sidebarOverlay);

document.getElementById('burgerAdmin').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open');
  sidebarOverlay.classList.add('show');
});
sidebarOverlay.addEventListener('click', closeSidebar);
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  sidebarOverlay.classList.remove('show');
}

// ===== LOAD DATA =====
async function loadAll(silent = false) {
  try {
    const [oRes, cRes, sRes] = await Promise.all([
      fetch(`${API}/api/orders`),
      fetch(`${API}/api/customers`),
      fetch(`${API}/api/stats`)
    ]);
    orders = (await oRes.json()).map(normalizeOrder);
    customers = (await cRes.json()).map(normalizeCustomer);
    const stats = await sRes.json();
    updateStats(stats);
    renderOrders();
    renderCustomers();
    updateNavBadge(stats.new_orders);
    if (!silent) console.log(`Загружено: ${orders.length} заказов, ${customers.length} клиентов`);
  } catch(err) {
    if (!silent) toast('Ошибка загрузки данных. Запущен ли сервер?', 'error');
  }
}

async function silentRefresh() {
  const oldCount = orders.length;
  try {
    const [oRes, sRes] = await Promise.all([fetch(`${API}/api/orders`), fetch(`${API}/api/stats`)]);
    orders = (await oRes.json()).map(normalizeOrder);
    const stats = await sRes.json();
    updateStats(stats);
    updateNavBadge(stats.new_orders);
    renderOrders();
    if (orders.length > oldCount) toast(`Новых заказов: ${orders.length - oldCount}`, 'success');
  } catch {}
}

function normalizeOrder(o) {
  return {
    id: o.id, customerName: o.customer_name, customerPhone: o.customer_phone,
    customerEmail: o.customer_email, total: o.total, status: o.status || 'new',
    message: o.message, date: o.created_at
  };
}
function normalizeCustomer(c) {
  return {
    id: c.id, name: c.name, phone: c.phone, email: c.email,
    ordersCount: c.orders_count, totalSpent: c.total_spent,
    firstOrder: c.first_order, lastOrder: c.last_order
  };
}

function updateStats(s) {
  document.getElementById('statTotal').textContent = s.total_orders ?? '—';
  document.getElementById('statNew').textContent = s.new_orders ?? '—';
  document.getElementById('statCustomers').textContent = s.total_customers ?? '—';
  document.getElementById('statRevenue').textContent = s.total_revenue ? (s.total_revenue).toLocaleString('ru-RU') + ' ₽' : '0 ₽';
}

function updateNavBadge(n) {
  const badge = document.getElementById('navBadge');
  badge.textContent = n; badge.style.display = n > 0 ? 'inline' : 'none';
}

document.getElementById('refreshBtn').addEventListener('click', () => {
  loadAll(); toast('Данные обновлены', 'success');
});

// ===== ORDERS =====
function renderOrders() {
  const search = (document.getElementById('searchOrders').value || '').toLowerCase();
  const tbody = document.getElementById('ordersBody');

  let filtered = orders.filter(o => {
    if (currentStatus !== 'all' && o.status !== currentStatus) return false;
    if (search) return [o.id, o.customerName, o.customerPhone, o.customerEmail, String(o.total)].join(' ').toLowerCase().includes(search);
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty"><i class="fas fa-inbox"></i> Заказы не найдены</td></tr>`;
    return;
  }

  const statusLabel = { new:'Новый', processing:'В работе', completed:'Завершён', cancelled:'Отменён' };
  const statusClass = { new:'badge-new', processing:'badge-processing', completed:'badge-completed', cancelled:'badge-cancelled' };

  tbody.innerHTML = filtered.map(o => {
    const date = o.date ? new Date(o.date).toLocaleString('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    return `<tr>
      <td><strong>${o.id}</strong></td>
      <td>
        <div class="customer-name">${o.customerName || '—'}</div>
        <div style="font-size:.78rem;color:var(--text-muted)">${o.customerPhone || ''}</div>
      </td>
      <td style="white-space:nowrap;color:var(--text-muted);font-size:.82rem">${date}</td>
      <td style="font-weight:600;color:var(--accent)">${o.total ? o.total.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
      <td><span class="badge ${statusClass[o.status] || 'badge-new'}">${statusLabel[o.status] || 'Новый'}</span></td>
      <td>
        <div class="acts">
          <button class="act-btn act-view" onclick="openOrderModal('${o.id}')"><i class="fas fa-eye"></i> Смотреть</button>
          ${o.status === 'new' ? `<button class="act-btn act-process" onclick="setStatus('${o.id}','processing')"><i class="fas fa-play"></i> В работу</button>` : ''}
          ${o.status === 'processing' ? `<button class="act-btn act-complete" onclick="setStatus('${o.id}','completed')"><i class="fas fa-check"></i> Завершить</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

document.querySelectorAll('.chip[data-status]').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip[data-status]').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentStatus = chip.dataset.status;
    renderOrders();
  });
});
document.getElementById('searchOrders').addEventListener('input', renderOrders);
document.getElementById('exportBtn').addEventListener('click', () => { window.open(`${API}/api/export/orders`, '_blank'); });

// ===== CUSTOMERS =====
function renderCustomers() {
  const search = (document.getElementById('searchCustomers').value || '').toLowerCase();
  const tbody = document.getElementById('customersBody');

  let filtered = customers.filter(c => {
    if (!search) return true;
    return [c.name, c.phone, c.email, String(c.id)].join(' ').toLowerCase().includes(search);
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty"><i class="fas fa-users"></i> Клиенты не найдены</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td style="color:var(--text-muted)">${c.id}</td>
      <td class="customer-name">${c.name || '—'}</td>
      <td class="cell-phone">${c.phone ? `<a href="tel:${c.phone}">${c.phone}</a>` : '—'}</td>
      <td class="cell-email">${c.email ? `<a href="mailto:${c.email}">${c.email}</a>` : '—'}</td>
      <td>${c.ordersCount || 0}</td>
      <td style="font-weight:600;color:var(--accent)">${c.totalSpent ? c.totalSpent.toLocaleString('ru-RU') + ' ₽' : '0 ₽'}</td>
      <td><button class="act-btn act-view" onclick="openCustomerModal(${c.id})"><i class="fas fa-eye"></i> Подробнее</button></td>
    </tr>`).join('');
}

document.getElementById('searchCustomers').addEventListener('input', renderCustomers);

// ===== STATUS UPDATE =====
async function setStatus(id, status) {
  const labels = { processing:'В работу', completed:'завершить', cancelled:'отменить' };
  if (!confirm(`Заказ ${id}: ${labels[status] || status}?`)) return;
  try {
    const res = await fetch(`${API}/api/orders/${id}/status`, {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error();
    const o = orders.find(x => x.id === id);
    if (o) o.status = status;
    renderOrders();
    closeModal('orderModal');
    const msgs = { processing:'Заказ взят в работу', completed:'Заказ завершён', cancelled:'Заказ отменён' };
    toast(msgs[status] || 'Статус обновлён', status === 'cancelled' ? 'warning' : 'success');
    // refresh stats
    fetch(`${API}/api/stats`).then(r=>r.json()).then(updateStats).catch(()=>{});
  } catch { toast('Ошибка обновления статуса', 'error'); }
}

// ===== ORDER MODAL =====
function openOrderModal(id) {
  const o = orders.find(x => x.id === id);
  if (!o) return;
  const statusLabel = { new:'Новый', processing:'В работе', completed:'Завершён', cancelled:'Отменён' };
  const statusClass = { new:'badge-new', processing:'badge-processing', completed:'badge-completed', cancelled:'badge-cancelled' };
  const date = o.date ? new Date(o.date).toLocaleString('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
  const customer = customers.find(c => c.email === o.customerEmail);
  const isReturning = customer && customer.ordersCount > 1;

  document.getElementById('modalOrderTitle').textContent = `Заказ ${o.id}`;
  document.getElementById('orderModalBody').innerHTML = `
    ${isReturning ? `<div class="returning-badge"><i class="fas fa-redo"></i> Повторный клиент — ${customer.ordersCount} заказов, потрачено ${(customer.totalSpent||0).toLocaleString('ru-RU')} ₽</div>` : ''}
    <div class="modal-grid">
      <div>
        <div class="modal-section">
          <h4>Заказ</h4>
          <div class="modal-row"><strong>Номер</strong><span style="font-weight:600">${o.id}</span></div>
          <div class="modal-row"><strong>Дата</strong><span>${date}</span></div>
          <div class="modal-row"><strong>Статус</strong><span class="badge ${statusClass[o.status]||'badge-new'}">${statusLabel[o.status]||'Новый'}</span></div>
          <div class="modal-row" style="margin-top:12px"><strong>Сумма</strong><div class="order-total">${o.total ? o.total.toLocaleString('ru-RU') + ' ₽' : '—'}</div></div>
        </div>
      </div>
      <div>
        <div class="modal-section">
          <h4>Клиент</h4>
          <div class="modal-row"><strong>Имя</strong><span>${o.customerName || '—'}</span></div>
          <div class="modal-row"><strong>Телефон</strong><a href="tel:${o.customerPhone}">${o.customerPhone || '—'}</a></div>
          <div class="modal-row"><strong>Email</strong><a href="mailto:${o.customerEmail}">${o.customerEmail || '—'}</a></div>
        </div>
      </div>
    </div>
    ${o.message ? `<div class="modal-section"><h4>Комментарий</h4><div class="message-box">${o.message}</div></div>` : ''}
    <div class="modal-actions">
      ${o.status === 'new' ? `<button class="act-btn act-process" onclick="setStatus('${o.id}','processing')"><i class="fas fa-play"></i> Взять в работу</button>` : ''}
      ${o.status === 'processing' ? `<button class="act-btn act-complete" onclick="setStatus('${o.id}','completed')"><i class="fas fa-check"></i> Завершить</button>` : ''}
      ${o.status !== 'completed' && o.status !== 'cancelled' ? `<button class="act-btn act-cancel" onclick="setStatus('${o.id}','cancelled')"><i class="fas fa-times"></i> Отменить</button>` : ''}
    </div>`;
  document.getElementById('orderModal').style.display = 'flex';
}

// ===== CUSTOMER MODAL =====
function openCustomerModal(id) {
  const c = customers.find(x => x.id == id);
  if (!c) return;
  const cOrders = orders.filter(o => o.customerEmail === c.email).sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
  const firstDate = c.firstOrder ? new Date(c.firstOrder).toLocaleDateString('ru-RU') : '—';
  const lastDate = c.lastOrder ? new Date(c.lastOrder).toLocaleDateString('ru-RU') : '—';
  const avg = c.ordersCount > 0 ? Math.round((c.totalSpent||0) / c.ordersCount) : 0;
  const statusLabel = { new:'Новый', processing:'В работе', completed:'Завершён', cancelled:'Отменён' };
  const statusClass = { new:'badge-new', processing:'badge-processing', completed:'badge-completed', cancelled:'badge-cancelled' };

  document.getElementById('modalCustomerTitle').textContent = c.name || 'Клиент';
  document.getElementById('customerModalBody').innerHTML = `
    <div class="modal-grid">
      <div class="modal-section">
        <h4>Информация</h4>
        <div class="modal-row"><strong>Имя</strong><span style="font-weight:500">${c.name || '—'}</span></div>
        <div class="modal-row"><strong>Первый заказ</strong><span>${firstDate}</span></div>
        <div class="modal-row"><strong>Последний заказ</strong><span>${lastDate}</span></div>
      </div>
      <div class="modal-section">
        <h4>Контакты</h4>
        <div class="modal-row"><strong>Телефон</strong><a href="tel:${c.phone}">${c.phone || '—'}</a></div>
        <div class="modal-row"><strong>Email</strong><a href="mailto:${c.email}">${c.email || '—'}</a></div>
      </div>
    </div>
    <div class="cust-stats">
      <div class="cust-stat"><div class="cust-stat-val">${c.ordersCount||0}</div><div class="cust-stat-label">Заказов</div></div>
      <div class="cust-stat"><div class="cust-stat-val">${(c.totalSpent||0).toLocaleString('ru-RU')} ₽</div><div class="cust-stat-label">Потрачено</div></div>
      <div class="cust-stat"><div class="cust-stat-val">${avg.toLocaleString('ru-RU')} ₽</div><div class="cust-stat-label">Ср. чек</div></div>
    </div>
    ${cOrders.length > 0 ? `
    <div class="modal-section" style="margin-top:16px">
      <h4>История заказов (${cOrders.length})</h4>
      <div style="max-height:220px;overflow-y:auto">
        ${cOrders.map(o => `
          <div class="order-mini">
            <div><div class="order-mini-id">${o.id}</div><div class="order-mini-date">${o.date ? new Date(o.date).toLocaleDateString('ru-RU') : '—'}</div></div>
            <div class="order-mini-right">
              <div class="order-mini-total">${o.total ? o.total.toLocaleString('ru-RU') + ' ₽' : '—'}</div>
              <span class="badge ${statusClass[o.status]||'badge-new'}" style="font-size:.68rem">${statusLabel[o.status]||'Новый'}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>` : ''}
    <div class="modal-actions">
      ${c.phone ? `<a href="tel:${c.phone}" class="act-btn act-process"><i class="fas fa-phone"></i> Позвонить</a>` : ''}
      ${c.email ? `<a href="mailto:${c.email}" class="act-btn act-view"><i class="fas fa-envelope"></i> Email</a>` : ''}
    </div>`;
  document.getElementById('customerModal').style.display = 'flex';
}

// ===== MODALS CLOSE =====
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
document.getElementById('closeOrderModal').addEventListener('click', () => closeModal('orderModal'));
document.getElementById('closeCustomerModal').addEventListener('click', () => closeModal('customerModal'));
document.getElementById('orderModal').addEventListener('click', e => { if (e.target === document.getElementById('orderModal')) closeModal('orderModal'); });
document.getElementById('customerModal').addEventListener('click', e => { if (e.target === document.getElementById('customerModal')) closeModal('customerModal'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal('orderModal'); closeModal('customerModal'); } });

// ===== TOAST =====
let toastT;
function toast(msg, type = 'success') {
  const t = document.getElementById('adminToast');
  t.textContent = msg; t.className = `a-toast ${type} show`;
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 4000);
}

// ===== GLOBAL (called from inline HTML) =====
window.openOrderModal = openOrderModal;
window.openCustomerModal = openCustomerModal;
window.setStatus = setStatus;

// ===== INIT =====
checkAuth();
