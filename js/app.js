/* =========================================================
   app.js — نقطة الدخول الرئيسية: التنقل، لوحة التحكم، النوافذ المنبثقة
   ========================================================= */

const App = (() => {
  let currentView = 'dashboard';
  let confirmCallback = null;

  function init() {
    SettingsUI.init();
    ClientsUI.init();
    TransactionsUI.init();
    VoiceUI.init();

    setupNav();
    setupModals();
    setupMobileMenu();

    document.getElementById('txDateInput').value = Utils.todayISO();
    document.getElementById('vrDate') && (document.getElementById('vrDate').value = Utils.todayISO());

    ClientsUI.renderClientsTable();
    TransactionsUI.renderTxTable();
    ClientsUI.refreshClientNameLists();
    refreshDashboard();

    // حذف شاشة البداية بعد الحركة
    setTimeout(() => {
      const splash = document.getElementById('splash');
      if (splash) splash.remove();
    }, 1700);
  }

  function setupNav() {
    document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.view));
    });
    document.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.goto));
    });
  }

  function navigate(viewName) {
    currentView = viewName;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    if (viewName === 'dashboard') refreshDashboard();
    if (viewName === 'clients') ClientsUI.renderClientsTable();
    if (viewName === 'transactions') TransactionsUI.renderTxTable();
    if (viewName === 'reports') renderReports();

    closeMobileSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getCurrentView() { return currentView; }

  /* ---------------- Dashboard ---------------- */
  function refreshDashboard() {
    const currency = Settings.get().currency;
    const totals = DB.totals();
    document.getElementById('statTotalDebt').textContent = Utils.formatNumber(totals.debt);
    document.getElementById('statTotalPaid').textContent = Utils.formatNumber(totals.paid);
    document.getElementById('statNetBalance').textContent = Utils.formatNumber(Math.max(0, totals.balance));
    document.getElementById('statClientCount').textContent = DB.getClients().length;

    renderTopDebtors('topDebtorsList', 5);
    renderRecentTx();
    renderMonthlyChart('monthlyChart');
  }

  function renderTopDebtors(containerId, limit) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const clients = DB.getClients().map(c => ({ ...c, bal: DB.clientBalance(c.id) }));
    const debtors = clients.filter(c => c.bal.balance > 0).sort((a, b) => b.bal.balance - a.bal.balance).slice(0, limit);

    if (debtors.length === 0) {
      el.innerHTML = `<p class="muted">لا يوجد عملاء عليهم مبالغ مستحقة حالياً 🎉</p>`;
      return;
    }
    const maxVal = debtors[0].bal.balance || 1;
    const currency = Settings.get().currency;
    el.innerHTML = debtors.map((c, i) => `
      <div class="ranked-row">
        <div class="rank-badge">${i + 1}</div>
        <div class="rname">${Utils.escapeHtml(c.name)}</div>
        <div class="rank-bar-track"><div class="rank-bar-fill" style="width:${(c.bal.balance / maxVal) * 100}%"></div></div>
        <div class="ramount">${Utils.formatMoney(c.bal.balance, currency)}</div>
      </div>
    `).join('');
    el.querySelectorAll('.ranked-row').forEach((row, i) => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => ClientsUI.openClientDetail(debtors[i].id));
    });
  }

  function renderRecentTx() {
    const el = document.getElementById('recentTxList');
    const txs = DB.getTransactions().slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
    const currency = Settings.get().currency;
    if (txs.length === 0) {
      el.innerHTML = `<p class="muted">لا توجد معاملات مسجّلة بعد. جرّب "تسجيل سريع بالصوت" أعلاه.</p>`;
      return;
    }
    el.innerHTML = txs.map(t => {
      const c = DB.getClient(t.clientId);
      const iconPath = t.type === 'debt'
        ? '<path d="M12 5v14m-7-7h14"/>'
        : '<path d="M20 6 9 17l-5-5"/>';
      return `
        <div class="tx-row">
          <div class="tx-icon ${t.type}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${iconPath}</svg>
          </div>
          <div class="tx-main">
            <strong>${c ? Utils.escapeHtml(c.name) : 'عميل محذوف'}</strong>
            <span>${Utils.formatDate(t.date)} ${t.note ? '· ' + Utils.escapeHtml(t.note) : ''}</span>
          </div>
          <div class="tx-amount ${t.type}">${t.type === 'debt' ? '+' : '-'} ${Utils.formatMoney(t.amount, currency)}</div>
        </div>
      `;
    }).join('');
  }

  function getLast6Months() {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('ar-EG', { month: 'short' }) });
    }
    return months;
  }

  function renderMonthlyChart(canvasId) {
    const months = getLast6Months();
    const debtSeries = new Array(6).fill(0);
    const paySeries = new Array(6).fill(0);
    DB.getTransactions().forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const idx = months.findIndex(m => m.key === key);
      if (idx > -1) {
        if (t.type === 'debt') debtSeries[idx] += Number(t.amount) || 0;
        else paySeries[idx] += Number(t.amount) || 0;
      }
    });
    Charts.drawGroupedBar(canvasId, months.map(m => m.label), debtSeries, paySeries, 'ديون', 'سداد');
  }

  /* ---------------- Reports ---------------- */
  function renderReports() {
    const currency = Settings.get().currency;
    const totals = DB.totals();
    document.getElementById('repTotalDebt').textContent = Utils.formatNumber(totals.debt);
    document.getElementById('repTotalPaid').textContent = Utils.formatNumber(totals.paid);
    const rate = totals.debt > 0 ? Math.round((totals.paid / totals.debt) * 100) : 0;
    document.getElementById('repCollectionRate').textContent = rate + '%';

    renderMonthlyChart('reportBarChart');

    const clients = DB.getClients().map(c => ({ ...c, bal: DB.clientBalance(c.id) }));
    const debtors = clients.filter(c => c.bal.balance > 0);
    const settled = clients.filter(c => c.bal.balance === 0).length;
    const creditors = clients.filter(c => c.bal.balance < 0).length;
    Charts.drawPie('reportPieChart', {
      'مدينون': debtors.length,
      'مسدّدون': settled,
      'لهم رصيد': creditors
    });

    renderTopDebtors('reportTopDebtors', 10);

    document.getElementById('exportAllBtn').onclick = () => ExportModule.exportAllCSV();
  }

  /* ---------------- Modals ---------------- */
  function setupModals() {
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => hideModal(btn.dataset.close));
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideModal(overlay.id);
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(o => { if (!o.hidden) hideModal(o.id); });
      }
    });
    document.getElementById('confirmActionBtn').addEventListener('click', () => {
      if (confirmCallback) confirmCallback();
      hideModal('confirmModal');
    });
  }

  function showModal(id) {
    document.getElementById(id).hidden = false;
  }
  function hideModal(id) {
    document.getElementById(id).hidden = true;
  }

  function confirmAction(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = callback;
    showModal('confirmModal');
  }

  /* ---------------- Mobile sidebar ---------------- */
  function setupMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    btn.addEventListener('click', () => {
      sidebar.classList.add('open');
      overlay.classList.add('show');
    });
    overlay.addEventListener('click', closeMobileSidebar);
  }
  function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
  }

  return {
    init, navigate, getCurrentView, refreshDashboard,
    showModal, hideModal, confirmAction
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
