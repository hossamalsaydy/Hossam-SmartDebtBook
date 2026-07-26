/* =========================================================
   clients.js — إدارة العملاء (قائمة، بحث، إضافة/تعديل، كشف حساب)
   ========================================================= */

const ClientsUI = (() => {
  let currentDetailId = null;
  let searchTerm = '';
  let filterMode = 'all';

  function init() {
    document.getElementById('addClientBtn').addEventListener('click', () => openClientModal());
    document.getElementById('addClientBtnEmpty').addEventListener('click', () => openClientModal());
    document.getElementById('saveClientBtn').addEventListener('click', saveClientFromForm);
    document.getElementById('deleteClientBtn').addEventListener('click', confirmDeleteCurrentClient);

    document.getElementById('clientSearch').addEventListener('input', Utils.debounce((e) => {
      searchTerm = e.target.value.trim();
      renderClientsTable();
    }, 200));

    document.getElementById('clientFilter').addEventListener('change', (e) => {
      filterMode = e.target.value;
      renderClientsTable();
    });

    document.getElementById('cdAddTxBtn').addEventListener('click', () => {
      TransactionsUI.openTxModal(null, currentDetailId);
    });
    document.getElementById('cdWhatsappBtn').addEventListener('click', () => {
      ExportModule.sendClientReportWhatsapp(currentDetailId);
    });
    document.getElementById('cdPdfBtn').addEventListener('click', () => {
      ExportModule.printClientInvoice(currentDetailId);
    });
    document.getElementById('exportClientsBtn').addEventListener('click', () => {
      ExportModule.exportClientsCSV();
    });
  }

  function openClientModal(clientId = null) {
    const modal = document.getElementById('clientModal');
    const title = document.getElementById('clientModalTitle');
    const delBtn = document.getElementById('deleteClientBtn');
    document.getElementById('clientForm').reset();
    document.getElementById('clientId').value = '';

    if (clientId) {
      const c = DB.getClient(clientId);
      if (!c) return;
      title.textContent = 'تعديل بيانات العميل';
      document.getElementById('clientId').value = c.id;
      document.getElementById('clientNameInput').value = c.name || '';
      document.getElementById('clientPhoneInput').value = c.phone || '';
      document.getElementById('clientAddressInput').value = c.address || '';
      document.getElementById('clientNotesInput').value = c.notes || '';
      delBtn.hidden = false;
    } else {
      title.textContent = 'عميل جديد';
      delBtn.hidden = true;
    }
    App.showModal('clientModal');
  }

  function saveClientFromForm() {
    const name = document.getElementById('clientNameInput').value.trim();
    if (!name) { Utils.toast('يرجى إدخال اسم العميل', 'error'); return; }
    const client = {
      id: document.getElementById('clientId').value || null,
      name,
      phone: document.getElementById('clientPhoneInput').value.trim(),
      address: document.getElementById('clientAddressInput').value.trim(),
      notes: document.getElementById('clientNotesInput').value.trim()
    };
    if (!client.id) delete client.id;
    DB.saveClient(client);
    Utils.toast('تم حفظ بيانات العميل', 'success');
    App.hideModal('clientModal');
    renderClientsTable();
    App.refreshDashboard();
  }

  function confirmDeleteCurrentClient() {
    const id = document.getElementById('clientId').value;
    if (!id) return;
    App.confirmAction('حذف العميل', 'سيتم حذف العميل وجميع معاملاته نهائياً. هل أنت متأكد؟', () => {
      DB.deleteClient(id);
      Utils.toast('تم حذف العميل', 'success');
      App.hideModal('clientModal');
      renderClientsTable();
      App.refreshDashboard();
      App.navigate('clients');
    });
  }

  function getFilteredClients() {
    let clients = DB.getClients();
    if (searchTerm) {
      const t = Utils.normalizeArabic(searchTerm);
      clients = clients.filter(c =>
        Utils.normalizeArabic(c.name).includes(t) || (c.phone || '').includes(searchTerm)
      );
    }
    const withBalance = clients.map(c => ({ ...c, _balance: DB.clientBalance(c.id) }));
    if (filterMode === 'debtor') return withBalance.filter(c => c._balance.balance > 0);
    if (filterMode === 'creditor') return withBalance.filter(c => c._balance.balance < 0);
    if (filterMode === 'settled') return withBalance.filter(c => c._balance.balance === 0);
    return withBalance;
  }

  function renderClientsTable() {
    const tbody = document.getElementById('clientsTbody');
    const empty = document.getElementById('clientsEmpty');
    const clients = getFilteredClients();
    const currency = Settings.get().currency;

    tbody.innerHTML = '';
    const hasAny = DB.getClients().length > 0;
    empty.hidden = hasAny;
    document.getElementById('clientsTable').style.display = hasAny ? '' : 'none';

    clients.sort((a, b) => Math.abs(b._balance.balance) - Math.abs(a._balance.balance));

    clients.forEach(c => {
      const txs = DB.getClientTransactions(c.id);
      const last = txs[txs.length - 1];
      const pillClass = c._balance.balance > 0 ? 'pos' : c._balance.balance < 0 ? 'neg' : 'zero';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="client-cell" data-open-client="${c.id}">
            <div class="avatar">${Utils.escapeHtml(Utils.initials(c.name))}</div>
            <div>
              <strong>${Utils.escapeHtml(c.name)}</strong>
            </div>
          </div>
        </td>
        <td>${Utils.escapeHtml(c.phone || '—')}</td>
        <td><span class="balance-pill ${pillClass}">${Utils.formatMoney(Math.abs(c._balance.balance), currency)}</span></td>
        <td>${last ? Utils.formatDate(last.date) : '—'}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-edit-client="${c.id}" title="تعديل">
              <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-open-client]').forEach(el => {
      el.addEventListener('click', () => openClientDetail(el.dataset.openClient));
    });
    tbody.querySelectorAll('[data-edit-client]').forEach(el => {
      el.addEventListener('click', (e) => { e.stopPropagation(); openClientModal(el.dataset.editClient); });
    });
  }

  function openClientDetail(clientId) {
    const c = DB.getClient(clientId);
    if (!c) { Utils.toast('لم يتم العثور على العميل', 'error'); return; }
    currentDetailId = clientId;
    App.navigate('clientDetail');
    renderClientDetail();
  }

  function renderClientDetail() {
    const c = DB.getClient(currentDetailId);
    if (!c) return;
    const currency = Settings.get().currency;
    document.getElementById('cdName').textContent = c.name;
    document.getElementById('cdPhone').textContent = c.phone ? `📞 ${c.phone}` : 'لا يوجد رقم هاتف مسجّل';

    const bal = DB.clientBalance(c.id);
    document.getElementById('cdTotalDebt').textContent = Utils.formatNumber(bal.debt);
    document.getElementById('cdTotalPaid').textContent = Utils.formatNumber(bal.paid);
    const balEl = document.getElementById('cdBalance');
    balEl.textContent = Utils.formatNumber(Math.abs(bal.balance)) + (bal.balance < 0 ? ' (رصيد له)' : '');

    const txs = DB.getClientTransactions(c.id);
    const wrap = document.getElementById('cdStatement');
    if (txs.length === 0) {
      wrap.innerHTML = `<div class="empty-state"><p>لا توجد معاملات لهذا العميل بعد</p></div>`;
      return;
    }

    let running = 0;
    const rows = txs.map(t => {
      running += t.type === 'debt' ? Number(t.amount) : -Number(t.amount);
      return `
        <tr>
          <td>${Utils.formatDate(t.date)}</td>
          <td><span class="type-pill ${t.type}">${t.type === 'debt' ? 'دين' : 'سداد'}</span></td>
          <td>${Utils.escapeHtml(t.note || '—')}</td>
          <td>${Utils.formatMoney(t.amount, currency)}</td>
          <td>${Utils.formatMoney(running, currency)}</td>
          <td>
            <div class="row-actions">
              <button class="icon-btn" data-edit-tx="${t.id}" title="تعديل">
                <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    wrap.innerHTML = `
      <table class="ledger-table">
        <thead><tr><th>التاريخ</th><th>النوع</th><th>ملاحظة</th><th>المبلغ</th><th>الرصيد بعدها</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    wrap.querySelectorAll('[data-edit-tx]').forEach(el => {
      el.addEventListener('click', () => TransactionsUI.openTxModal(el.dataset.editTx));
    });
  }

  function refreshClientNameLists() {
    const clients = DB.getClients();
    ['clientNamesList', 'clientNamesList2'].forEach(id => {
      const dl = document.getElementById(id);
      if (!dl) return;
      dl.innerHTML = clients.map(c => `<option value="${Utils.escapeHtml(c.name)}">`).join('');
    });
  }

  function getCurrentDetailId() { return currentDetailId; }

  return {
    init, renderClientsTable, openClientDetail, renderClientDetail,
    refreshClientNameLists, openClientModal, getCurrentDetailId
  };
})();
