/**
 * lehuedanghocta - Main Application Controller (v3.0)
 * - Lộ trình A1 / A2 / B1 rõ ràng + YouTube Shadowing Studio
 * - Phản xạ 5 câu từ Từ đơn chính (Anh - Việt, viết hoa từ đầu câu) + Từ nối
 * - Nhập từ vựng hàng loạt (Copy 1 loạt từ / Tải File + AI tự nhận diện)
 * - Giao diện Trắng & Gradient #9DCCFF
 */

const COMMON_CONNECTORS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'as', 'into', 'about', 'during', 'within', 'after', 'before', 'since',
  'am', 'is', 'are', 'was', 'were', 'be', 'been',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would',
  'and', 'or', 'so', 'than', 'that', 'who', 'which', 'my', 'your', 'our', 'their'
]);

const AppState = {
  dataset: { lessons: [], questions: [], vocabulary: [], grammarTopics: [] },
  userState: null,
  activeTab: 'listening', // 'listening' | 'reflex' | 'vocab' | 'progress'
  // Module 1: Roadmap Stage & YouTube Shadowing
  selectedStage: 'A1', // 'A1' | 'A2' | 'B1' | 'YOUTUBE'
  selectedLessonId: 'a1-lesson-1',
  selectedYoutubeId: 'yt-default-1',
  isPlayingLesson: false,
  activeSentenceId: null,
  mediaRecorder: null,
  audioChunks: [],
  recordingSentenceId: null,
  speechRecognizer: null,
  recognizedTranscript: '',
  currentAudioObj: null,
  // Module 2: Reflex & Spaced Repetition (Batch of 5)
  reflexBatch: [],
  reflexIndex: 0,
  reflexScore: 0,
  reflexAnswered: false,
  reflexFilterLesson: 'all',
  // Module 3: Vocab Flashcard & Typing
  vocabSubMode: 'flashcard', // 'flashcard' | 'typing'
  vocabFilterLesson: 'all',
  vocabList: [],
  vocabIndex: 0,
  isCardFlipped: false,
  typingRevealedCount: 0,
  // Module 4: Reminder Timer
  reminderIntervalId: null
};

/* ==========================================
   1. KHỞI TẠO ỨNG DỤNG (INITIALIZATION)
   ========================================== */
document.addEventListener('DOMContentLoaded', async () => {
  await loadDataset();
  initUserSession();
  ensureYoutubeDefaults();
  mergeUserCustomLessons();
  populateLessonDropdowns();
  setupNavigation();
  setupAccountAndSettingsEvents();
  checkAndUpdateDailyStreak(false);
  startStudyReminderTimer();

  // Khởi tạo giao diện các Module
  renderHeaderStats();
  renderListeningModule();
  startNewReflexBatch();
  renderGrammarHub();
  initVocabModule();
  renderProgressModule();

  // Đăng ký PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});

async function loadDataset() {
  try {
    const res = await fetch('./data/lessons.json');
    if (!res.ok) throw new Error('Không thể tải file lessons.json');
    AppState.dataset = await res.json();
  } catch (err) {
    if (window.FALLBACK_DATASET) {
      AppState.dataset = window.FALLBACK_DATASET;
    } else {
      console.error('Lỗi tải dữ liệu bài học:', err);
    }
  }
  if (AppState.dataset.lessons && AppState.dataset.lessons.length > 0) {
    AppState.selectedLessonId = AppState.dataset.lessons[0].id;
    AppState.selectedStage = AppState.dataset.lessons[0].stage || 'A1';
  }
}

function initUserSession() {
  AppState.userState = window.accountManager.getUserState();
  updateAccountUI();
}

function ensureYoutubeDefaults() {
  if (!AppState.userState.youtubeLessons || AppState.userState.youtubeLessons.length === 0) {
    AppState.userState.youtubeLessons = [
      {
        id: 'yt-default-1',
        videoId: 'jul2urONzOQ',
        title: 'YouTube 1: Luyện nghe Giao tiếp Phản xạ Hàng ngày',
        url: 'https://www.youtube.com/watch?v=jul2urONzOQ',
        transcript: [
          {
            id: 'yt1-s1',
            en: 'Could you please repeat that a little bit slower?',
            vi: 'Bạn có thể vui lòng nhắc lại chậm hơn một chút được không?'
          },
          {
            id: 'yt1-s2',
            en: 'I have been practicing English shadowing every day this week.',
            vi: 'Tôi đã luyện nói đuổi tiếng Anh mỗi ngày trong tuần này.'
          },
          {
            id: 'yt1-s3',
            en: 'It is a great pleasure to meet you in person today.',
            vi: 'Thật vinh dự được gặp trực tiếp bạn ngày hôm nay.'
          }
        ]
      },
      {
        id: 'yt-default-2',
        videoId: 'hA21L1982_8',
        title: 'YouTube 2: Tiếng Anh Công sở & Thuyết trình tự nhiên',
        url: 'https://www.youtube.com/watch?v=hA21L1982_8',
        transcript: [
          {
            id: 'yt2-s1',
            en: 'Let us go over the main points of our presentation today.',
            vi: 'Hãy cùng điểm qua các ý chính trong bài thuyết trình của chúng ta hôm nay.'
          },
          {
            id: 'yt2-s2',
            en: 'Feel free to ask any questions at the end of the meeting.',
            vi: 'Cứ thoải mái đặt bất kỳ câu hỏi nào vào cuối buổi họp nhé.'
          }
        ]
      }
    ];
    saveState();
  }
}

function saveState() {
  window.accountManager.saveUserState(AppState.userState);
  renderHeaderStats();
}

/* ==========================================
   2. ĐIỀU HƯỚNG TAB (LAPTOP & MOBILE)
   ========================================== */
function setupNavigation() {
  const navButtons = document.querySelectorAll('[data-tab-target]');
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab-target');
      switchTab(target);
    });
  });
}

function switchTab(tabName) {
  AppState.activeTab = tabName;
  document.querySelectorAll('.tab-section').forEach((sec) => {
    sec.classList.toggle('hidden', sec.id !== `tab-${tabName}`);
  });

  document.querySelectorAll('[data-tab-target]').forEach((btn) => {
    const isMatch = btn.getAttribute('data-tab-target') === tabName;
    if (btn.classList.contains('desktop-nav-btn')) {
      btn.className = isMatch
        ? 'desktop-nav-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-brand-gradient shadow-sm transition'
        : 'desktop-nav-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-[#9DCCFF]/30 transition';
    } else if (btn.classList.contains('mobile-nav-btn')) {
      btn.className = isMatch
        ? 'mobile-nav-btn flex flex-col items-center justify-center py-2 px-3 text-blue-700 font-extrabold transition'
        : 'mobile-nav-btn flex flex-col items-center justify-center py-2 px-3 text-slate-500 hover:text-slate-800 transition';
    }
  });

  if (tabName === 'progress') {
    renderProgressModule();
  }
}

function renderHeaderStats() {
  const s = AppState.userState;
  if (!s) return;

  const streakCountEl = document.getElementById('header-streak-count');
  const xpCountEl = document.getElementById('header-xp-count');
  const userLabelEl = document.getElementById('header-user-label');

  if (streakCountEl) streakCountEl.textContent = s.streak?.count || 0;
  if (xpCountEl) xpCountEl.textContent = s.xp || 0;
  if (userLabelEl) {
    const uname = window.accountManager.getCurrentUsername();
    userLabelEl.textContent = uname === 'guest' ? 'Tài khoản' : s.profile?.username || uname;
  }
}

/* ==========================================
   3. MODULE 1: LỘ TRÌNH NGHE (A1 - A2 - B1) & YOUTUBE SHADOWING
   ========================================== */
window.selectRoadmapStage = function (stage) {
  stopAllAudio();
  AppState.selectedStage = stage;

  // Cập nhật màu nút chọn Lộ trình A1 | A2 | B1 | YOUTUBE
  ['A1', 'A2', 'B1', 'YOUTUBE'].forEach((st) => {
    const btn = document.getElementById(`stage-btn-${st}`);
    if (!btn) return;
    if (st === stage) {
      btn.className =
        'py-2 px-2 rounded-xl text-xs font-extrabold bg-brand-gradient shadow-sm transition flex items-center justify-center gap-1';
    } else {
      btn.className =
        st === 'YOUTUBE'
          ? 'py-2 px-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition flex items-center justify-center gap-1'
          : 'py-2 px-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-[#9DCCFF]/20 transition';
    }
  });

  const stdView = document.getElementById('standard-listening-view');
  const ytView = document.getElementById('youtube-listening-view');

  if (stage === 'YOUTUBE') {
    stdView?.classList.add('hidden');
    ytView?.classList.remove('hidden');
    renderListeningModule();
    renderCurrentYoutubeDetail();
  } else {
    stdView?.classList.remove('hidden');
    ytView?.classList.add('hidden');
    const stageLessons = (AppState.dataset.lessons || []).filter((l) => (l.stage || 'A1') === stage);
    if (stageLessons.length > 0 && !stageLessons.some((l) => l.id === AppState.selectedLessonId)) {
      AppState.selectedLessonId = stageLessons[0].id;
    }
    renderListeningModule();
  }
};

function renderListeningModule() {
  const stage = AppState.selectedStage || 'A1';
  const selectorContainer = document.getElementById('lesson-list-container');
  const stageLabelEl = document.getElementById('roadmap-stage-label');
  const stageProgEl = document.getElementById('roadmap-stage-progress');
  if (!selectorContainer) return;

  if (stage === 'YOUTUBE') {
    const ytList = AppState.userState.youtubeLessons || [];
    if (stageLabelEl) stageLabelEl.textContent = '📺 Kho Video YouTube của bạn';
    if (stageProgEl) stageProgEl.textContent = `${ytList.length} video`;

    selectorContainer.innerHTML = ytList
      .map((yt, idx) => {
        const isSelected = yt.id === AppState.selectedYoutubeId;
        return `
          <button onclick="selectYoutubeLesson('${yt.id}')"
            class="w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-start justify-between gap-2 ${
              isSelected
                ? 'bg-brand-gradient border-[#5CA5FF] shadow-sm'
                : 'bg-white border-slate-200 hover:border-[#9DCCFF]'
            }">
            <div class="min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-rose-600 text-white">YouTube #${
                  idx + 1
                }</span>
                <span class="text-xs text-slate-600">${(yt.transcript || []).length} câu luyện</span>
              </div>
              <h4 class="font-extrabold text-slate-900 text-sm truncate">${yt.title}</h4>
            </div>
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white text-rose-600 text-xs font-bold shrink-0">▶</span>
          </button>
        `;
      })
      .join('');
    return;
  }

  // Lọc danh sách bài học thuộc Lộ trình đang chọn (A1, A2, hoặc B1)
  const stageLessons = (AppState.dataset.lessons || []).filter((l) => (l.stage || 'A1') === stage);
  const completedCount = stageLessons.filter((l) =>
    (AppState.userState.completedLessons || []).includes(l.id)
  ).length;

  const stageNames = {
    A1: `Lộ trình A1 (Từ Bài 1 → Bài ${stageLessons.length})`,
    A2: `Lộ trình A2 (Từ Bài 1 → Bài ${stageLessons.length})`,
    B1: `Lộ trình B1 (Từ Bài 1 → Bài ${stageLessons.length})`
  };

  if (stageLabelEl) stageLabelEl.textContent = stageNames[stage] || `Lộ trình ${stage}`;
  if (stageProgEl) stageProgEl.textContent = `Đã xong: ${completedCount}/${stageLessons.length} bài`;

  selectorContainer.innerHTML = stageLessons
    .map((lesson, idx) => {
      const isSelected = lesson.id === AppState.selectedLessonId;
      const isDone = (AppState.userState.completedLessons || []).includes(lesson.id);
      return `
        <button onclick="selectLesson('${lesson.id}')"
          class="w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-start justify-between gap-2 ${
            isSelected
              ? 'bg-brand-gradient border-[#5CA5FF] shadow-sm'
              : 'bg-white border-slate-200 hover:border-[#9DCCFF]'
          }">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                isSelected ? 'bg-slate-900 text-white' : 'bg-[#9DCCFF]/40 text-slate-900'
              }">${stage} • Bài ${idx + 1}</span>
              <span class="text-xs text-slate-700 font-medium">⏱ ${lesson.duration}</span>
            </div>
            <h4 class="font-extrabold text-slate-900 text-sm sm:text-base truncate">${lesson.title}</h4>
            <p class="text-xs text-slate-700 line-clamp-1 mt-0.5">${lesson.topic}</p>
          </div>
          <div class="shrink-0 mt-1">
            ${
              isDone
                ? '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold" title="Đã hoàn thành">✓</span>'
                : '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/80 text-slate-700 text-xs font-bold">▶</span>'
            }
          </div>
        </button>
      `;
    })
    .join('');

  renderCurrentLessonDetail();
}

