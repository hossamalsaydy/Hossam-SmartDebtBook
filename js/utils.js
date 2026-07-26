/* =========================================================
   utils.js — دوال مساعدة عامة تستخدم في كل أجزاء التطبيق
   ========================================================= */

const Utils = (() => {

  /** توليد معرف فريد بسيط */
  function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** تنسيق رقم بفواصل الآلاف مع رمز العملة */
  function formatMoney(num, currency) {
    const n = Number(num) || 0;
    const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const cur = currency || Settings.get().currency || 'ريال';
    return `${formatted} ${cur}`;
  }

  function formatNumber(num) {
    const n = Number(num) || 0;
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  /** تحويل الأرقام العربية والهندية إلى أرقام لاتينية */
  function normalizeDigits(str) {
    if (!str) return str;
    const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
    const easternArabic = '۰۱۲۳۴۵۶۷۸۹';
    return str.replace(/[٠-٩۰-۹]/g, (ch) => {
      let idx = arabicIndic.indexOf(ch);
      if (idx > -1) return String(idx);
      idx = easternArabic.indexOf(ch);
      if (idx > -1) return String(idx);
      return ch;
    });
  }

  function todayISO() {
    const d = new Date();
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 10);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return iso;
    }
  }

  function monthLabel(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short' });
  }

  function initials(name) {
    if (!name) return '؟';
    const parts = name.trim().split(/\s+/);
    return parts.slice(0, 2).map(p => p[0]).join('');
  }

  /** إظهار تنبيه Toast قصير */
  function toast(message, type = 'default') {
    const stack = document.getElementById('toastStack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      el.style.transition = 'all .25s ease';
      setTimeout(() => el.remove(), 260);
    }, 2600);
  }

  /** تأخير بسيط (debounce) لصناديق البحث */
  function debounce(fn, wait = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  /** تنظيف نص من التشكيل والمسافات الزائدة لتحسين المطابقة */
  function normalizeArabic(str) {
    if (!str) return '';
    return str
      .replace(/[\u064B-\u0652]/g, '')       // تشكيل
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /** مسافة Levenshtein مبسطة لمطابقة الأسماء المتقاربة */
  function similarity(a, b) {
    a = normalizeArabic(a); b = normalizeArabic(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.85;
    const al = a.length, bl = b.length;
    const dp = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
    for (let i = 0; i <= al; i++) dp[i][0] = i;
    for (let j = 0; j <= bl; j++) dp[0][j] = j;
    for (let i = 1; i <= al; i++) {
      for (let j = 1; j <= bl; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    const dist = dp[al][bl];
    return 1 - dist / Math.max(al, bl);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  return {
    uid, formatMoney, formatNumber, normalizeDigits, todayISO, formatDate,
    monthLabel, initials, toast, debounce, normalizeArabic, similarity, escapeHtml
  };
})();
