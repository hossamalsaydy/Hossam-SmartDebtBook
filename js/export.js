/* =========================================================
   export.js — تصدير البيانات (Excel/CSV) وفواتير PDF ومشاركة واتساب
   ملاحظة: يتم توليد ملفات CSV بترميز UTF-8 مع BOM لضمان
   ظهور النصوص العربية بشكل صحيح عند فتحها في Microsoft Excel.
   ========================================================= */

const ExportModule = (() => {

  function downloadCSV(filename, rows) {
    const csv = rows.map(row =>
      row.map(cell => {
        const v = (cell ?? '').toString().replace(/"/g, '""');
        return `"${v}"`;
      }).join(',')
    ).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Utils.toast('تم تصدير الملف بنجاح', 'success');
  }

  function exportClientsCSV() {
    const clients = DB.getClients();
    const rows = [['اسم العميل', 'الهاتف', 'العنوان', 'إجمالي الدين', 'إجمالي السداد', 'الرصيد المستحق', 'ملاحظات']];
    clients.forEach(c => {
      const bal = DB.clientBalance(c.id);
      rows.push([c.name, c.phone || '', c.address || '', bal.debt, bal.paid, bal.balance, c.notes || '']);
    });
    downloadCSV(`عملاء_${Utils.todayISO()}.csv`, rows);
  }

  function exportTransactionsCSV() {
    const txs = DB.getTransactions().slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const rows = [['التاريخ', 'العميل', 'النوع', 'المبلغ', 'ملاحظة']];
    txs.forEach(t => {
      const c = DB.getClient(t.clientId);
      rows.push([t.date, c ? c.name : 'عميل محذوف', t.type === 'debt' ? 'دين' : 'سداد', t.amount, t.note || '']);
    });
    downloadCSV(`معاملات_${Utils.todayISO()}.csv`, rows);
  }

  function exportAllCSV() {
    exportClientsCSV();
    setTimeout(() => exportTransactionsCSV(), 400);
  }

  function exportClientStatementCSV(clientId) {
    const c = DB.getClient(clientId);
    if (!c) return;
    const txs = DB.getClientTransactions(clientId);
    const rows = [[`كشف حساب: ${c.name}`], ['التاريخ', 'النوع', 'ملاحظة', 'المبلغ', 'الرصيد بعدها']];
    let running = 0;
    txs.forEach(t => {
      running += t.type === 'debt' ? Number(t.amount) : -Number(t.amount);
      rows.push([t.date, t.type === 'debt' ? 'دين' : 'سداد', t.note || '', t.amount, running]);
    });
    downloadCSV(`كشف_حساب_${c.name}_${Utils.todayISO()}.csv`, rows);
  }

  /* ---------------- فاتورة PDF عبر الطباعة ---------------- */
  function printClientInvoice(clientId) {
    const c = DB.getClient(clientId);
    if (!c) { Utils.toast('يرجى اختيار عميل أولاً', 'error'); return; }
    const settings = Settings.get();
    const txs = DB.getClientTransactions(clientId);
    const bal = DB.clientBalance(clientId);

    let running = 0;
    const rowsHtml = txs.map(t => {
      running += t.type === 'debt' ? Number(t.amount) : -Number(t.amount);
      return `<tr>
        <td>${Utils.formatDate(t.date)}</td>
        <td>${t.type === 'debt' ? 'دين' : 'سداد'}</td>
        <td>${Utils.escapeHtml(t.note || '—')}</td>
        <td>${Utils.formatMoney(t.amount, settings.currency)}</td>
        <td>${Utils.formatMoney(running, settings.currency)}</td>
      </tr>`;
    }).join('');

    const invoiceEl = document.getElementById('printInvoice');
    invoiceEl.innerHTML = `
      <div class="inv-head">
        <div>
          <h1>${Utils.escapeHtml(settings.businessName || 'كشف حساب عميل')}</h1>
          <p>${settings.businessPhone ? 'هاتف: ' + Utils.escapeHtml(settings.businessPhone) : ''}</p>
        </div>
        <div style="text-align:left">
          <p><strong>العميل:</strong> ${Utils.escapeHtml(c.name)}</p>
          <p><strong>الهاتف:</strong> ${Utils.escapeHtml(c.phone || '—')}</p>
          <p><strong>التاريخ:</strong> ${Utils.formatDate(Utils.todayISO())}</p>
        </div>
      </div>
      <table>
        <thead><tr><th>التاريخ</th><th>النوع</th><th>ملاحظة</th><th>المبلغ</th><th>الرصيد بعدها</th></tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="5">لا توجد معاملات</td></tr>'}</tbody>
      </table>
      <div class="inv-total">
        إجمالي الدين: ${Utils.formatMoney(bal.debt, settings.currency)} &nbsp;|&nbsp;
        إجمالي السداد: ${Utils.formatMoney(bal.paid, settings.currency)} &nbsp;|&nbsp;
        الرصيد المستحق: ${Utils.formatMoney(Math.abs(bal.balance), settings.currency)} ${bal.balance < 0 ? '(رصيد للعميل)' : ''}
      </div>
    `;

    window.print();
  }

  /* ---------------- إرسال تقرير عبر واتساب ---------------- */
  function sendClientReportWhatsapp(clientId) {
    const c = DB.getClient(clientId);
    if (!c) { Utils.toast('يرجى اختيار عميل أولاً', 'error'); return; }
    const settings = Settings.get();
    const bal = DB.clientBalance(clientId);

    const lines = [
      `مرحباً ${c.name}،`,
      settings.businessName ? `تحية من ${settings.businessName}` : '',
      `إجمالي الدين: ${Utils.formatMoney(bal.debt, settings.currency)}`,
      `إجمالي المسدد: ${Utils.formatMoney(bal.paid, settings.currency)}`,
      `الرصيد المستحق حالياً: ${Utils.formatMoney(Math.abs(bal.balance), settings.currency)} ${bal.balance < 0 ? '(رصيد لكم)' : ''}`,
      'شكراً لتعاملكم معنا.'
    ].filter(Boolean);

    const text = encodeURIComponent(lines.join('\n'));
    const phone = (c.phone || '').replace(/[^\d]/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  }

  return {
    exportClientsCSV, exportTransactionsCSV, exportAllCSV, exportClientStatementCSV,
    printClientInvoice, sendClientReportWhatsapp
  };
})();