window.selectLesson = function (lessonId) {
  stopAllAudio();
  AppState.selectedLessonId = lessonId;
  renderListeningModule();
};

async function renderCurrentLessonDetail() {
  const lesson = (AppState.dataset.lessons || []).find((l) => l.id === AppState.selectedLessonId);
  if (!lesson) return;

  document.getElementById('current-lesson-title').textContent = lesson.title;
  document.getElementById('current-lesson-desc').textContent = lesson.description;
  document.getElementById('current-lesson-badge').textContent = `${lesson.level} • ${lesson.topic}`;

  const isCompleted = (AppState.userState.completedLessons || []).includes(lesson.id);
  const completeBtn = document.getElementById('btn-mark-lesson-done');
  if (completeBtn) {
    completeBtn.innerHTML = isCompleted ? '✅ Đã hoàn thành bài nghe' : '☑️ Đánh dấu hoàn thành (+20 XP)';
    completeBtn.className = isCompleted
      ? 'px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-500 text-white shadow-sm transition'
      : 'px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white hover:bg-emerald-500 hover:text-white text-slate-900 shadow-sm transition';
  }

  const transcriptEl = document.getElementById('transcript-list');
  if (!transcriptEl) return;

  const savedRecordings = await window.storageDB.getAllRecordings();
  const recMap = {};
  savedRecordings.forEach((r) => {
    recMap[r.id] = r;
  });

  transcriptEl.innerHTML = lesson.transcript
    .map((item, idx) => renderSentenceShadowingCard(item, idx, recMap))
    .join('');
}

function renderSentenceShadowingCard(item, idx, recMap) {
  const hasRec = !!recMap[item.id];
  const savedScore = recMap[item.id]?.score;
  const isRecordingThis = AppState.recordingSentenceId === item.id;
  const isPlayingThis = AppState.activeSentenceId === item.id;

  return `
    <div id="sentence-card-${item.id}" class="p-4 rounded-2xl border-2 transition-all ${
    isPlayingThis
      ? 'bg-brand-gradient-soft border-[#5CA5FF] shadow-sm'
      : 'bg-white border-[#9DCCFF]/60 hover:border-[#9DCCFF]'
  }">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="space-y-1 flex-1">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-brand-gradient text-slate-900 text-xs font-extrabold flex items-center justify-center shrink-0">${
              idx + 1
            }</span>
            <p class="font-bold text-slate-900 text-base leading-snug cursor-pointer hover:text-blue-700 transition"
               onclick="speakText('${item.en.replace(/'/g, "\\'")}')">${item.en}</p>
          </div>
          ${item.ipa ? `<p class="text-xs font-mono text-blue-600 pl-8">${item.ipa}</p>` : ''}
          <p class="text-sm text-slate-600 pl-8">${item.vi || ''}</p>
        </div>

        <div class="flex flex-wrap items-center gap-2 pl-8 sm:pl-0 shrink-0">
          <button onclick="speakText('${item.en.replace(/'/g, "\\'")}')"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#9DCCFF]/30 text-slate-900 hover:bg-[#9DCCFF]/60 transition">
            <span>🔊</span> Nghe mẫu
          </button>

          <button onclick="toggleRecordSentence('${item.id}', '${item.en.replace(/'/g, "\\'")}')"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
              isRecordingThis
                ? 'bg-rose-600 text-white recording-pulse'
                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
            }">
            <span>${isRecordingThis ? '⏹ Dừng thu' : '🎙️ Thu âm'}</span>
          </button>

          ${
            hasRec
              ? `
            <button onclick="playSavedRecording('${item.id}')"
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition">
              <span>▶️ Giọng bạn</span>
              ${
                savedScore !== null && savedScore !== undefined
                  ? `<span class="px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-950 text-[11px] font-extrabold">${savedScore}%</span>`
                  : ''
              }
            </button>
          `
              : ''
          }
        </div>
      </div>
      <div id="rec-feedback-${item.id}" class="hidden mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-700 pl-8"></div>
    </div>
  `;
}

/* ==========================================
   3B. YOUTUBE SHADOWING STUDIO
   ========================================== */
function extractYoutubeVideoId(url) {
  if (!url) return null;
  const clean = url.trim();
  const regExp = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;
  const match = clean.match(regExp);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
  return null;
}

window.selectYoutubeLesson = function (ytId) {
  AppState.selectedYoutubeId = ytId;
  renderListeningModule();
  renderCurrentYoutubeDetail();
};

window.loadAndSaveYoutubeVideo = function () {
  const urlInput = document.getElementById('yt-url-input');
  const titleInput = document.getElementById('yt-title-input');
  const rawUrl = urlInput?.value?.trim();
  const customTitle = titleInput?.value?.trim();

  const videoId = extractYoutubeVideoId(rawUrl);
  if (!videoId) {
    showToast('Link YouTube chưa hợp lệ! Hãy dán link dạng https://www.youtube.com/watch?v=... hoặc https://youtu.be/...', 'error');
    return;
  }

  const newYt = {
    id: `yt-${Date.now()}`,
    videoId,
    title: customTitle || `Video YouTube (${videoId})`,
    url: rawUrl,
    transcript: [
      {
        id: `yt-${Date.now()}-s1`,
        en: 'Repeat after the speaker in the video to practice your intonation.',
        vi: 'Hãy nói đuổi theo người nói trong video để luyện ngữ điệu của bạn.'
      }
    ]
  };

  if (!AppState.userState.youtubeLessons) AppState.userState.youtubeLessons = [];
  AppState.userState.youtubeLessons.unshift(newYt);
  AppState.selectedYoutubeId = newYt.id;
  saveState();

  if (urlInput) urlInput.value = '';
  if (titleInput) titleInput.value = '';

  renderListeningModule();
  renderCurrentYoutubeDetail();
  showToast('📺 Đã mở và lưu Video YouTube vào danh sách học của bạn!', 'success');
};

async function renderCurrentYoutubeDetail() {
  const ytList = AppState.userState.youtubeLessons || [];
  const currentYt = ytList.find((y) => y.id === AppState.selectedYoutubeId) || ytList[0];
  if (!currentYt) return;

  AppState.selectedYoutubeId = currentYt.id;
  const iframe = document.getElementById('yt-iframe-player');
  const targetSrc = `https://www.youtube.com/embed/${currentYt.videoId}?enablejsapi=1&rel=0`;
  if (iframe && iframe.getAttribute('src') !== targetSrc) {
    iframe.setAttribute('src', targetSrc);
  }

  const savedRecordings = await window.storageDB.getAllRecordings();
  const recMap = {};
  savedRecordings.forEach((r) => {
    recMap[r.id] = r;
  });

  const listEl = document.getElementById('yt-transcript-list');
  if (listEl) {
    listEl.innerHTML = (currentYt.transcript || [])
      .map((item, idx) => renderSentenceShadowingCard(item, idx, recMap))
      .join('');
  }
}

window.addYoutubePracticeSentence = function () {
  const enInput = document.getElementById('yt-sentence-en');
  const viInput = document.getElementById('yt-sentence-vi');
  const en = enInput?.value?.trim();
  const vi = viInput?.value?.trim() || 'Câu luyện Shadowing từ video YouTube';

  if (!en) {
    showToast('Bạn hãy nhập câu tiếng Anh muốn luyện thu âm nhé!', 'error');
    return;
  }

  const ytList = AppState.userState.youtubeLessons || [];
  const currentYt = ytList.find((y) => y.id === AppState.selectedYoutubeId);
  if (!currentYt) return;

  currentYt.transcript.push({
    id: `${currentYt.id}-s${Date.now()}`,
    en,
    vi
  });

  saveState();
  if (enInput) enInput.value = '';
  if (viInput) viInput.value = '';
  renderListeningModule();
  renderCurrentYoutubeDetail();
  showToast('Đã thêm câu luyện Shadowing cho video!', 'success');
};

window.generateYoutubeSentencesWithAI = async function () {
  const apiKey = AppState.userState?.settings?.apiKey?.trim();
  const ytList = AppState.userState.youtubeLessons || [];
  const currentYt = ytList.find((y) => y.id === AppState.selectedYoutubeId);
  if (!currentYt) return;

  if (!apiKey) {
    showToast('Hãy nhập Gemini API Key trong Tab 4 (Cài đặt) để AI tự động gợi ý câu theo chủ đề video nhé!', 'error');
    return;
  }

  showToast('⏳ AI đang tạo 5 câu luyện Shadowing cho video này...', 'info');
  try {
    const prompt = `Hãy tạo 5 câu giao tiếp tiếng Anh tự nhiên phù hợp để luyện đọc Shadowing theo chủ đề video: "${currentYt.title}".
Trả về đúng 5 dòng, mỗi dòng theo định dạng:
Câu tiếng Anh | Nghĩa tiếng Việt
Không viết thêm lời dẫn.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Không nhận được kết quả từ AI.');

    const lines = text.replace(/```/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
    lines.forEach((line, idx) => {
      const parts = line.split('|').map((p) => p.trim());
      if (parts[0]) {
        currentYt.transcript.push({
          id: `${currentYt.id}-ai-${Date.now()}-${idx}`,
          en: parts[0],
          vi: parts[1] || ''
        });
      }
    });

    saveState();
    renderListeningModule();
    renderCurrentYoutubeDetail();
    showToast('✨ Đã thêm 5 câu luyện Shadowing từ AI!', 'success');
  } catch (err) {
    showToast('Lỗi AI: ' + err.message, 'error');
  }
};

/* ==========================================
   3C. AUDIO & THU ÂM SHADOWING
   ========================================== */
window.playFullLessonAudio = function () {
  const lesson = (AppState.dataset.lessons || []).find((l) => l.id === AppState.selectedLessonId);
  if (!lesson) return;

  if (AppState.isPlayingLesson) {
    stopAllAudio();
    renderCurrentLessonDetail();
    updatePlayAllButtonUI(false);
    return;
  }

  stopAllAudio();
  AppState.isPlayingLesson = true;
  updatePlayAllButtonUI(true);

  const audio = new Audio(lesson.audioUrl);
  AppState.currentAudioObj = audio;

  audio.onended = () => {
    AppState.isPlayingLesson = false;
    updatePlayAllButtonUI(false);
  };

  audio.onerror = () => {
    AppState.currentAudioObj = null;
    playTranscriptSequentially(lesson.transcript, 0);
  };

  audio.play().catch(() => {
    AppState.currentAudioObj = null;
    playTranscriptSequentially(lesson.transcript, 0);
  });
};

