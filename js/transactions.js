/* =========================================================
   transactions.js — إدارة معاملات الديون والسداد
   ========================================================= */

const TransactionsUI = (() => {
  let searchTerm = '';
  let filterMode = 'all';
  let returnToClientDetail = false;

  function init() {
    document.getElementById('addTxBtn').addEventListener('click', () => openTxModal());
    document.getElementById('saveTxBtn').addEventListener('click', saveTxFromForm);
    document.getElementById('deleteTxBtn').addEventListener('click', confirmDeleteCurrentTx);

    document.getElementById('txSearch').addEventListener('input', Utils.debounce((e) => {
      searchTerm = e.target.value.trim();
      renderTxTable();
    }, 200));
    document.getElementById('txFilter').addEventListener('change', (e) => {
      filterMode = e.target.value;
      renderTxTable();
    });
    document.getElementById('exportTxBtn').addEventListener('click', () => ExportModule.exportTransactionsCSV());

    if (!document.getElementById('txDateInput').value) {
      document.getElementById('txDateInput').value = Utils.todayISO();
    }
  }

  function openTxModal(txId = null, prefillClientId = null) {
    const form = document.getElementById('txForm');
    form.reset();
    document.getElementById('txId').value = '';
    document.getElementById('txDateInput').value = Utils.todayISO();
    document.getElementById('deleteTxBtn').hidden = true;
    returnToClientDetail = !!prefillClientId || App.getCurrentView() === 'clientDetail';

    if (txId) {
      const t = DB.getTransaction(txId);
      if (!t) return;
      const client = DB.getClient(t.clientId);
      document.getElementById('txId').value = t.id;
      document.getElementById('txClientInput').value = client ? client.name : '';
      document.getElementById('txClientInput').dataset.clientId = t.clientId;
      document.getElementById('txTypeInput').value = t.type;
      document.getElementById('txAmountInput').value = t.amount;
      document.getElementById('txDateInput').value = t.date;
      document.getElementById('txNoteInput').value = t.note || '';
      document.getElementById('deleteTxBtn').hidden = false;
    } else if (prefillClientId) {
      const client = DB.getClient(prefillClientId);
      if (client) {
        document.getElementById('txClientInput').value = client.name;
        document.getElementById('txClientInput').dataset.clientId = client.id;
      }
    } else {
      document.getElementById('txClientInput').dataset.clientId = '';
    }

    ClientsUI.refreshClientNameLists();
    App.showModal('txModal');
  }

  function resolveClientFromInput(nameValue, datasetId) {
    if (datasetId) {
      const existing = DB.getClient(datasetId);
      if (existing && Utils.normalizeArabic(existing.name) === Utils.normalizeArabic(nameValue)) {
        return existing;
      }
    }
    const { client, score } = DB.findClientByName(nameValue);
    if (client && score >= 0.9) return client;
    // create a new client automatically
    return DB.saveClient({ name: nameValue.trim() });
  }

  function saveTxFromForm() {
    const nameInput = document.getElementById('txClientInput');
    const name = nameInput.value.trim();
    const amount = parseFloat(document.getElementById('txAmountInput').value);
    if (!name) { Utils.toast('يرجى إدخال اسم العميل', 'error'); return; }
    if (!amount || amount <= 0) { Utils.toast('يرجى إدخال مبلغ صحيح', 'error'); return; }

    const client = resolveClientFromInput(name, nameInput.dataset.clientId);
    const tx = {
      id: document.getElementById('txId').value || null,
      clientId: client.id,
      type: document.getElementById('txTypeInput').value,
      amount,
      date: document.getElementById('txDateInput').value || Utils.todayISO(),
      note: document.getElementById('txNoteInput').value.trim()
    };
    if (!tx.id) delete tx.id;
    DB.saveTransaction(tx);
    Utils.toast('تم حفظ المعاملة بنجاح', 'success');
    App.hideModal('txModal');
    renderTxTable();
    ClientsUI.renderClientsTable();
    App.refreshDashboard();
    if (returnToClientDetail && ClientsUI.getCurrentDetailId()) {
      ClientsUI.renderClientDetail();
    }
  }

  function confirmDeleteCurrentTx() {
    const id = document.getElementById('txId').value;
    if (!id) return;
    App.confirmAction('حذف المعاملة', 'هل أنت متأكد من حذف هذه المعاملة؟', () => {
      DB.deleteTransaction(id);
      Utils.toast('تم حذف المعاملة', 'success');
      App.hideModal('txModal');
      renderTxTable();
      ClientsUI.renderClientsTable();
      App.refreshDashboard();
      if (ClientsUI.getCurrentDetailId()) ClientsUI.renderClientDetail();
    });
  }

  function getFilteredTx() {
    let txs = DB.getTransactions().slice().sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);
    if (filterMode !== 'all') txs = txs.filter(t => t.type === filterMode);
    if (searchTerm) {
      const t = Utils.normalizeArabic(searchTerm);
      txs = txs.filter(tx => {
        const client = DB.getClient(tx.clientId);
        const clientName = client ? Utils.normalizeArabic(client.name) : '';
        return clientName.includes(t) || Utils.normalizeArabic(tx.note || '').includes(t);
      });
    }
    return txs;
  }

  function renderTxTable() {
    const tbody = document.getElementById('txTbody');
    const empty = document.getElementById('txEmpty');
    if (!tbody) return;
    const txs = getFilteredTx();
    const currency = Settings.get().currency;
    tbody.innerHTML = '';
    empty.hidden = DB.getTransactions().length > 0;

    txs.forEach(t => {
      const client = DB.getClient(t.clientId);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${Utils.formatDate(t.date)}</td>
        <td>${client ? Utils.escapeHtml(client.name) : 'عميل محذوف'}</td>
        <td><span class="type-pill ${t.type}">${t.type === 'debt' ? 'دين' : 'سداد'}</span></td>
        <td>${Utils.formatMoney(t.amount, currency)}</td>
        <td>${Utils.escapeHtml(t.note || '—')}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-edit-tx="${t.id}" title="تعديل">
              <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-edit-tx]').forEach(el => {
      el.addEventListener('click', () => openTxModal(el.dataset.editTx));
    });
  }

  return { init, renderTxTable, openTxModal };
})();
