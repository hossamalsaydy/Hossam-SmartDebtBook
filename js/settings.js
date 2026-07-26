/* =========================================================
   settings.js — الإعدادات: المظهر، العملة، بيانات النشاط، عن المطوّر
   ========================================================= */

const SettingsUI = (() => {

  const DEV_WHATSAPP = '778470907';
  const DEV_NAME = 'المهندس حسام الصائدي';

  function init() {
    applyTheme(Settings.get().theme);
    hydrateSettingsForm();

    document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

    document.getElementById('currencySelect').addEventListener('change', (e) => {
      Settings.set({ currency: e.target.value });
      Utils.toast('تم تحديث عملة العرض', 'success');
      App.refreshDashboard();
      ClientsUI.renderClientsTable();
      TransactionsUI.renderTxTable();
    });

    document.getElementById('businessNameInput').addEventListener('change', (e) => {
      Settings.set({ businessName: e.target.value.trim() });
    });
    document.getElementById('businessPhoneInput').addEventListener('change', (e) => {
      Settings.set({ businessPhone: e.target.value.trim() });
    });

    document.getElementById('settingsExportAllBtn').addEventListener('click', () => ExportModule.exportAllCSV());
    document.getElementById('wipeDataBtn').addEventListener('click', () => {
      App.confirmAction(
        'حذف جميع البيانات',
        'سيتم حذف جميع العملاء والمعاملات نهائياً من هذا الجهاز. يُفضّل تصدير نسخة Excel أولاً. هل تريد المتابعة؟',
        () => {
          DB.wipeAll();
          Utils.toast('تم حذف جميع البيانات', 'success');
          App.refreshDashboard();
          ClientsUI.renderClientsTable();
          TransactionsUI.renderTxTable();
          App.navigate('dashboard');
        }
      );
    });

    // نافذة عن المطوّر
    document.getElementById('openAboutBtn').addEventListener('click', () => {
      document.getElementById('aboutWhatsappLink').href =
        `https://wa.me/${DEV_WHATSAPP}?text=${encodeURIComponent('مرحباً مهندس حسام، أود الاستفسار عن تطبيق دفتر الديون')}`;
      App.showModal('aboutModal');
    });
  }

  function hydrateSettingsForm() {
    const s = Settings.get();
    document.getElementById('currencySelect').value = s.currency;
    document.getElementById('businessNameInput').value = s.businessName;
    document.getElementById('businessPhoneInput').value = s.businessPhone;
    updateThemeLabel(s.theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeLabel(theme);
  }

  function updateThemeLabel(theme) {
    const label = document.getElementById('themeToggleLabel');
    if (label) label.textContent = theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن';
  }

  function toggleTheme() {
    const current = Settings.get().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    Settings.set({ theme: next });
    applyTheme(next);
    setTimeout(() => {
      App.refreshDashboard();
    }, 50);
  }

  return { init };
})();