function playTranscriptSequentially(transcriptList, index) {
  if (!AppState.isPlayingLesson || index >= transcriptList.length) {
    AppState.isPlayingLesson = false;
    AppState.activeSentenceId = null;
    updatePlayAllButtonUI(false);
    renderCurrentLessonDetail();
    return;
  }
  const currentItem = transcriptList[index];
  AppState.activeSentenceId = currentItem.id;
  renderCurrentLessonDetail();

  speakText(currentItem.en, () => {
    if (AppState.isPlayingLesson) {
      setTimeout(() => {
        playTranscriptSequentially(transcriptList, index + 1);
      }, 450);
    }
  });
}

function updatePlayAllButtonUI(isPlaying) {
  const btn = document.getElementById('btn-play-full-lesson');
  if (!btn) return;
  if (isPlaying) {
    btn.innerHTML = '<span>⏹</span> Dừng phát bài nghe';
    btn.className =
      'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold bg-rose-600 text-white shadow-sm hover:bg-rose-700 transition';
  } else {
    btn.innerHTML = '<span>🔊</span> Phát toàn bộ bài nghe';
    btn.className =
      'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold bg-slate-900 text-white shadow-sm hover:bg-slate-800 transition';
  }
}

function stopAllAudio() {
  AppState.isPlayingLesson = false;
  AppState.activeSentenceId = null;
  if (AppState.currentAudioObj) {
    AppState.currentAudioObj.pause();
    AppState.currentAudioObj = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  updatePlayAllButtonUI(false);
}

window.speakText = function (text, onEndCallback = null) {
  if (!('speechSynthesis' in window)) {
    showToast('Trình duyệt của bạn không hỗ trợ Web Speech API.', 'error');
    if (onEndCallback) onEndCallback();
    return;
  }
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const accent = AppState.userState?.settings?.voiceAccent || 'en-US';
  const rate = parseFloat(AppState.userState?.settings?.speechRate || 1.0);

  utterance.lang = accent;
  utterance.rate = rate;

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice =
    voices.find((v) => v.lang === accent && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Microsoft'))) ||
    voices.find((v) => v.lang.startsWith(accent.split('-')[0]));

  if (preferredVoice) utterance.voice = preferredVoice;
  utterance.onend = () => {
    if (onEndCallback) onEndCallback();
  };
  utterance.onerror = () => {
    if (onEndCallback) onEndCallback();
  };

  window.speechSynthesis.speak(utterance);
};

window.changeSpeechSpeed = function (speed) {
  AppState.userState.settings.speechRate = parseFloat(speed);
  saveState();
  showToast(`Đã chỉnh tốc độ đọc: ${speed}x`, 'info');
};

window.markCurrentLessonCompleted = function () {
  const lessonId = AppState.selectedLessonId;
  if (!AppState.userState.completedLessons.includes(lessonId)) {
    AppState.userState.completedLessons.push(lessonId);
    addXP(20, 'Hoàn thành bài nghe theo lộ trình');
    checkAndUpdateDailyStreak(true);
    saveState();
    renderListeningModule();
  } else {
    showToast('Bài học này đã được đánh dấu hoàn thành!', 'info');
  }
};

window.toggleRecordSentence = async function (sentenceId, targetEnglishText = '') {
  stopAllAudio();

  if (AppState.mediaRecorder && AppState.mediaRecorder.state === 'recording') {
    const stoppingId = AppState.recordingSentenceId;
    AppState.mediaRecorder.stop();
    if (AppState.speechRecognizer) {
      try {
        AppState.speechRecognizer.stop();
      } catch {}
    }
    if (stoppingId === sentenceId) return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    AppState.audioChunks = [];
    AppState.recordingSentenceId = sentenceId;
    AppState.recognizedTranscript = '';

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognizer = new SpeechRecognition();
      recognizer.lang = AppState.userState?.settings?.voiceAccent || 'en-US';
      recognizer.interimResults = true;
      recognizer.continuous = true;
      recognizer.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + ' ';
        }
        AppState.recognizedTranscript = transcript.trim();
      };
      try {
        recognizer.start();
        AppState.speechRecognizer = recognizer;
      } catch {}
    }

    const mediaRecorder = new MediaRecorder(stream);
    AppState.mediaRecorder = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) AppState.audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(AppState.audioChunks, { type: 'audio/webm' });
      stream.getTracks().forEach((track) => track.stop());

      let pronScore = null;
      if (AppState.recognizedTranscript && targetEnglishText) {
        pronScore = calculateSimilarityPercent(AppState.recognizedTranscript, targetEnglishText);
      }

      await window.storageDB.saveRecording(sentenceId, AppState.selectedLessonId, audioBlob, pronScore);
      AppState.recordingSentenceId = null;
      addXP(5, 'Luyện thu âm Shadowing');
      checkAndUpdateDailyStreak(true);

      if (AppState.selectedStage === 'YOUTUBE') {
        await renderCurrentYoutubeDetail();
      } else {
        await renderCurrentLessonDetail();
      }

      if (pronScore !== null) {
        const fbEl = document.getElementById(`rec-feedback-${sentenceId}`);
        if (fbEl) {
          fbEl.classList.remove('hidden');
          fbEl.innerHTML = `🎯 Hệ thống nghe được: <strong class="text-blue-800">"${AppState.recognizedTranscript}"</strong> — Độ khớp: <span class="font-extrabold text-emerald-600">${pronScore}%</span>`;
        }
      }
      showToast('Đã lưu bản thu âm! Bấm "Giọng bạn" để nghe lại.', 'success');
    };

    mediaRecorder.start();
    if (AppState.selectedStage === 'YOUTUBE') {
      renderCurrentYoutubeDetail();
    } else {
      renderCurrentLessonDetail();
    }
  } catch (err) {
    showToast('Vui lòng cấp quyền Micro trên trình duyệt để thu âm Shadowing.', 'error');
  }
};

window.playSavedRecording = async function (sentenceId) {
  stopAllAudio();
  const record = await window.storageDB.getRecording(sentenceId);
  if (!record || !record.blob) {
    showToast('Không tìm thấy bản ghi âm này.', 'error');
    return;
  }
  const url = URL.createObjectURL(record.blob);
  const audio = new Audio(url);
  AppState.currentAudioObj = audio;
  audio.onended = () => URL.revokeObjectURL(url);
  audio.play();
};

/* ==========================================
   4. MODULE 2: PHẢN XẠ 5 CÂU TỪ CÁC TỪ ĐƠN GỢI Ý (WORD PROMPTS)
   ========================================== */
/**
 * Tự động sinh mảng wordPrompts (Từ đơn Tiếng Anh + Tiếng Việt, từ đầu câu viết hoa)
 * nếu câu hỏi chưa có sẵn wordPrompts.
 */
function ensureWordPromptsForQuestion(q) {
  if (q.wordPrompts && q.wordPrompts.length > 0) {
    return q;
  }
  const primaryAnswer = (q.accepted_answers && q.accepted_answers[0]) || '';
  const rawTokens = primaryAnswer.trim().split(/\s+/);
  const prompts = [];
  const foundConnectors = [];

  rawTokens.forEach((tok, idx) => {
    const cleanLower = tok.toLowerCase().replace(/[.,?!]/g, '');
    if (idx === 0) {
      // Từ đứng đầu câu luôn viết hoa chữ cái đầu
      const capFirst = tok.charAt(0).toUpperCase() + tok.slice(1);
      prompts.push({ en: capFirst, vi: 'Từ đầu câu', isFirst: true });
    } else if (COMMON_CONNECTORS.has(cleanLower)) {
      foundConnectors.push(cleanLower);
    } else {
      prompts.push({ en: tok.toLowerCase(), vi: 'từ chính' });
    }
  });

  q.wordPrompts = prompts;
  if (!q.connectorsHint) {
    q.connectorsHint =
      foundConnectors.length > 0
        ? `Thêm các từ nối / trợ động từ: ${Array.from(new Set(foundConnectors)).join(', ')}`
        : 'Ghép các từ đơn và chia động từ phù hợp';
  }
  if (!q.sentenceType) {
    if (primaryAnswer.trim().endsWith('?') || /^(what|where|when|why|how|do|does|did|can|could|would|is|are)\b/i.test(primaryAnswer)) {
      q.sentenceType = 'Câu hỏi (?)';
    } else if (/\b(not|don't|doesn't|didn't|shouldn't|can't|won't|never)\b/i.test(primaryAnswer)) {
      q.sentenceType = 'Câu phủ định (-)';
    } else {
      q.sentenceType = 'Câu khẳng định (+)';
    }
  }
  return q;
}

window.startNewReflexBatch = function (filterMode = null) {
  if (filterMode !== null) {
    AppState.reflexFilterLesson = filterMode;
  }
  const allQuestions = (AppState.dataset.questions || []).map(ensureWordPromptsForQuestion);
  if (allQuestions.length === 0) return;

  const history = AppState.userState.questionHistory || {};
  const todayStr = getTodayDateString();

  let pool = [];
  if (AppState.reflexFilterLesson !== 'all' && AppState.reflexFilterLesson !== 'spaced') {
    pool = allQuestions.filter((q) => q.lessonId === AppState.reflexFilterLesson);
  } else {
    const dueOrOld = [];
    const unseen = [];

    allQuestions.forEach((q) => {
      const h = history[q.id];
      if (!h) {
        unseen.push(q);
      } else {
        dueOrOld.push(q);
      }
    });

    const pickedOld = shuffleArray(dueOrOld).slice(0, 2);
    const pickedNew = shuffleArray(unseen).slice(0, 5 - pickedOld.length);
    pool = shuffleArray([...pickedOld, ...pickedNew]);

    if (pool.length < 5) {
      const remaining = allQuestions.filter((q) => !pool.some((p) => p.id === q.id));
      pool = [...pool, ...shuffleArray(remaining).slice(0, 5 - pool.length)];
    }
  }

  AppState.reflexBatch = pool.slice(0, 5);
  AppState.reflexIndex = 0;
  AppState.reflexScore = 0;
  AppState.reflexAnswered = false;

  renderReflexQuestion();
};

