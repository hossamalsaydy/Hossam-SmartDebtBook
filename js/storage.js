/* =========================================================
   storage.js — طبقة تخزين البيانات محلياً (localStorage)
   ========================================================= */

const DB = (() => {
  const KEYS = {
    clients: 'dl_clients_v1',
    transactions: 'dl_transactions_v1'
  };

  function _read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('تعذر قراءة البيانات', e);
      return [];
    }
  }

  function _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('تعذر حفظ البيانات', e);
      Utils.toast('تعذر حفظ البيانات — الذاكرة المحلية ممتلئة أو غير متاحة', 'error');
      return false;
    }
  }

  // ---------------- Clients ----------------
  function getClients() {
    return _read(KEYS.clients);
  }

  function getClient(id) {
    return getClients().find(c => c.id === id) || null;
  }

  function saveClient(client) {
    const list = getClients();
    if (client.id) {
      const idx = list.findIndex(c => c.id === client.id);
      if (idx > -1) {
        list[idx] = { ...list[idx], ...client, updatedAt: Date.now() };
      }
    } else {
      client.id = Utils.uid('cl');
      client.createdAt = Date.now();
      client.updatedAt = Date.now();
      list.push(client);
    }
    _write(KEYS.clients, list);
    return client;
  }

  function deleteClient(id) {
    const list = getClients().filter(c => c.id !== id);
    _write(KEYS.clients, list);
    const txs = getTransactions().filter(t => t.clientId !== id);
    _write(KEYS.transactions, txs);
  }

  function findClientByName(name) {
    const list = getClients();
    const normalizedTarget = Utils.normalizeArabic(name);
    // exact match first
    let match = list.find(c => Utils.normalizeArabic(c.name) === normalizedTarget);
    if (match) return { client: match, score: 1 };
    // best fuzzy match
    let best = null, bestScore = 0;
    list.forEach(c => {
      const score = Utils.similarity(c.name, name);
      if (score > bestScore) { bestScore = score; best = c; }
    });
    if (best && bestScore >= 0.6) return { client: best, score: bestScore };
    return { client: null, score: bestScore };
  }

  // ---------------- Transactions ----------------
  function getTransactions() {
    return _read(KEYS.transactions);
  }

  function getClientTransactions(clientId) {
    return getTransactions()
      .filter(t => t.clientId === clientId)
      .sort((a, b) => new Date(a.date) - new Date(b.date) || a.createdAt - b.createdAt);
  }

  function saveTransaction(tx) {
    const list = getTransactions();
    if (tx.id) {
      const idx = list.findIndex(t => t.id === tx.id);
      if (idx > -1) list[idx] = { ...list[idx], ...tx };
    } else {
      tx.id = Utils.uid('tx');
      tx.createdAt = Date.now();
      list.push(tx);
    }
    _write(KEYS.transactions, list);
    return tx;
  }

  function deleteTransaction(id) {
    const list = getTransactions().filter(t => t.id !== id);
    _write(KEYS.transactions, list);
  }

  function getTransaction(id) {
    return getTransactions().find(t => t.id === id) || null;
  }

  // ---------------- Balances ----------------
  function clientBalance(clientId) {
    const txs = getClientTransactions(clientId);
    let debt = 0, paid = 0;
    txs.forEach(t => {
      if (t.type === 'debt') debt += Number(t.amount) || 0;
      else paid += Number(t.amount) || 0;
    });
    return { debt, paid, balance: debt - paid };
  }

  function totals() {
    const txs = getTransactions();
    let debt = 0, paid = 0;
    txs.forEach(t => {
      if (t.type === 'debt') debt += Number(t.amount) || 0;
      else paid += Number(t.amount) || 0;
    });
    return { debt, paid, balance: debt - paid };
  }

  function wipeAll() {
    localStorage.removeItem(KEYS.clients);
    localStorage.removeItem(KEYS.transactions);
  }

  return {
    getClients, getClient, saveClient, deleteClient, findClientByName,
    getTransactions, getClientTransactions, saveTransaction, deleteTransaction, getTransaction,
    clientBalance, totals, wipeAll
  };
})();

/* =========================================================
   Settings — تفضيلات التطبيق (المظهر، العملة، بيانات النشاط)
   ========================================================= */
const Settings = (() => {
  const KEY = 'dl_settings_v1';
  const DEFAULTS = {
    theme: 'light',
    currency: 'ريال',
    businessName: '',
    businessPhone: ''
  };

  function get() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch (e) {
      return { ...DEFAULTS };
    }
  }

  function set(patch) {
    const current = get();
    const updated = { ...current, ...patch };
    localStorage.setItem(KEY, JSON.stringify(updated));
    return updated;
  }

  return { get, set };
})();
