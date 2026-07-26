/* =========================================================
   voice.js — التسجيل الصوتي الذكي:
   1) تحويل الصوت إلى نص عبر Web Speech API (يعمل من المتصفح مباشرة)
   2) تحليل النص باستخدام محرك تحليل قواعدي متخصص للعربية
      (يستخرج: اسم العميل، المبلغ، نوع المعاملة، الملاحظة)
   3) حساب درجة ثقة ثم عرض نموذج مراجعة قبل الحفظ
   ========================================================= */

const VoiceUI = (() => {
  let recognition = null;
  let isRecording = false;
  let lastParsed = null;
  let finalTranscript = '';

  // كلمات دالة على السداد/الدفع
  const PAYMENT_KEYWORDS = [
    'دفع', 'دفعلي', 'دفع لي', 'سدد', 'تسديد', 'سداد', 'استلمت', 'استلام',
    'قبضت', 'قبض', 'رجع', 'ارجع', 'وصلني', 'وفى', 'وفا', 'سلمني', 'حصلت على'
  ];
  // كلمات دالة على الدين
  const DEBT_KEYWORDS = [
    'دين', 'ديون', 'عليه', 'على', 'أخذ', 'اخذ', 'استلف', 'سلفة', 'سلف',
    'اشترى', 'باقي', 'له علي', 'مديون', 'حساب', 'فاتورة', 'خذ'
  ];
  // كلمات وصل بين الاسم والفعل يجب تجاهلها عند استخراج الاسم
  const STOP_WORDS = [
    'من', 'على', 'عليه', 'له', 'الى', 'إلى', 'ريال', 'ريالات', 'دولار',
    'درهم', 'دينار', 'جنيه', 'مبلغ', 'قيمة', 'سجل', 'اضف', 'أضف'
  ];
  const CURRENCY_WORDS = ['ريال', 'ريالات', 'دولار', 'دولارات', 'درهم', 'دراهم', 'دينار', 'جنيه', 'جنيهات'];

  const ARABIC_NUMBER_WORDS = {
    'صفر': 0, 'واحد': 1, 'اثنين': 2, 'اثنان': 2, 'ثلاثة': 3, 'ثلاث': 3, 'اربعة': 4, 'أربعة': 4,
    'خمسة': 5, 'خمسه': 5, 'ستة': 6, 'سته': 6, 'سبعة': 7, 'سبعه': 7, 'ثمانية': 8, 'ثمانيه': 8,
    'تسعة': 9, 'تسعه': 9, 'عشرة': 10, 'عشره': 10, 'عشرين': 20, 'ثلاثين': 30, 'اربعين': 40,
    'أربعين': 40, 'خمسين': 50, 'ستين': 60, 'سبعين': 70, 'ثمانين': 80, 'تسعين': 90,
    'مية': 100, 'مائة': 100, 'مئة': 100, 'الف': 1000, 'ألف': 1000, 'آلاف': 1000, 'الاف': 1000
  };

  function init() {
    const micBtn = document.getElementById('micBtn');
    micBtn.addEventListener('click', toggleRecording);
    document.getElementById('dashQuickVoiceBtn').addEventListener('click', () => {
      App.navigate('voice');
      setTimeout(() => micBtn.focus(), 200);
    });
    document.getElementById('voiceDiscardBtn').addEventListener('click', discardReview);
    document.getElementById('voiceSaveBtn').addEventListener('click', saveReviewedTx);

    setupRecognition();
    ClientsUI.refreshClientNameLists();
  }

  function setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const note = document.getElementById('voiceSupportNote');
    if (!SpeechRecognition) {
      note.textContent = 'ملاحظة: متصفحك الحالي لا يدعم التعرف على الصوت مباشرة. يمكنك استخدام متصفح Chrome، أو كتابة الجملة يدوياً في مربع النص أدناه بعد الضغط على "إدخال يدوي".';
      addManualFallback();
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      finalTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t + ' ';
        else interim += t;
      }
      showTranscript((finalTranscript + interim).trim());
    };

    recognition.onerror = (event) => {
      stopRecordingUI();
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        Utils.toast('يرجى السماح للمتصفح باستخدام الميكروفون', 'error');
      } else if (event.error === 'no-speech') {
        Utils.toast('لم يتم رصد صوت، حاول مرة أخرى', 'error');
      } else {
        Utils.toast('حدث خطأ أثناء التسجيل الصوتي', 'error');
      }
    };

    recognition.onend = () => {
      stopRecordingUI();
      if (finalTranscript.trim()) {
        analyzeTranscript(finalTranscript.trim());
      }
    };
  }

  function addManualFallback() {
    const stage = document.querySelector('.voice-stage');
    const wrap = document.createElement('div');
    wrap.className = 'transcript-box';
    wrap.style.width = '100%';
    wrap.style.maxWidth = '520px';
    wrap.innerHTML = `
      <div class="transcript-head"><span>إدخال يدوي للجملة</span></div>
      <textarea id="manualTranscriptInput" rows="2" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:10px;background:var(--card-bg);color:var(--ink-900);" placeholder="مثال: أحمد عليه دين مية ريال قهوة"></textarea>
      <div class="form-actions"><button class="btn btn-primary" id="manualAnalyzeBtn">تحليل الجملة</button></div>
    `;
    stage.appendChild(wrap);
    document.getElementById('manualAnalyzeBtn').addEventListener('click', () => {
      const val = document.getElementById('manualTranscriptInput').value.trim();
      if (!val) { Utils.toast('يرجى كتابة جملة أولاً', 'error'); return; }
      showTranscript(val);
      analyzeTranscript(val);
    });
  }

  function toggleRecording() {
    if (!recognition) { Utils.toast('التعرف الصوتي غير مدعوم في هذا المتصفح', 'error'); return; }
    if (isRecording) {
      recognition.stop();
    } else {
      try {
        finalTranscript = '';
        document.getElementById('voiceReviewCard').hidden = true;
        recognition.start();
        startRecordingUI();
      } catch (e) {
        Utils.toast('تعذر بدء التسجيل، حاول مجدداً', 'error');
      }
    }
  }

  function startRecordingUI() {
    isRecording = true;
    document.getElementById('micBtn').classList.add('recording');
    document.getElementById('micStatus').textContent = 'جاري الاستماع... اضغط للإيقاف';
    document.getElementById('micWave').hidden = false;
  }

  function stopRecordingUI() {
    isRecording = false;
    document.getElementById('micBtn').classList.remove('recording');
    document.getElementById('micStatus').textContent = 'اضغط للبدء بالتسجيل';
    document.getElementById('micWave').hidden = true;
  }

  function showTranscript(text) {
    const box = document.getElementById('transcriptBox');
    box.hidden = false;
    document.getElementById('transcriptText').textContent = text || '...';
  }

  /* =====================================================
     محرك التحليل: يحوّل نص عربي حر إلى بيانات معاملة منظمة
     ===================================================== */
  function analyzeTranscript(rawText) {
    const text = Utils.normalizeDigits(rawText);
    const norm = ' ' + Utils.normalizeArabic(text) + ' ';

    let confidencePoints = 0;
    const maxPoints = 3;

    // --- 1) تحديد نوع المعاملة ---
    let type = 'debt';
    let typeMatched = false;
    for (const kw of PAYMENT_KEYWORDS) {
      if (norm.includes(' ' + Utils.normalizeArabic(kw))) { type = 'payment'; typeMatched = true; break; }
    }
    if (!typeMatched) {
      for (const kw of DEBT_KEYWORDS) {
        if (norm.includes(' ' + Utils.normalizeArabic(kw))) { type = 'debt'; typeMatched = true; break; }
      }
    }
    if (typeMatched) confidencePoints++;

    // --- 2) استخراج المبلغ (أرقام أو كلمات عددية عربية) ---
    let amount = extractAmount(text);
    if (amount && amount > 0) confidencePoints++;

    // --- 3) استخراج اسم العميل ---
    const nameGuess = extractClientName(text);
    let matchedClient = null, matchScore = 0;
    if (nameGuess) {
      const result = DB.findClientByName(nameGuess);
      matchedClient = result.client;
      matchScore = result.score;
      if (matchedClient) confidencePoints++;
      else if (nameGuess.length >= 2) confidencePoints += 0.5;
    }

    // --- 4) استخراج ملاحظة (بقية الجملة بعد إزالة المبلغ والفعل) ---
    const note = extractNote(text, type);

    const confidence = Math.min(1, confidencePoints / maxPoints);

    lastParsed = {
      type,
      amount: amount || '',
      clientName: matchedClient ? matchedClient.name : (nameGuess || ''),
      clientId: matchedClient ? matchedClient.id : null,
      note,
      confidence
    };

    renderConfidenceBadge(confidence);
    openReviewForm(lastParsed);
  }

  function extractAmount(text) {
    const norm = Utils.normalizeDigits(text);
    // رقم صريح مثل 500 أو 1200.50
    const numMatch = norm.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) return parseFloat(numMatch[1]);

    // صياغات عددية عربية شائعة: "خمسمية" / "مية وخمسين" / "ألفين"
    const words = Utils.normalizeArabic(text).split(' ');
    let total = 0, found = false, lastHundredBase = 0;

    // معالجة أنماط: "خمسمية" (مدمجة) عبر البحث عن بادئة رقمية + مية
    const compoundHundred = norm.match(/(مئتين|مئتان|ثلاثمية|ثلاثمائة|اربعمية|أربعمية|اربعمائة|خمسمية|خمسمائة|ستمية|ستمائة|سبعمية|سبعمائة|ثمانمية|ثمانمائة|تسعمية|تسعمائة)/);
    const compoundMap = {
      'مئتين': 200, 'مئتان': 200, 'ثلاثمية': 300, 'ثلاثمائة': 300, 'اربعمية': 400, 'أربعمية': 400,
      'اربعمائة': 400, 'خمسمية': 500, 'خمسمائة': 500, 'ستمية': 600, 'ستمائة': 600,
      'سبعمية': 700, 'سبعمائة': 700, 'ثمانمية': 800, 'ثمانمائة': 800, 'تسعمية': 900, 'تسعمائة': 900
    };
    if (compoundHundred) { total += compoundMap[compoundHundred[1]] || 0; found = true; }

    words.forEach((w) => {
      if (ARABIC_NUMBER_WORDS[w] !== undefined) {
        total += ARABIC_NUMBER_WORDS[w];
        found = true;
      }
    });

    // "الفين" / "ثلاثة الاف"
    const thousandMatch = norm.match(/(الفين|ألفين)/);
    if (thousandMatch) { total += 2000; found = true; }

    return found ? total : null;
  }

  function extractClientName(text) {
    const norm = Utils.normalizeArabic(text);
    let words = norm.split(' ').filter(Boolean);

    // احذف أرقام وكلمات عملة وكلمات وصل معروفة ودالة الفعل
    const allKeywords = [...PAYMENT_KEYWORDS, ...DEBT_KEYWORDS, ...STOP_WORDS, ...CURRENCY_WORDS, 'سجل', 'اضف', 'أضف']
      .map(Utils.normalizeArabic);

    words = words.filter(w => {
      if (/^\d+(\.\d+)?$/.test(w)) return false;
      if (ARABIC_NUMBER_WORDS[w] !== undefined) return false;
      if (allKeywords.includes(w)) return false;
      return true;
    });

    if (words.length === 0) return '';
    // خذ أول كلمتين متبقيتين كاسم مرشح (الاسم غالباً في بداية الجملة)
    return words.slice(0, 2).join(' ');
  }

  function extractNote(text, type) {
    const norm = Utils.normalizeArabic(text);
    let words = norm.split(' ').filter(Boolean);
    const skip = [...PAYMENT_KEYWORDS, ...DEBT_KEYWORDS, ...STOP_WORDS, ...CURRENCY_WORDS, 'سجل', 'اضف', 'أضف']
      .map(Utils.normalizeArabic);
    words = words.filter(w => {
      if (/^\d+(\.\d+)?$/.test(w)) return false;
      if (ARABIC_NUMBER_WORDS[w] !== undefined) return false;
      if (skip.includes(w)) return false;
      return true;
    });
    // أزل أول كلمتين (الاسم المفترض) من الملاحظة
    const rest = words.slice(2).join(' ').trim();
    return rest;
  }

  function renderConfidenceBadge(confidence) {
    const badge = document.getElementById('confidenceBadge');
    const pct = Math.round(confidence * 100);
    badge.textContent = `الثقة: ${pct}%`;
    badge.className = 'badge ' + (confidence >= 0.7 ? 'high' : confidence >= 0.4 ? '' : 'low');
  }

  function openReviewForm(parsed) {
    document.getElementById('voiceReviewCard').hidden = false;
    document.getElementById('vrClientName').value = parsed.clientName || '';
    document.getElementById('vrClientName').dataset.clientId = parsed.clientId || '';
    document.getElementById('vrType').value = parsed.type;
    document.getElementById('vrAmount').value = parsed.amount || '';
    document.getElementById('vrDate').value = Utils.todayISO();
    document.getElementById('vrNote').value = parsed.note || '';

    const tag = document.getElementById('vrClientTag');
    tag.textContent = parsed.clientId ? 'عميل موجود ✓' : (parsed.clientName ? 'عميل جديد' : '');
    ClientsUI.refreshClientNameLists();

    document.getElementById('voiceReviewCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function discardReview() {
    document.getElementById('voiceReviewCard').hidden = true;
    document.getElementById('transcriptBox').hidden = true;
    lastParsed = null;
  }

  function saveReviewedTx() {
    const nameInput = document.getElementById('vrClientName');
    const name = nameInput.value.trim();
    const amount = parseFloat(document.getElementById('vrAmount').value);

    if (!name) { Utils.toast('يرجى إدخال اسم العميل', 'error'); return; }
    if (!amount || amount <= 0) { Utils.toast('يرجى إدخال مبلغ صحيح', 'error'); return; }

    let client = null;
    if (nameInput.dataset.clientId) client = DB.getClient(nameInput.dataset.clientId);
    if (!client) {
      const found = DB.findClientByName(name);
      client = found.client && found.score >= 0.9 ? found.client : DB.saveClient({ name });
    }

    const tx = {
      clientId: client.id,
      type: document.getElementById('vrType').value,
      amount,
      date: document.getElementById('vrDate').value || Utils.todayISO(),
      note: document.getElementById('vrNote').value.trim()
    };
    DB.saveTransaction(tx);
    Utils.toast(`تم حفظ المعاملة لصالح ${client.name}`, 'success');

    discardReview();
    TransactionsUI.renderTxTable();
    ClientsUI.renderClientsTable();
    App.refreshDashboard();
  }

  return { init };
})();