function renderReflexQuestion() {
  const container = document.getElementById('reflex-card-container');
  if (!container) return;

  const batch = AppState.reflexBatch;
  if (!batch || batch.length === 0) {
    container.innerHTML = `<p class="text-center text-slate-500 py-8">Chưa có câu hỏi nào trong bài này.</p>`;
    return;
  }

  if (AppState.reflexIndex >= batch.length) {
    renderReflexSummary(container);
    return;
  }

  const q = ensureWordPromptsForQuestion(batch[AppState.reflexIndex]);
  const h = (AppState.userState.questionHistory || {})[q.id];
  const isReviewQuestion = !!h;
  const progressPercent = Math.round((AppState.reflexIndex / batch.length) * 100);

  document.getElementById('reflex-progress-text').textContent = `Câu ${AppState.reflexIndex + 1} / ${batch.length}`;
  document.getElementById('reflex-progress-bar').style.width = `${progressPercent}%`;

  // Tạo các thẻ Từ đơn chính (Tiếng Anh + Tiếng Việt, từ đầu câu viết hoa)
  const wordPromptsHtml = (q.wordPrompts || [])
    .map((wp, idx) => {
      const isFirst = idx === 0 || wp.isFirst;
      const displayEn = isFirst ? wp.en.charAt(0).toUpperCase() + wp.en.slice(1) : wp.en;
      return `
        <button type="button" onclick="insertPromptWordToInput('${displayEn.replace(/'/g, "\\'")}')"
          class="group text-left px-3.5 py-2.5 rounded-2xl border-2 transition-all ${
            isFirst
              ? 'bg-brand-gradient border-[#5CA5FF] shadow-sm'
              : 'bg-white border-[#9DCCFF] hover:bg-[#9DCCFF]/25'
          }" title="Bấm để chèn nhanh từ này vào ô câu trả lời">
          <div class="flex items-center gap-1.5">
            ${
              isFirst
                ? `<span class="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-900 text-white">Đầu câu</span>`
                : ''
            }
            <span class="font-extrabold text-sm sm:text-base text-slate-900">${displayEn}</span>
          </div>
          <div class="text-xs text-slate-700 font-medium mt-0.5">${wp.vi || ''}</div>
        </button>
      `;
    })
    .join('<span class="text-slate-400 font-bold self-center">+</span>');

  container.innerHTML = `
    <div class="space-y-5">
      <!-- Hàng nhãn: Loại câu (Khẳng định / Phủ định / Câu hỏi) & Gợi ý từ nối -->
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full bg-brand-gradient text-slate-900">
            📌 ${q.sentenceType || 'Câu giao tiếp'}
          </span>
          <span class="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
            isReviewQuestion ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }">
            ${isReviewQuestion ? '🔄 Ôn tập Spaced Repetition' : '✨ Câu mới'}
          </span>
        </div>
        <button onclick="toggleReflexHint()" class="text-xs font-bold text-blue-700 hover:underline">
          💡 Xem gợi ý từ nối (${q.connectorsHint ? 'Có sẵn' : 'Mẹo'})
        </button>
      </div>

      <!-- Khung hiển thị CÁC TỪ ĐƠN CHÍNH (Anh - Việt, từ đầu viết hoa) + Nghĩa cả câu -->
      <div class="p-5 rounded-3xl bg-brand-gradient-soft border-2 border-[#9DCCFF] space-y-4">
        <div>
          <p class="text-xs uppercase tracking-wider font-extrabold text-slate-600 mb-1">
            🧩 Các từ đơn chính (Từ đầu câu đã viết hoa — Hãy thêm từ nối để viết thành câu hoàn chỉnh):
          </p>
          <div class="flex flex-wrap items-stretch gap-2 pt-1">
            ${wordPromptsHtml}
          </div>
        </div>

        <div class="pt-3 border-t border-[#9DCCFF]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span class="text-xs font-bold text-slate-500">Nghĩa câu cần hoàn thiện:</span>
            <p class="text-base sm:text-lg font-extrabold text-slate-900">${q.vi}</p>
          </div>
          <span class="text-[11px] text-slate-600 font-medium shrink-0">👆 Có thể bấm vào thẻ từ để chèn nhanh</span>
        </div>

        <p id="reflex-hint-box" class="hidden text-xs sm:text-sm text-slate-900 bg-white px-4 py-2.5 rounded-2xl border border-[#9DCCFF] font-medium">
          🔗 <strong>Gợi ý từ nối cần thêm:</strong> ${q.connectorsHint || q.hint}<br/>
          📐 <strong>Cấu trúc:</strong> ${q.hint}
        </p>
      </div>

      <!-- Ô nhập câu hoàn chỉnh -->
      <div class="space-y-2">
        <div class="relative">
          <textarea id="reflex-user-input" rows="2"
            placeholder="Viết lại câu tiếng Anh hoàn chỉnh (kết hợp các từ đơn ở trên + từ nối)..."
            class="w-full p-4 pr-12 rounded-2xl border-2 border-[#9DCCFF] focus:border-blue-600 outline-none text-slate-900 font-semibold resize-none"
            onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); checkReflexAnswer(); }"></textarea>
          <button onclick="dictateReflexAnswer()" title="Nói bằng giọng của bạn"
            class="absolute right-3 bottom-3 w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center transition">
            🎙️
          </button>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button onclick="document.getElementById('reflex-user-input').value = ''; document.getElementById('reflex-user-input').focus();"
            class="text-xs font-bold text-slate-500 hover:text-slate-800">
            🗑️ Xóa ô nhập
          </button>
          <div class="flex items-center gap-2">
            ${
              AppState.userState?.settings?.apiKey
                ? `<button onclick="checkReflexAnswerWithAI()" id="btn-ai-grade"
                    class="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white border-2 border-[#9DCCFF] text-slate-900 hover:bg-[#9DCCFF]/25 transition">
                    🤖 Chấm sâu bằng AI
                   </button>`
                : ''
            }
            <button onclick="checkReflexAnswer()" id="btn-check-reflex"
              class="px-5 py-2.5 rounded-xl text-sm btn-brand">
              Kiểm tra câu hoàn chỉnh
            </button>
          </div>
        </div>
      </div>

      <!-- Khu vực hiển thị kết quả chấm điểm & Levenshtein Diff -->
      <div id="reflex-feedback-area" class="hidden rounded-2xl p-5 border-2 space-y-3"></div>
    </div>
  `;

  const inputEl = document.getElementById('reflex-user-input');
  if (inputEl) inputEl.focus();
}

window.insertPromptWordToInput = function (word) {
  const inputEl = document.getElementById('reflex-user-input');
  if (!inputEl) return;
  const cleanWord = word.replace(/\?$/, '');
  const cur = inputEl.value;
  inputEl.value = cur ? `${cur.trim()} ${cleanWord} ` : `${cleanWord} `;
  inputEl.focus();
  speakText(cleanWord);
};

window.toggleReflexHint = function () {
  const hintBox = document.getElementById('reflex-hint-box');
  if (hintBox) hintBox.classList.toggle('hidden');
};

window.dictateReflexAnswer = function () {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Trình duyệt này chưa hỗ trợ nhập liệu bằng giọng nói.', 'error');
    return;
  }
  const recognizer = new SpeechRecognition();
  recognizer.lang = 'en-US';
  showToast('🎙️ Đang nghe... Hãy đọc cả câu tiếng Anh hoàn chỉnh!', 'info');
  recognizer.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const inputEl = document.getElementById('reflex-user-input');
    if (inputEl) inputEl.value = text;
  };
  recognizer.start();
};

window.checkReflexAnswer = function () {
  if (AppState.reflexAnswered) {
    nextReflexQuestion();
    return;
  }
  const inputEl = document.getElementById('reflex-user-input');
  if (!inputEl) return;
  const userRaw = inputEl.value.trim();
  if (!userRaw) {
    showToast('Bạn hãy ghép các từ đơn và từ nối thành câu hoàn chỉnh trước nhé!', 'error');
    return;
  }

  const q = AppState.reflexBatch[AppState.reflexIndex];
  const evaluation = evaluateTranslation(userRaw, q.accepted_answers);

  AppState.reflexAnswered = true;
  recordQuestionAttempt(q.id, evaluation.isPass);

  if (evaluation.isPass) {
    AppState.reflexScore++;
    addXP(10, 'Hoàn thiện đúng câu phản xạ');
    checkAndUpdateDailyStreak(true);
  }

  const fbArea = document.getElementById('reflex-feedback-area');
  if (!fbArea) return;

  fbArea.classList.remove('hidden');
  if (evaluation.status === 'perfect') {
    fbArea.className = 'rounded-2xl p-5 border-2 bg-emerald-50 border-emerald-400 space-y-3';
  } else if (evaluation.status === 'typo') {
    fbArea.className = 'rounded-2xl p-5 border-2 bg-amber-50 border-amber-400 space-y-3';
  } else {
    fbArea.className = 'rounded-2xl p-5 border-2 bg-rose-50 border-rose-400 space-y-3';
  }

  fbArea.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div>
        <h4 class="font-extrabold text-base ${
          evaluation.status === 'perfect'
            ? 'text-emerald-900'
            : evaluation.status === 'typo'
            ? 'text-amber-900'
            : 'text-rose-900'
        }">
          ${
            evaluation.status === 'perfect'
              ? '🎉 Tuyệt vời! Bạn đã ghép từ đơn và dùng từ nối chính xác (100%)'
              : evaluation.status === 'typo'
              ? `🤏 Gần chuẩn hoàn toàn! (${evaluation.similarity}% - Chú ý từ gạch chân)`
              : `❌ Chưa khớp hoàn chỉnh (${evaluation.similarity}%)`
          }
        </h4>
        <p class="text-xs text-slate-700 mt-1">Đối chiếu từng từ: ${evaluation.diffHtml}</p>
      </div>
      <button onclick="speakText('${q.accepted_answers[0].replace(/'/g, "\\'")}')"
        class="shrink-0 px-3 py-1.5 rounded-xl bg-brand-gradient text-xs font-bold">
        🔊 Nghe câu chuẩn
      </button>
    </div>

    <div class="text-sm space-y-1.5 bg-white p-4 rounded-xl border border-[#9DCCFF]">
      <p class="font-extrabold text-slate-900">✅ Câu hoàn chỉnh: <span class="text-blue-700">${q.accepted_answers[0]}</span></p>
      <p class="text-xs text-slate-600">🔗 <strong>Từ nối / Trợ động từ đã dùng:</strong> ${q.connectorsHint || q.hint}</p>
      <p class="text-xs text-slate-800 pt-1.5 border-t border-slate-100">📘 <strong>Giải thích ngữ pháp:</strong> ${
        q.grammar
      }</p>
    </div>

    <div id="ai-extra-feedback" class="hidden text-xs bg-white text-slate-900 p-3.5 rounded-xl border-2 border-[#9DCCFF]"></div>

    <div class="flex justify-end pt-1">
      <button onclick="nextReflexQuestion()"
        class="px-5 py-2.5 rounded-xl text-sm btn-brand">
        ${AppState.reflexIndex + 1 < AppState.reflexBatch.length ? 'Câu tiếp theo →' : 'Xem kết quả cụm 5 câu →'}
      </button>
    </div>
  `;

  const checkBtn = document.getElementById('btn-check-reflex');
  if (checkBtn) {
    checkBtn.textContent =
      AppState.reflexIndex + 1 < AppState.reflexBatch.length ? 'Câu tiếp theo →' : 'Hoàn thành cụm →';
  }
};

window.checkReflexAnswerWithAI = async function () {
  const apiKey = AppState.userState?.settings?.apiKey?.trim();
  if (!apiKey) {
    showToast('Vui lòng nhập Gemini API Key trong mục Cài đặt trước!', 'error');
    return;
  }
  if (!AppState.reflexAnswered) {
    window.checkReflexAnswer();
  }

  const userRaw = document.getElementById('reflex-user-input')?.value?.trim();
  const q = AppState.reflexBatch[AppState.reflexIndex];
  const aiBox = document.getElementById('ai-extra-feedback');
  if (!aiBox || !userRaw) return;

  aiBox.classList.remove('hidden');
  aiBox.innerHTML = '⏳ AI đang phân tích cách bạn dùng từ nối và chia động từ...';

  try {
    const prompt = `Bạn là giáo viên tiếng Anh. Học viên được cho các từ đơn gợi ý để viết câu mang nghĩa: "${q.vi}".
Câu học viên viết: "${userRaw}".
Câu chuẩn: "${q.accepted_answers[0]}".
Hãy nhận xét ngắn gọn trong 2-3 câu bằng tiếng Việt về cách dùng từ nối, giới từ và chia động từ của học viên.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );
    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (reply) {
      aiBox.innerHTML = `<strong>🤖 Nhận xét từ AI:</strong><br>${reply.replace(/\n/g, '<br>')}`;
    } else {
      throw new Error(data?.error?.message || 'Không nhận được phản hồi từ API.');
    }
  } catch (err) {
    aiBox.innerHTML = `⚠️ Lỗi gọi AI API: ${err.message}.`;
  }
};

window.nextReflexQuestion = function () {
  AppState.reflexIndex++;
  AppState.reflexAnswered = false;
  renderReflexQuestion();
};

function renderReflexSummary(container) {
  document.getElementById('reflex-progress-text').textContent = `Hoàn thành 5 / 5`;
  document.getElementById('reflex-progress-bar').style.width = `100%`;

  const percent = Math.round((AppState.reflexScore / AppState.reflexBatch.length) * 100);
  container.innerHTML = `
    <div class="text-center py-8 space-y-4">
      <div class="w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center text-3xl mx-auto shadow-sm">
        🏆
      </div>
      <h3 class="text-xl font-extrabold text-slate-900">Hoàn thành cụm 5 câu Phản xạ Từ đơn!</h3>
      <p class="text-slate-600 text-sm max-w-md mx-auto">
        Bạn đã ghép đúng <strong class="text-emerald-600">${AppState.reflexScore}/${AppState.reflexBatch.length}</strong> câu (${percent}%).
      </p>
      <div class="pt-2 flex flex-wrap justify-center gap-3">
        <button onclick="startNewReflexBatch()"
          class="px-6 py-3 rounded-2xl text-sm btn-brand">
          🔄 Luyện tiếp cụm 5 câu mới
        </button>
      </div>
    </div>
  `;
}

function normalizeEnglishString(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[.,?!;:"'’]/g, (m) => (m === "'" || m === '’' ? "'" : ''))
    .replace(/\bi'm\b/g, 'i am')
    .replace(/\byou're\b/g, 'you are')
    .replace(/\bwe're\b/g, 'we are')
    .replace(/\bthey're\b/g, 'they are')
    .replace(/\bhe's\b/g, 'he is')
    .replace(/\bshe's\b/g, 'she is')
    .replace(/\bit's\b/g, 'it is')
    .replace(/\bi've\b/g, 'i have')
    .replace(/\bi'll\b/g, 'i will')
    .replace(/\bi'd\b/g, 'i would')
    .replace(/\bdon't\b/g, 'do not')
    .replace(/\bdoesn't\b/g, 'does not')
    .replace(/\bdidn't\b/g, 'did not')
    .replace(/\bshouldn't\b/g, 'should not')
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function calculateSimilarityPercent(str1, str2) {
  const s1 = normalizeEnglishString(str1);
  const s2 = normalizeEnglishString(str2);
  if (!s1 && !s2) return 100;
  if (!s1 || !s2) return 0;
  const maxLen = Math.max(s1.length, s2.length);
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, Math.round(((maxLen - dist) / maxLen) * 100));
}

function evaluateTranslation(userRaw, acceptedList) {
  const normUser = normalizeEnglishString(userRaw);
  let bestScore = -1;
  let bestTarget = acceptedList[0];

  for (const ans of acceptedList) {
    const normAns = normalizeEnglishString(ans);
    if (normUser === normAns) {
      return {
        isPass: true,
        status: 'perfect',
        similarity: 100,
        bestMatch: ans,
        diffHtml: buildWordDiffHtml(userRaw, ans)
      };
    }
    const sim = calculateSimilarityPercent(normUser, normAns);
    if (sim > bestScore) {
      bestScore = sim;
      bestTarget = ans;
    }
  }

  if (bestScore >= 84) {
    return {
      isPass: true,
      status: 'typo',
      similarity: bestScore,
      bestMatch: bestTarget,
      diffHtml: buildWordDiffHtml(userRaw, bestTarget)
    };
  }

  return {
    isPass: false,
    status: 'wrong',
    similarity: bestScore,
    bestMatch: bestTarget,
    diffHtml: buildWordDiffHtml(userRaw, bestTarget)
  };
}

function buildWordDiffHtml(userStr, targetStr) {
  const userWords = userStr.trim().split(/\s+/);
  const targetWords = targetStr.trim().split(/\s+/);

  return userWords
    .map((uw, idx) => {
      const cleanUw = normalizeEnglishString(uw);
      const cleanTw = normalizeEnglishString(targetWords[idx] || '');
      if (cleanUw === cleanTw) {
        return `<span class="text-emerald-700 font-bold">${uw}</span>`;
      } else if (cleanTw && levenshteinDistance(cleanUw, cleanTw) <= 2) {
        return `<span class="underline decoration-wavy decoration-amber-500 text-amber-800 font-bold" title="Gợi ý: ${targetWords[idx]}">${uw}</span>`;
      } else {
        return `<span class="line-through text-rose-600">${uw}</span>`;
      }
    })
    .join(' ');
}

function recordQuestionAttempt(questionId, isCorrect) {
  if (!AppState.userState.questionHistory) {
    AppState.userState.questionHistory = {};
  }
  const prev = AppState.userState.questionHistory[questionId] || {
    attempts: 0,
    correct: 0,
    interval: 0
  };
  prev.attempts += 1;
  if (isCorrect) {
    prev.correct += 1;
    prev.interval = prev.interval === 0 ? 1 : Math.min(30, prev.interval * 2);
  } else {
    prev.interval = 1;
  }
  prev.lastReviewed = getTodayDateString();
  prev.nextReview = addDaysToDateString(prev.lastReviewed, prev.interval);

  AppState.userState.questionHistory[questionId] = prev;
  saveState();
}

/* ==========================================
   5. MODULE 3: FLASHCARD 3D & TYPING PRACTICE
   ========================================== */
function initVocabModule() {
  filterVocabByLesson('all');
}

window.filterVocabByLesson = function (lessonId) {
  AppState.vocabFilterLesson = lessonId;
  const allVocab = AppState.dataset.vocabulary || [];
  AppState.vocabList =
    lessonId === 'all' ? [...allVocab] : allVocab.filter((v) => v.lessonId === lessonId);
  AppState.vocabIndex = 0;
  AppState.isCardFlipped = false;
  AppState.typingRevealedCount = 0;
  renderVocabModule();
};

window.switchVocabSubMode = function (mode) {
  AppState.vocabSubMode = mode;
  AppState.isCardFlipped = false;
  AppState.typingRevealedCount = 0;

  document.getElementById('btn-submode-flashcard').className =
    mode === 'flashcard'
      ? 'px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-brand-gradient shadow-sm transition'
      : 'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-[#9DCCFF]/20 transition';

  document.getElementById('btn-submode-typing').className =
    mode === 'typing'
      ? 'px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-brand-gradient shadow-sm transition'
      : 'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-[#9DCCFF]/20 transition';

  renderVocabModule();
};

function renderVocabModule() {
  const list = AppState.vocabList;
  const container = document.getElementById('vocab-stage-container');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `<p class="text-center text-slate-500 py-8">Chưa có từ vựng nào trong mục này.</p>`;
    return;
  }

  const item = list[AppState.vocabIndex];
  const vStat = (AppState.userState.vocabProgress || {})[item.id] || { status: 'learning', typedCount: 0 };
  const isMastered = vStat.status === 'mastered';

  document.getElementById('vocab-counter-text').textContent = `Từ ${AppState.vocabIndex + 1} / ${list.length}`;

  if (AppState.vocabSubMode === 'flashcard') {
    container.innerHTML = `
      <div class="max-w-lg mx-auto space-y-5">
        <div class="perspective-1000 h-72 sm:h-80 w-full cursor-pointer select-none" onclick="flipCurrentFlashcard()">
          <div id="flashcard-3d-inner" class="flip-card-inner ${AppState.isCardFlipped ? 'is-flipped' : ''}">
            <!-- Mặt trước (Nền trắng, viền #9DCCFF) -->
            <div class="flip-card-front bg-white border-2 border-[#9DCCFF] shadow-md p-6 flex flex-col justify-between">
              <div class="flex items-center justify-between">
                <span class="text-xs font-extrabold px-3 py-1 rounded-full bg-brand-gradient text-slate-900">${item.type || 'vocab'}</span>
                <span class="text-xs font-bold px-2.5 py-1 rounded-full ${
                  isMastered ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }">${isMastered ? '✓ Đã thuộc' : 'Đang học'}</span>
              </div>
              <div class="text-center space-y-2 my-auto">
                <h3 class="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">${item.word}</h3>
                <p class="text-sm font-mono text-blue-600">${item.ipa || ''}</p>
                <button onclick="event.stopPropagation(); speakText('${item.word.replace(/'/g, "\\'")}')"
                  class="mt-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full btn-brand text-xs">
                  🔊 Phát âm
                </button>
              </div>
              <p class="text-center text-xs text-slate-400 font-medium">👆 Chạm vào thẻ để lật xem nghĩa & câu ví dụ</p>
            </div>

            <!-- Mặt sau (Gradient #9DCCFF) -->
            <div class="flip-card-back shadow-md p-6 flex flex-col justify-between border-2 border-[#7EB8FF]">
              <div class="flex items-center justify-between">
                <span class="text-xs font-extrabold px-3 py-1 rounded-full bg-white/80 text-slate-900">${item.word} (${item.type || 'word'})</span>
                <button onclick="event.stopPropagation(); speakText('${(item.example || item.word).replace(/'/g, "\\'")}')"
                  class="text-xs font-bold bg-white/80 hover:bg-white text-slate-900 px-3 py-1 rounded-full">
                  🔊 Nghe câu ví dụ
                </button>
              </div>
              <div class="text-center space-y-3 my-auto">
                <p class="text-2xl font-extrabold text-slate-950">${item.meaning}</p>
                <div class="bg-white/85 p-3.5 rounded-2xl text-left space-y-1 border border-white">
                  <p class="text-sm font-bold text-slate-900 leading-snug">"${item.example || ''}"</p>
                  <p class="text-xs text-slate-700">${item.exampleVi || ''}</p>
                </div>
              </div>
              <p class="text-center text-xs text-slate-800 font-semibold">👆 Chạm để lật lại mặt trước</p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2">
          <button onclick="prevVocabCard()"
            class="px-4 py-2.5 rounded-xl border-2 border-[#9DCCFF] bg-white hover:bg-[#9DCCFF]/20 text-xs sm:text-sm font-bold text-slate-800">
            ← Từ trước
          </button>

          <button onclick="toggleMasteredVocab('${item.id}')"
            class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition ${
              isMastered
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-brand-gradient text-slate-900'
            }">
            ${isMastered ? '✅ Đã thuộc từ này' : '☑️ Đánh dấu Đã thuộc (+5 XP)'}
          </button>

          <button onclick="nextVocabCard()"
            class="px-4 py-2.5 rounded-xl btn-brand text-xs sm:text-sm">
            Từ tiếp →
          </button>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="max-w-lg mx-auto bg-white rounded-3xl border-2 border-[#9DCCFF] p-6 space-y-5 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-extrabold px-3 py-1 rounded-full bg-brand-gradient text-slate-900">Loại từ: ${item.type || 'vocab'}</span>
          <button onclick="speakText('${item.word.replace(/'/g, "\\'")}')"
            class="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700 hover:underline">
            🔊 Nghe phát âm gợi ý
          </button>
        </div>

        <div class="text-center space-y-1 py-2">
          <p class="text-xs uppercase tracking-wider text-slate-400 font-bold">Nghĩa tiếng Việt:</p>
          <h3 class="text-2xl font-extrabold text-slate-900">${item.meaning}</h3>
          <p class="text-xs text-slate-600 italic">"${(item.example || '').replace(new RegExp(item.word, 'gi'), '_____')}"</p>
        </div>

        <div id="typing-char-boxes" class="flex flex-wrap justify-center gap-1.5 py-2">
          ${renderTypingCharBoxes('', item.word)}
        </div>

        <div class="space-y-3">
          <input type="text" id="vocab-typing-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            placeholder="Gõ từ tiếng Anh tương ứng (${item.word.length} ký tự)..."
            class="w-full p-3.5 rounded-2xl border-2 border-[#9DCCFF] focus:border-blue-600 outline-none text-center text-lg font-extrabold tracking-wide text-slate-900"
            oninput="handleVocabTypingInput(this.value)" />

          <div class="flex items-center justify-between text-xs">
            <button onclick="revealNextLetter()" class="font-bold text-blue-700 hover:underline">
              💡 Gợi ý 1 chữ cái
            </button>
            <div class="flex gap-2">
              <button onclick="prevVocabCard()" class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-bold">← Trước</button>
              <button onclick="nextVocabCard()" class="px-3 py-1.5 rounded-lg bg-brand-gradient text-slate-900 font-bold">Tiếp →</button>
            </div>
          </div>
        </div>
      </div>
    `;
    const input = document.getElementById('vocab-typing-input');
    if (input) input.focus();
  }
}

window.flipCurrentFlashcard = function () {
  AppState.isCardFlipped = !AppState.isCardFlipped;
  const inner = document.getElementById('flashcard-3d-inner');
  if (inner) inner.classList.toggle('is-flipped', AppState.isCardFlipped);
};

window.prevVocabCard = function () {
  if (AppState.vocabList.length === 0) return;
  AppState.vocabIndex = (AppState.vocabIndex - 1 + AppState.vocabList.length) % AppState.vocabList.length;
  AppState.isCardFlipped = false;
  AppState.typingRevealedCount = 0;
  renderVocabModule();
};

window.nextVocabCard = function () {
  if (AppState.vocabList.length === 0) return;
  AppState.vocabIndex = (AppState.vocabIndex + 1) % AppState.vocabList.length;
  AppState.isCardFlipped = false;
  AppState.typingRevealedCount = 0;
  renderVocabModule();
};

window.toggleMasteredVocab = function (vocabId) {
  if (!AppState.userState.vocabProgress) AppState.userState.vocabProgress = {};
  const curr = AppState.userState.vocabProgress[vocabId] || { status: 'learning', typedCount: 0 };
  if (curr.status === 'mastered') {
    curr.status = 'learning';
  } else {
    curr.status = 'mastered';
    addXP(5, 'Thuộc từ vựng mới');
    checkAndUpdateDailyStreak(true);
  }
  curr.lastPracticed = new Date().toISOString();
  AppState.userState.vocabProgress[vocabId] = curr;
  saveState();
  renderVocabModule();
};

function renderTypingCharBoxes(typedStr, targetWord) {
  const chars = targetWord.split('');
  return chars
    .map((ch, idx) => {
      if (ch === ' ') return `<span class="w-4"></span>`;
      const uCh = typedStr[idx];
      if (uCh === undefined) {
        return `<span class="w-8 h-10 rounded-lg border-2 border-[#9DCCFF] bg-[#9DCCFF]/15 flex items-center justify-center font-mono font-bold text-slate-400">_</span>`;
      }
      if (uCh.toLowerCase() === ch.toLowerCase()) {
        return `<span class="w-8 h-10 rounded-lg border-2 border-emerald-500 bg-emerald-50 text-emerald-700 flex items-center justify-center font-mono font-bold">${ch}</span>`;
      }
      return `<span class="w-8 h-10 rounded-lg border-2 border-rose-500 bg-rose-50 text-rose-700 flex items-center justify-center font-mono font-bold">${uCh}</span>`;
    })
    .join('');
}

window.handleVocabTypingInput = function (val) {
  const item = AppState.vocabList[AppState.vocabIndex];
  if (!item) return;

  const boxContainer = document.getElementById('typing-char-boxes');
  if (boxContainer) {
    boxContainer.innerHTML = renderTypingCharBoxes(val, item.word);
  }

  if (val.trim().toLowerCase() === item.word.toLowerCase()) {
    speakText(item.word);
    if (!AppState.userState.vocabProgress) AppState.userState.vocabProgress = {};
    const curr = AppState.userState.vocabProgress[item.id] || { status: 'learning', typedCount: 0 };
    curr.typedCount = (curr.typedCount || 0) + 1;
    curr.status = 'mastered';
    AppState.userState.vocabProgress[item.id] = curr;

    addXP(5, `Gõ chính xác từ "${item.word}"`);
    checkAndUpdateDailyStreak(true);
    saveState();

    setTimeout(() => {
      nextVocabCard();
    }, 650);
  }
};

window.revealNextLetter = function () {
  const item = AppState.vocabList[AppState.vocabIndex];
  if (!item) return;
  AppState.typingRevealedCount = Math.min(item.word.length, (AppState.typingRevealedCount || 0) + 1);
  const input = document.getElementById('vocab-typing-input');
  if (input) {
    input.value = item.word.slice(0, AppState.typingRevealedCount);
    input.focus();
    handleVocabTypingInput(input.value);
  }
};

/* ==========================================
   6. MODULE 4: TIẾN ĐỘ, STREAK, CALENDAR & TÀI KHOẢN
   ========================================== */
function checkAndUpdateDailyStreak(didStudyAction = false) {
  const s = AppState.userState;
  if (!s.streak) {
    s.streak = { count: 0, best: 0, lastStudyDate: null, historyDates: {} };
  }
  const today = getTodayDateString();
  const yesterday = addDaysToDateString(today, -1);

  if (didStudyAction) {
    if (!s.streak.historyDates) s.streak.historyDates = {};
    if (!s.streak.historyDates[today]) {
      s.streak.historyDates[today] = { xp: 0, actions: 0 };
    }
    s.streak.historyDates[today].actions += 1;

    if (s.streak.lastStudyDate !== today) {
      if (s.streak.lastStudyDate === yesterday) {
        s.streak.count = (s.streak.count || 0) + 1;
      } else {
        s.streak.count = 1;
      }
      s.streak.lastStudyDate = today;
      s.streak.best = Math.max(s.streak.best || 0, s.streak.count);
      showToast(`🔥 Chuỗi Streak tăng lên ${s.streak.count} ngày liên tiếp!`, 'success');
    }
    saveState();
  } else {
    if (s.streak.lastStudyDate && s.streak.lastStudyDate !== today && s.streak.lastStudyDate !== yesterday) {
      s.streak.count = 0;
      saveState();
    }
  }
}

function addXP(points, reason = '') {
  AppState.userState.xp = (AppState.userState.xp || 0) + points;
  const today = getTodayDateString();
  if (!AppState.userState.streak.historyDates) AppState.userState.streak.historyDates = {};
  if (!AppState.userState.streak.historyDates[today]) {
    AppState.userState.streak.historyDates[today] = { xp: 0, actions: 0 };
  }
  AppState.userState.streak.historyDates[today].xp += points;
  saveState();
  if (reason) {
    showToast(`+${points} XP: ${reason}`, 'success');
  }
}

function renderProgressModule() {
  const s = AppState.userState;
  if (!s) return;

  const streakEl = document.getElementById('stat-streak-days');
  const bestStreakEl = document.getElementById('stat-best-streak');
  const xpEl = document.getElementById('stat-total-xp');
  const qLearnedEl = document.getElementById('stat-questions-learned');
  const vocabMasteredEl = document.getElementById('stat-vocab-mastered');

  const qCount = Object.keys(s.questionHistory || {}).length;
  const vCount = Object.values(s.vocabProgress || {}).filter((v) => v.status === 'mastered').length;

  if (streakEl) streakEl.textContent = `${s.streak?.count || 0} ngày`;
  if (bestStreakEl) bestStreakEl.textContent = `Kỷ lục: ${s.streak?.best || 0} ngày`;
  if (xpEl) xpEl.textContent = `${s.xp || 0} XP`;
  if (qLearnedEl) qLearnedEl.textContent = `${qCount} / ${(AppState.dataset.questions || []).length}`;
  if (vocabMasteredEl) vocabMasteredEl.textContent = `${vCount} / ${(AppState.dataset.vocabulary || []).length}`;

  const calGrid = document.getElementById('study-calendar-grid');
  if (calGrid) {
    const today = getTodayDateString();
    const cells = [];
    for (let i = 27; i >= 0; i--) {
      const dateStr = addDaysToDateString(today, -i);
      const dayLog = s.streak?.historyDates?.[dateStr];
      const xpEarned = dayLog?.xp || 0;
      const dayNum = dateStr.split('-')[2];

      let bgClass = 'bg-slate-50 text-slate-400 border-slate-200';
      if (xpEarned >= 40) {
        bgClass = 'bg-brand-gradient text-slate-950 border-[#5CA5FF] font-extrabold shadow-sm';
      } else if (xpEarned > 0) {
        bgClass = 'bg-[#9DCCFF]/45 text-slate-900 border-[#9DCCFF] font-bold';
      }

      cells.push(`
        <div class="p-2 rounded-xl border text-center transition ${bgClass}" title="Ngày ${dateStr}: ${xpEarned} XP">
          <div class="text-xs">${dayNum}</div>
          <div class="text-[10px] opacity-85">${xpEarned > 0 ? `+${xpEarned}` : '-'}</div>
        </div>
      `);
    }
    calGrid.innerHTML = cells.join('');
  }
}

/* ==========================================
   7. TÀI KHOẢN ĐA THIẾT BỊ, EXPORT/IMPORT & CÀI ĐẶT
   ========================================== */
function setupAccountAndSettingsEvents() {
  updateAccountUI();
}

function updateAccountUI() {
  const s = AppState.userState;
  if (!s) return;
  const currentUsername = window.accountManager.getCurrentUsername();

  const statusBadge = document.getElementById('account-status-badge');
  if (statusBadge) {
    if (currentUsername === 'guest') {
      statusBadge.textContent = 'Chế độ Khách (Lưu trên máy này)';
      statusBadge.className = 'text-xs font-bold px-3 py-1 rounded-full bg-brand-gradient';
    } else {
      statusBadge.textContent = `Đã đăng nhập: @${currentUsername}`;
      statusBadge.className = 'text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800';
    }
  }

  const cloudInput = document.getElementById('input-cloud-url');
  const apiKeyInput = document.getElementById('input-gemini-key');
  const accentSelect = document.getElementById('select-voice-accent');
  const reminderSelect = document.getElementById('select-reminder-minutes');

  if (cloudInput) cloudInput.value = s.settings?.cloudSyncUrl || '';
  if (apiKeyInput) apiKeyInput.value = s.settings?.apiKey || '';
  if (accentSelect) accentSelect.value = s.settings?.voiceAccent || 'en-US';
  if (reminderSelect) reminderSelect.value = String(s.settings?.reminderMinutes || 15);
}

window.handleAccountAuth = async function (isRegister) {
  const userEl = document.getElementById('auth-username');
  const pinEl = document.getElementById('auth-pin');
  const cloudEl = document.getElementById('input-cloud-url');

  const username = userEl?.value || '';
  const pin = pinEl?.value || '';
  const cloudUrl = cloudEl?.value || '';

  try {
    const result = await window.accountManager.loginOrRegister(username, pin, isRegister, cloudUrl);
    AppState.userState = result.data;
    ensureYoutubeDefaults();
    mergeUserCustomLessons();
    populateLessonDropdowns();
    updateAccountUI();
    renderHeaderStats();
    renderListeningModule();
    startNewReflexBatch();
    renderVocabModule();
    renderProgressModule();

    showToast(`🎉 Chào mừng @${result.username}! Dữ liệu của bạn đã sẵn sàng.`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.handleCloudSyncNow = async function () {
  const cloudEl = document.getElementById('input-cloud-url');
  if (cloudEl && cloudEl.value.trim()) {
    AppState.userState.settings.cloudSyncUrl = cloudEl.value.trim();
    saveState();
  }
  try {
    showToast('☁️ Đang đồng bộ dữ liệu...', 'info');
    const res = await window.accountManager.syncNow();
    AppState.userState = res.data;
    mergeUserCustomLessons();
    populateLessonDropdowns();
    renderHeaderStats();
    renderProgressModule();
    showToast('✅ Đồng bộ thành công giữa Laptop và Điện thoại!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.saveAppSettings = function () {
  const cloudInput = document.getElementById('input-cloud-url');
  const apiKeyInput = document.getElementById('input-gemini-key');
  const accentSelect = document.getElementById('select-voice-accent');
  const reminderSelect = document.getElementById('select-reminder-minutes');

  if (cloudInput) AppState.userState.settings.cloudSyncUrl = cloudInput.value.trim();
  if (apiKeyInput) AppState.userState.settings.apiKey = apiKeyInput.value.trim();
  if (accentSelect) AppState.userState.settings.voiceAccent = accentSelect.value;
  if (reminderSelect) AppState.userState.settings.reminderMinutes = parseInt(reminderSelect.value, 10) || 15;

  saveState();
  startStudyReminderTimer();
  renderReflexQuestion();
  showToast('Đã lưu cài đặt thành công!', 'success');
};

window.exportProgressJSON = function () {
  const dataStr = JSON.stringify(AppState.userState, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const uname = window.accountManager.getCurrentUsername();
  a.href = url;
  a.download = `lehuedanghocta-backup-${uname}-${getTodayDateString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Đã tải xuống file sao lưu (.json) thành công!', 'success');
};

window.importProgressJSON = function (event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported || typeof imported !== 'object') {
        throw new Error('File JSON không hợp lệ.');
      }
      const merged = window.accountManager.mergeProgress(AppState.userState, imported);
      AppState.userState = merged;
      saveState();
      mergeUserCustomLessons();
      populateLessonDropdowns();
      updateAccountUI();
      renderListeningModule();
      startNewReflexBatch();
      renderVocabModule();
      renderProgressModule();
      showToast('🎉 Đã khôi phục tiến độ thành công!', 'success');
    } catch (err) {
      showToast('Lỗi đọc file JSON: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
};

/* ==========================================
   8. NHẬP HÀNG LOẠT TỪ VỰNG / GỬI FILE & AI TỰ ĐỘNG PHÂN LOẠI
   ========================================== */
window.toggleBulkVocabModal = function (show) {
  const modal = document.getElementById('bulk-vocab-modal');
  if (modal) modal.classList.toggle('hidden', !show);
};

window.handleBulkFileUpload = function (event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result || '';
    const textarea = document.getElementById('bulk-vocab-textarea');
    if (textarea) {
      textarea.value = content;
      showToast(`📄 Đã đọc nội dung từ file "${file.name}". Hãy bấm nút xử lý bên dưới!`, 'info');
    }
  };
  reader.readAsText(file);
};

/**
 * Xử lý 1 loạt từ vựng do người dùng copy vào hoặc tải file lên:
 * - Tự động nhận diện từ đơn, nghĩa tiếng Việt, đặt câu ví dụ
 * - Tự động tạo luôn cả Thẻ Flashcard 3D VÀ Câu hỏi Phản xạ Từ đơn (viết hoa từ đầu câu)
 */
window.processBulkVocabInput = async function (useAI = true) {
  const textarea = document.getElementById('bulk-vocab-textarea');
  const lessonSelect = document.getElementById('bulk-target-lesson');
  const rawText = textarea?.value?.trim();
  const targetLessonId = lessonSelect?.value || 'a1-lesson-1';

  if (!rawText) {
    showToast('Bạn hãy dán danh sách từ hoặc chọn file trước nhé!', 'error');
    return;
  }

  const apiKey = AppState.userState?.settings?.apiKey?.trim();
  if (useAI && apiKey) {
    const btn = document.getElementById('btn-bulk-ai-parse');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ AI đang nhận diện, phân loại từ và tạo câu phản xạ...';
    }
    try {
      const prompt = `Bạn là chuyên gia ngôn ngữ Anh - Việt. Người dùng gửi danh sách từ hoặc nội dung thô sau:
"""
${rawText}
"""
Hãy nhận diện các từ/cụm từ tiếng Anh quan trọng trong đó (tối đa 15 từ mỗi lần) và trả về KẾT QUẢ DƯỚI DẠNG MẢNG JSON THUẦN TÚY (không bọc trong markdown, chỉ trả về JSON hợp lệ):
[
  {
    "word": "từ tiếng Anh (viết thường)",
    "ipa": "/phiên âm IPA/",
    "type": "noun/verb/adj/adv/phrase",
    "meaning": "nghĩa tiếng Việt ngắn gọn",
    "example": "Một câu tiếng Anh hoàn chỉnh chứa từ này.",
    "exampleVi": "Nghĩa tiếng Việt của câu ví dụ.",
    "sentenceType": "Câu khẳng định (+) hoặc Câu phủ định (-) hoặc Câu hỏi (?)",
    "wordPrompts": [
      {"en": "Từ đầu câu viết hoa", "vi": "nghĩa tiếng Việt", "isFirst": true},
      {"en": "từ chính 2", "vi": "nghĩa"},
      {"en": "từ chính 3", "vi": "nghĩa"}
    ],
    "connectorsHint": "Các từ nối / trợ động từ / giới từ cần thêm để nối các wordPrompts thành câu example"
  }
]`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
          apiKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );
      const data = await res.json();
      let replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      replyText = replyText.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

      const parsedItems = JSON.parse(replyText);
      if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
        throw new Error('AI không tìm thấy từ hợp lệ.');
      }

      saveParsedBulkItems(parsedItems, targetLessonId);
      if (textarea) textarea.value = '';
      toggleBulkVocabModal(false);
      showToast(`🎉 AI đã tự động phân loại và thêm ${parsedItems.length} từ vựng + câu phản xạ mới!`, 'success');
      return;
    } catch (err) {
      console.warn('Chuyển sang chế độ tách thông minh Offline do lỗi AI:', err);
      showToast('Chuyển sang bộ nhận diện nhanh tự động...', 'info');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>✨ Tự động nhận diện & Đặt câu bằng AI + Lưu ngay</span>';
      }
    }
  } else if (useAI && !apiKey) {
    showToast('Bạn chưa nhập Gemini API Key, hệ thống sẽ tự động dùng Bộ nhận diện thông minh có sẵn!', 'info');
  }

  // Chế độ Smart Offline Parser (Không cần API Key vẫn tự động tách từ, nghĩa và tạo câu phản xạ)
  const offlineItems = parseBulkWordsOffline(rawText);
  if (offlineItems.length === 0) {
    showToast('Không nhận diện được từ nào. Hãy kiểm tra lại nội dung!', 'error');
    return;
  }
  saveParsedBulkItems(offlineItems, targetLessonId);
  if (textarea) textarea.value = '';
  toggleBulkVocabModal(false);
  showToast(`✅ Đã tự động nhận diện và thêm ${offlineItems.length} từ vựng + câu phản xạ!`, 'success');
};

function parseBulkWordsOffline(rawText) {
  // Nếu người dùng tải lên file JSON mảng từ vựng
  if (rawText.startsWith('[') || rawText.startsWith('{')) {
    try {
      const obj = JSON.parse(rawText);
      const arr = Array.isArray(obj) ? obj : obj.vocabulary || [];
      if (arr.length > 0) return arr;
    } catch {}
  }

  // Tách theo dòng hoặc dấu chấm phẩy (nếu chỉ có 1 dòng ngăn bằng dấu phẩy thì tách theo dấu phẩy)
  let lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 1 && lines[0].includes(',') && !lines[0].includes('-') && !lines[0].includes(':')) {
    lines = lines[0].split(',').map((s) => s.trim()).filter(Boolean);
  }

  const results = [];
  lines.forEach((line) => {
    // Hỗ trợ định dạng: "word - meaning | example" hoặc "word : meaning" hoặc "word, meaning" hoặc chỉ "word"
    const pipeParts = line.split('|').map((s) => s.trim());
    const mainPart = pipeParts[0];
    const customExample = pipeParts[1] || '';

    let word = mainPart;
    let meaning = 'Từ vựng tự thêm';
    const sepMatch = mainPart.match(/^([a-zA-Z0-9\s'’-]+?)\s*[-:=,\t]\s*(.+)$/);
    if (sepMatch) {
      word = sepMatch[1].trim();
      meaning = sepMatch[2].trim();
    }

    if (!word) return;
    const cleanWord = word.toLowerCase();
    const example = customExample || `I am learning how to use ${cleanWord} in a sentence.`;
    const exampleVi = customExample ? `Ví dụ với từ "${cleanWord}" (${meaning}).` : `Tôi đang học cách dùng từ "${cleanWord}" (${meaning}) trong câu.`;

    // Tạo wordPrompts với từ đầu câu viết hoa
    const tempQ = ensureWordPromptsForQuestion({
      vi: exampleVi,
      accepted_answers: [example.replace(/[.,?!]+$/, '')]
    });

    results.push({
      word: cleanWord,
      ipa: '',
      type: cleanWord.includes(' ') ? 'phrase' : 'vocab',
      meaning,
      example,
      exampleVi,
      sentenceType: tempQ.sentenceType,
      wordPrompts: tempQ.wordPrompts,
      connectorsHint: tempQ.connectorsHint
    });
  });

  return results;
}

function saveParsedBulkItems(items, lessonId) {
  if (!AppState.userState.customDataset) {
    AppState.userState.customDataset = { lessons: [], questions: [], vocabulary: [] };
  }

  items.forEach((it, idx) => {
    const stamp = `${Date.now()}-${idx}`;
    const word = (it.word || '').trim();
    if (!word) return;

    const newVocab = {
      id: `custom-v-${stamp}`,
      word,
      ipa: it.ipa || '',
      type: it.type || 'vocab',
      meaning: it.meaning || 'Từ vựng mới',
      example: it.example || `This is an example with ${word}.`,
      exampleVi: it.exampleVi || `Ví dụ với từ ${word} (${it.meaning || ''}).`,
      lessonId
    };

    const cleanAns = (newVocab.example || word).replace(/[.,?!]+$/, '');
    const newQuestion = ensureWordPromptsForQuestion({
      id: `custom-q-${stamp}`,
      lessonId,
      sentenceType: it.sentenceType || 'Câu khẳng định (+)',
      vi: newVocab.exampleVi,
      wordPrompts: it.wordPrompts && it.wordPrompts.length > 0 ? it.wordPrompts : null,
      connectorsHint: it.connectorsHint || '',
      accepted_answers: [cleanAns],
      hint: cleanAns,
      grammar: `Câu thực hành từ vựng "${word}" (${newVocab.meaning}).`
    });

    AppState.userState.customDataset.vocabulary.unshift(newVocab);
    AppState.userState.customDataset.questions.unshift(newQuestion);
  });

  saveState();
  mergeUserCustomLessons();
  populateLessonDropdowns();
  filterVocabByLesson(AppState.vocabFilterLesson);
  startNewReflexBatch(AppState.reflexFilterLesson);
  addXP(items.length * 5, `Thêm ${items.length} từ vựng mới`);
}

/* ==========================================
   9. CẨM NANG NGỮ PHÁP & TẠO BÀI HỌC MỚI
   ========================================== */
function mergeUserCustomLessons() {
  const custom = AppState.userState?.customDataset;
  if (!custom) return;

  if (Array.isArray(custom.lessons)) {
    custom.lessons.forEach((cl) => {
      if (!AppState.dataset.lessons.some((l) => l.id === cl.id)) {
        AppState.dataset.lessons.push(cl);
      }
    });
  }
  if (Array.isArray(custom.questions)) {
    custom.questions.forEach((cq) => {
      if (!AppState.dataset.questions.some((q) => q.id === cq.id)) {
        AppState.dataset.questions.unshift(cq);
      }
    });
  }
  if (Array.isArray(custom.vocabulary)) {
    custom.vocabulary.forEach((cv) => {
      if (!AppState.dataset.vocabulary.some((v) => v.id === cv.id)) {
        AppState.dataset.vocabulary.unshift(cv);
      }
    });
  }
}

function populateLessonDropdowns() {
  const lessons = AppState.dataset.lessons || [];
  const totalQ = (AppState.dataset.questions || []).length;
  const totalV = (AppState.dataset.vocabulary || []).length;

  const optionsHtml = lessons
    .map((l) => `<option value="${l.id}">[${l.stage || 'A1'}] ${l.title}</option>`)
    .join('');

  const reflexSelect = document.getElementById('select-reflex-lesson');
  if (reflexSelect) {
    reflexSelect.innerHTML =
      `<option value="all">🔀 Trộn thông minh (${totalQ} câu cũ + mới)</option>` + optionsHtml;
  }

  const vocabSelect = document.getElementById('select-vocab-lesson');
  if (vocabSelect) {
    vocabSelect.innerHTML =
      `<option value="all">Tất cả chủ đề (${totalV} từ)</option>` + optionsHtml;
  }

  const bulkTargetSelect = document.getElementById('bulk-target-lesson');
  if (bulkTargetSelect) {
    bulkTargetSelect.innerHTML = optionsHtml;
  }
}

window.switchReflexSubMode = function (mode) {
  const isTranslate = mode === 'translate';
  document.getElementById('reflex-translate-wrapper')?.classList.toggle('hidden', !isTranslate);
  document.getElementById('reflex-filter-controls')?.classList.toggle('hidden', !isTranslate);
  document.getElementById('reflex-grammar-wrapper')?.classList.toggle('hidden', isTranslate);

  const btnTrans = document.getElementById('btn-reflex-mode-translate');
  const btnGram = document.getElementById('btn-reflex-mode-grammar');
  if (btnTrans) {
    btnTrans.className = isTranslate
      ? 'px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-brand-gradient shadow-sm transition'
      : 'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-[#9DCCFF]/20 transition';
  }
  if (btnGram) {
    btnGram.className = !isTranslate
      ? 'px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-brand-gradient shadow-sm transition'
      : 'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-[#9DCCFF]/20 transition';
  }
  if (!isTranslate) {
    renderGrammarHub();
  }
};

function renderGrammarHub() {
  const wrapper = document.getElementById('reflex-grammar-wrapper');
  if (!wrapper) return;

  const topics = AppState.dataset.grammarTopics || [];
  wrapper.innerHTML = topics
    .map((t, tIdx) => {
      return `
        <div class="bg-white rounded-3xl border-2 border-[#9DCCFF] p-5 sm:p-6 shadow-sm space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-base sm:text-lg font-extrabold text-slate-900">${t.title}</h3>
            <span class="text-xs font-extrabold px-3 py-1 rounded-full bg-brand-gradient text-slate-900">Lộ trình ${t.level}</span>
          </div>

          <div class="p-3.5 rounded-2xl bg-brand-gradient-soft border border-[#9DCCFF] font-mono text-xs sm:text-sm font-bold text-slate-900">
            📐 Công thức: ${t.formula}
          </div>

          <p class="text-xs sm:text-sm text-slate-700 leading-relaxed">${t.summary}</p>

          <div class="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs sm:text-sm">
            <p class="font-bold text-slate-800">💡 Ví dụ thực tế:</p>
            ${t.examples.map((ex) => `<p class="text-slate-700 pl-2">• ${ex}</p>`).join('')}
          </div>

          <div class="pt-3 border-t border-slate-100 space-y-2.5">
            <p class="text-xs font-extrabold uppercase tracking-wider text-blue-700">✍️ Bài tập áp dụng (+10 XP):</p>
            <p class="text-sm font-bold text-slate-900">${t.quiz.question}</p>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              ${t.quiz.options
                .map(
                  (opt, oIdx) => `
                  <button onclick="checkGrammarQuizOption(${tIdx}, ${oIdx})"
                    class="px-3 py-2 rounded-xl border-2 border-[#9DCCFF] bg-white hover:bg-brand-gradient text-xs sm:text-sm font-bold text-slate-800 transition">
                    ${opt}
                  </button>
                `
                )
                .join('')}
            </div>
            <div id="gquiz-explain-${tIdx}" class="hidden p-3 rounded-xl text-xs"></div>
          </div>
        </div>
      `;
    })
    .join('');
}

window.checkGrammarQuizOption = function (topicIdx, optionIdx) {
  const topic = (AppState.dataset.grammarTopics || [])[topicIdx];
  if (!topic) return;

  const isCorrect = optionIdx === topic.quiz.answer;
  const explainBox = document.getElementById(`gquiz-explain-${topicIdx}`);
  if (!explainBox) return;

  explainBox.classList.remove('hidden');
  if (isCorrect) {
    explainBox.className = 'p-3 rounded-xl text-xs bg-emerald-50 border border-emerald-300 text-emerald-900';
    explainBox.innerHTML = `✅ <strong>Chính xác!</strong> ${topic.quiz.explanation}`;
    addXP(10, `Hoàn thành bài tập ${topic.title}`);
    checkAndUpdateDailyStreak(true);
  } else {
    explainBox.className = 'p-3 rounded-xl text-xs bg-rose-50 border border-rose-300 text-rose-900';
    explainBox.innerHTML = `❌ <strong>Chưa đúng!</strong> Đáp án đúng là <strong>"${
      topic.quiz.options[topic.quiz.answer]
    }"</strong>. ${topic.quiz.explanation}`;
  }
};

window.toggleCustomLessonModal = function (show) {
  const modal = document.getElementById('custom-lesson-modal');
  if (modal) modal.classList.toggle('hidden', !show);
};

window.saveCustomLessonManual = function () {
  const stageEl = document.getElementById('custom-lesson-stage');
  const titleEl = document.getElementById('custom-lesson-title');
  const linesEl = document.getElementById('custom-lesson-lines');
  const stage = stageEl?.value || 'A1';
  const title = titleEl?.value?.trim();
  const rawLines = linesEl?.value?.trim();

  if (!title || !rawLines) {
    showToast('Vui lòng nhập Tên bài học và ít nhất 1 dòng câu song ngữ!', 'error');
    return;
  }

  const lines = rawLines.split('\n').map((l) => l.trim()).filter(Boolean);
  const newLessonId = `${stage.toLowerCase()}-custom-${Date.now()}`;
  const transcript = [];
  const newQuestions = [];

  lines.forEach((line, idx) => {
    const parts = line.split('|').map((p) => p.trim());
    const en = parts[0] || '';
    const vi = parts[1] || 'Câu dịch tiếng Việt';
    const grammarNote = parts[2] || 'Cấu trúc câu giao tiếp thông dụng.';
    if (!en) return;

    transcript.push({
      id: `${newLessonId}-s${idx + 1}`,
      en,
      vi,
      ipa: ''
    });

    newQuestions.push(
      ensureWordPromptsForQuestion({
        id: `${newLessonId}-q${idx + 1}`,
        lessonId: newLessonId,
        vi,
        accepted_answers: [en.replace(/[.,?!]+$/, '')],
        hint: en,
        grammar: grammarNote
      })
    );
  });

  const newLessonObj = {
    id: newLessonId,
    stage,
    title,
    level: `Lộ trình ${stage}`,
    duration: '1:30',
    topic: 'Bài học tự tạo',
    audioUrl: '',
    description: `Bài học tự tạo thuộc Lộ trình ${stage} gồm ${transcript.length} câu.`,
    transcript
  };

  if (!AppState.userState.customDataset) {
    AppState.userState.customDataset = { lessons: [], questions: [], vocabulary: [] };
  }
  AppState.userState.customDataset.lessons.push(newLessonObj);
  AppState.userState.customDataset.questions.push(...newQuestions);

  saveState();
  mergeUserCustomLessons();
  populateLessonDropdowns();
  AppState.selectedStage = stage;
  AppState.selectedLessonId = newLessonId;
  selectRoadmapStage(stage);
  startNewReflexBatch();
  toggleCustomLessonModal(false);

  if (titleEl) titleEl.value = '';
  if (linesEl) linesEl.value = '';
  showToast(`🎉 Đã thêm "${title}" vào Lộ trình ${stage}!`, 'success');
};

window.generateLessonWithAI = async function () {
  const apiKey = AppState.userState?.settings?.apiKey?.trim();
  if (!apiKey) {
    showToast('Hãy nhập Gemini API Key trong Tab 4 (Cài đặt) để dùng tính năng AI tự soạn bài nhé!', 'error');
    return;
  }
  const titleEl = document.getElementById('custom-lesson-title');
  const stageEl = document.getElementById('custom-lesson-stage');
  const topicPrompt = titleEl?.value?.trim();
  const stage = stageEl?.value || 'A1';

  if (!topicPrompt) {
    showToast('Hãy nhập tên Chủ đề bạn muốn AI soạn vào ô phía trên!', 'error');
    return;
  }

  const btn = document.getElementById('btn-generate-ai-lesson');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ AI đang biên soạn bài học...';
  }

  try {
    const prompt = `Hãy tạo 5 câu giao tiếp tiếng Anh trình độ ${stage} theo chủ đề: "${topicPrompt}".
Trả về đúng 5 dòng, mỗi dòng theo định dạng:
Câu tiếng Anh | Nghĩa tiếng Việt | Giải thích ngữ pháp ngắn gọn`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Không nhận được dữ liệu từ AI.');

    const linesEl = document.getElementById('custom-lesson-lines');
    if (linesEl) linesEl.value = text.replace(/```/g, '').trim();
    showToast('✨ AI đã soạn xong 5 câu! Hãy bấm "Lưu vào lộ trình".', 'success');
  } catch (err) {
    showToast('Lỗi tạo bài bằng AI: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✨ Nhờ AI tự động biên soạn 5 câu theo chủ đề trên';
    }
  }
};

/* ==========================================
   10. THÔNG BÁO TOAST & HELPERS
   ========================================== */
function startStudyReminderTimer() {
  if (AppState.reminderIntervalId) clearInterval(AppState.reminderIntervalId);
  const mins = parseInt(AppState.userState?.settings?.reminderMinutes || 15, 10);
  if (mins <= 0) return;

  AppState.reminderIntervalId = setInterval(() => {
    showToast(
      '⏰ Nhắc nhở từ lehuedanghocta: Hãy hoàn thành thêm 1 cụm 5 câu phản xạ để giữ vững chuỗi Streak hôm nay nhé!',
      'info'
    );
  }, mins * 60 * 1000);
}

window.showToast = function (message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  let colorClass = 'bg-slate-900 text-white border-[#9DCCFF]';
  if (type === 'success') colorClass = 'bg-brand-gradient text-slate-950 border-[#5CA5FF] font-bold';
  if (type === 'error') colorClass = 'bg-rose-600 text-white border-rose-500 font-bold';

  toast.className = `px-4 py-3 rounded-2xl shadow-lg border-2 text-xs sm:text-sm flex items-center justify-between gap-3 transition-all duration-300 ${colorClass}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" class="opacity-75 hover:opacity-100 font-extrabold">✕</button>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 4200);
};

function getTodayDateString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysToDateString(dateStr, days) {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
