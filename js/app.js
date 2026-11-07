/**
 * English Foundation Hub - Main Application Controller
 * Tối ưu cho cả Laptop & Điện thoại (PWA + Responsive + Multi-device Account Sync)
 */

const AppState = {
  dataset: { lessons: [], questions: [], vocabulary: [] },
  userState: null,
  activeTab: 'listening', // 'listening' | 'reflex' | 'vocab' | 'progress'
  // Module 1: Listening & Shadowing
  selectedLessonId: 'lesson-1',
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
  reflexFilterLesson: 'all', // 'all' | 'spaced' | lessonId
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
  }
}

function initUserSession() {
  AppState.userState = window.accountManager.getUserState();
  updateAccountUI();
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
  // Ẩn/hiện section
  document.querySelectorAll('.tab-section').forEach((sec) => {
    sec.classList.toggle('hidden', sec.id !== `tab-${tabName}`);
  });

  // Cập nhật trạng thái nút trên cả Desktop & Mobile Bottom Bar
  document.querySelectorAll('[data-tab-target]').forEach((btn) => {
    const isMatch = btn.getAttribute('data-tab-target') === tabName;
    if (btn.classList.contains('desktop-nav-btn')) {
      btn.className = isMatch
        ? 'desktop-nav-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white shadow-sm transition'
        : 'desktop-nav-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition';
    } else if (btn.classList.contains('mobile-nav-btn')) {
      btn.className = isMatch
        ? 'mobile-nav-btn flex flex-col items-center justify-center py-2 px-3 text-indigo-600 font-semibold transition'
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
    userLabelEl.textContent = uname === 'guest' ? 'Tài khoản Khách' : s.profile?.username || uname;
  }
}

/* ==========================================
   3. MODULE 1: NGHE & SHADOWING (AUDIO + RECORDING)
   ========================================== */
function renderListeningModule() {
  const lessons = AppState.dataset.lessons || [];
  const selectorContainer = document.getElementById('lesson-list-container');
  if (!selectorContainer) return;

  selectorContainer.innerHTML = lessons
    .map((lesson) => {
      const isSelected = lesson.id === AppState.selectedLessonId;
      const isDone = (AppState.userState.completedLessons || []).includes(lesson.id);
      return `
        <button onclick="selectLesson('${lesson.id}')"
          class="w-full text-left p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-2 ${
            isSelected
              ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-indigo-300'
          }">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${
                isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }">${lesson.level}</span>
              <span class="text-xs text-slate-400">⏱ ${lesson.duration}</span>
            </div>
            <h4 class="font-bold text-slate-800 text-sm sm:text-base truncate">${lesson.title}</h4>
            <p class="text-xs text-slate-500 line-clamp-1 mt-0.5">${lesson.description}</p>
          </div>
          <div class="shrink-0 mt-1">
            ${
              isDone
                ? '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold" title="Đã hoàn thành">✓</span>'
                : '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-xs">▶</span>'
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
      ? 'px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-100 text-emerald-700 transition'
      : 'px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 transition';
  }

  const transcriptEl = document.getElementById('transcript-list');
  if (!transcriptEl) return;

  // Lấy các bản ghi âm đã lưu trong IndexedDB
  const savedRecordings = await window.storageDB.getAllRecordings();
  const recMap = {};
  savedRecordings.forEach((r) => {
    recMap[r.id] = r;
  });

  transcriptEl.innerHTML = lesson.transcript
    .map((item, idx) => {
      const hasRec = !!recMap[item.id];
      const savedScore = recMap[item.id]?.score;
      const isRecordingThis = AppState.recordingSentenceId === item.id;
      const isPlayingThis = AppState.activeSentenceId === item.id;

      return `
        <div id="sentence-card-${item.id}" class="p-4 rounded-2xl border transition-all ${
        isPlayingThis
          ? 'bg-indigo-50/70 border-indigo-400 shadow-sm'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="space-y-1 flex-1">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">${
                  idx + 1
                }</span>
                <p class="font-semibold text-slate-800 text-base leading-snug cursor-pointer hover:text-indigo-600 transition"
                   onclick="playSentenceAudio('${item.id}')">${item.en}</p>
              </div>
              <p class="text-xs font-mono text-indigo-500 pl-8">${item.ipa || ''}</p>
              <p class="text-sm text-slate-600 pl-8">${item.vi}</p>
            </div>

            <!-- Bộ nút điều khiển Nghe mẫu & Thu âm Shadowing -->
            <div class="flex flex-wrap items-center gap-2 pl-8 sm:pl-0 shrink-0">
              <button onclick="playSentenceAudio('${item.id}')"
                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                title="Nghe giọng AI mẫu">
                <span>🔊</span> Nghe mẫu
              </button>

              <button onclick="toggleRecordSentence('${item.id}')"
                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  isRecordingThis
                    ? 'bg-rose-600 text-white recording-pulse'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }">
                <span>${isRecordingThis ? '⏹ Dừng thu' : '🎙️ Thu âm'}</span>
              </button>

              ${
                hasRec
                  ? `
                <button onclick="playSavedRecording('${item.id}')"
                  class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                  title="Nghe lại giọng của bạn">
                  <span>▶️ Giọng bạn</span>
                  ${
                    savedScore !== null && savedScore !== undefined
                      ? `<span class="px-1.5 py-0.5 rounded bg-emerald-200/80 text-emerald-900 text-[11px] font-bold">${savedScore}%</span>`
                      : ''
                  }
                </button>
              `
                  : ''
              }
            </div>
          </div>
          <div id="rec-feedback-${item.id}" class="hidden mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-600 pl-8"></div>
        </div>
      `;
    })
    .join('');
}

/**
 * Phát âm thanh 1 câu bằng Web Speech API (hoặc file MP3)
 */
window.playSentenceAudio = function (sentenceId) {
  const lesson = (AppState.dataset.lessons || []).find((l) => l.id === AppState.selectedLessonId);
  if (!lesson) return;
  const item = lesson.transcript.find((s) => s.id === sentenceId);
  if (!item) return;

  stopAllAudio();
  AppState.activeSentenceId = sentenceId;
  renderCurrentLessonDetail();

  speakText(item.en, () => {
    AppState.activeSentenceId = null;
    renderCurrentLessonDetail();
  });
};

/**
 * Phát toàn bộ bài học tuần tự từng câu (hoặc file MP3 nếu có)
 */
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

  // Thử phát file MP3 nếu người dùng đã tạo bằng edge-tts, nếu không có thì đọc từng câu bằng Web Speech API
  const audio = new Audio(lesson.audioUrl);
  AppState.currentAudioObj = audio;

  audio.onended = () => {
    AppState.isPlayingLesson = false;
    updatePlayAllButtonUI(false);
  };

  audio.onerror = () => {
    // Fallback tự động sang Web Speech API đọc từng câu và highlight
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
      'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 text-white shadow-sm hover:bg-rose-700 transition';
  } else {
    btn.innerHTML = '<span>🔊</span> Phát toàn bộ bài nghe';
    btn.className =
      'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition';
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

/**
 * Hàm đọc văn bản qua Web Speech API
 */
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

  // Chọn giọng đọc tự nhiên nhất có trên thiết bị
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice =
    voices.find((v) => v.lang === accent && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Microsoft'))) ||
    voices.find((v) => v.lang.startsWith(accent.split('-')[0]));

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

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
    addXP(20, 'Hoàn thành bài nghe Shadowing');
    checkAndUpdateDailyStreak(true);
    saveState();
    renderListeningModule();
  } else {
    showToast('Bài học này đã được đánh dấu hoàn thành trước đó!', 'info');
  }
};

/**
 * Thu âm giọng nói người học (MediaStream Recording API + IndexedDB + Chấm điểm phát âm)
 */
window.toggleRecordSentence = async function (sentenceId) {
  stopAllAudio();

  // Nếu đang thu âm chính câu này -> Dừng thu âm
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

    // Khởi tạo nhận diện giọng nói song song (nếu trình duyệt hỗ trợ) để chấm % phát âm
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

      // Tính điểm phát âm nếu nhận diện được giọng nói
      const lesson = (AppState.dataset.lessons || []).find((l) => l.id === AppState.selectedLessonId);
      const sentenceObj = lesson?.transcript?.find((s) => s.id === sentenceId);
      let pronScore = null;
      if (AppState.recognizedTranscript && sentenceObj) {
        pronScore = calculateSimilarityPercent(AppState.recognizedTranscript, sentenceObj.en);
      }

      await window.storageDB.saveRecording(sentenceId, AppState.selectedLessonId, audioBlob, pronScore);
      AppState.recordingSentenceId = null;
      addXP(5, 'Luyện thu âm Shadowing');
      checkAndUpdateDailyStreak(true);
      await renderCurrentLessonDetail();

      if (pronScore !== null) {
        const fbEl = document.getElementById(`rec-feedback-${sentenceId}`);
        if (fbEl) {
          fbEl.classList.remove('hidden');
          fbEl.innerHTML = `🎯 Hệ thống nghe được: <strong class="text-indigo-700">"${AppState.recognizedTranscript}"</strong> — Độ khớp phát âm: <span class="font-bold text-emerald-600">${pronScore}%</span>`;
        }
      }
      showToast('Đã lưu bản thu âm vào trình duyệt! Hãy bấm "Giọng bạn" để nghe lại.', 'success');
    };

    mediaRecorder.start();
    renderCurrentLessonDetail();
  } catch (err) {
    console.error('Lỗi quyền truy cập Micro:', err);
    showToast('Vui lòng cấp quyền sử dụng Micro trên trình duyệt để thu âm Shadowing.', 'error');
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
   4. MODULE 2: LUYỆN PHẢN XẠ 5 CÂU & SPACED REPETITION
   ========================================== */
window.startNewReflexBatch = function (filterMode = null) {
  if (filterMode !== null) {
    AppState.reflexFilterLesson = filterMode;
  }
  const allQuestions = AppState.dataset.questions || [];
  if (allQuestions.length === 0) return;

  const history = AppState.userState.questionHistory || {};
  const todayStr = getTodayDateString();

  let pool = [];
  if (AppState.reflexFilterLesson !== 'all' && AppState.reflexFilterLesson !== 'spaced') {
    pool = allQuestions.filter((q) => q.lessonId === AppState.reflexFilterLesson);
  } else {
    // Thuật toán Spaced Repetition: Trộn câu cũ cần ôn tập (hoặc từng làm sai) + câu mới chưa học
    const dueOrOld = [];
    const unseen = [];

    allQuestions.forEach((q) => {
      const h = history[q.id];
      if (!h) {
        unseen.push(q);
      } else {
        const accuracy = h.attempts > 0 ? h.correct / h.attempts : 0;
        const isDue = !h.nextReview || h.nextReview <= todayStr || accuracy < 0.8;
        if (isDue || AppState.reflexFilterLesson === 'spaced') {
          dueOrOld.push(q);
        } else {
          dueOrOld.push(q);
        }
      }
    });

    // Lấy tối đa 2-3 câu cũ + 2-3 câu mới cho mỗi cụm 5 câu
    const shuffledOld = shuffleArray(dueOrOld);
    const shuffledNew = shuffleArray(unseen);

    const pickedOld = shuffledOld.slice(0, 3);
    const neededNew = 5 - pickedOld.length;
    const pickedNew = shuffledNew.slice(0, neededNew);

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
    container.innerHTML = `<p class="text-center text-slate-500 py-8">Chưa có câu hỏi nào trong danh mục này.</p>`;
    return;
  }

  // Nếu đã hoàn thành cả 5 câu trong cụm
  if (AppState.reflexIndex >= batch.length) {
    renderReflexSummary(container);
    return;
  }

  const q = batch[AppState.reflexIndex];
  const h = (AppState.userState.questionHistory || {})[q.id];
  const isReviewQuestion = !!h;
  const progressPercent = Math.round((AppState.reflexIndex / batch.length) * 100);

  document.getElementById('reflex-progress-text').textContent = `Câu ${AppState.reflexIndex + 1} / ${batch.length}`;
  document.getElementById('reflex-progress-bar').style.width = `${progressPercent}%`;

  container.innerHTML = `
    <div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${
          isReviewQuestion ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
        }">
          ${isReviewQuestion ? '🔄 Câu ôn tập (Spaced Repetition)' : '✨ Câu mới'}
        </span>
        <button onclick="toggleReflexHint()" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
          💡 Xem gợi ý từ vựng
        </button>
      </div>

      <!-- Câu tiếng Việt cần dịch phản xạ -->
      <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
        <p class="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1">Dịch sang tiếng Anh:</p>
        <h3 class="text-lg sm:text-xl font-bold text-slate-800 leading-relaxed">${q.vi}</h3>
        <p id="reflex-hint-box" class="hidden mt-3 text-xs sm:text-sm text-indigo-700 bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100">
          <strong>Gợi ý cấu trúc:</strong> ${q.hint}
        </p>
      </div>

      <!-- Ô nhập đáp án hoặc đọc bằng giọng nói -->
      <div class="space-y-2">
        <div class="relative">
          <textarea id="reflex-user-input" rows="2"
            placeholder="Nhập câu tiếng Anh của bạn tại đây (hoặc bấm nút Micro để nói)..."
            class="w-full p-4 pr-12 rounded-2xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-800 font-medium resize-none"
            onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); checkReflexAnswer(); }"></textarea>
          <button onclick="dictateReflexAnswer()" title="Nói bằng giọng của bạn"
            class="absolute right-3 bottom-3 w-9 h-9 rounded-xl bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-600 flex items-center justify-center transition">
            🎙️
          </button>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p class="text-xs text-slate-400">Mẹo: Nhấn <kbd class="px-1.5 py-0.5 bg-slate-100 border rounded text-slate-600">Enter</kbd> để chấm điểm nhanh.</p>
          <div class="flex items-center gap-2">
            ${
              AppState.userState?.settings?.apiKey
                ? `<button onclick="checkReflexAnswerWithAI()" id="btn-ai-grade"
                    class="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition">
                    🤖 Chấm sâu bằng AI
                   </button>`
                : ''
            }
            <button onclick="checkReflexAnswer()" id="btn-check-reflex"
              class="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition">
              Kiểm tra đáp án
            </button>
          </div>
        </div>
      </div>

      <!-- Khu vực hiển thị kết quả chấm điểm & Levenshtein Diff -->
      <div id="reflex-feedback-area" class="hidden rounded-2xl p-5 border space-y-3"></div>
    </div>
  `;

  const inputEl = document.getElementById('reflex-user-input');
  if (inputEl) inputEl.focus();
}

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
  showToast('🎙️ Đang nghe... Hãy đọc câu tiếng Anh của bạn!', 'info');
  recognizer.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const inputEl = document.getElementById('reflex-user-input');
    if (inputEl) inputEl.value = text;
  };
  recognizer.start();
};

/**
 * Chấm điểm câu phản xạ bằng mảng accepted_answers + Chuẩn hóa chuỗi + Levenshtein distance
 */
window.checkReflexAnswer = function () {
  if (AppState.reflexAnswered) {
    nextReflexQuestion();
    return;
  }
  const inputEl = document.getElementById('reflex-user-input');
  if (!inputEl) return;
  const userRaw = inputEl.value.trim();
  if (!userRaw) {
    showToast('Bạn hãy nhập câu trả lời trước khi kiểm tra nhé!', 'error');
    return;
  }

  const q = AppState.reflexBatch[AppState.reflexIndex];
  const evaluation = evaluateTranslation(userRaw, q.accepted_answers);

  AppState.reflexAnswered = true;
  recordQuestionAttempt(q.id, evaluation.isPass);

  if (evaluation.isPass) {
    AppState.reflexScore++;
    addXP(10, 'Trả lời đúng câu phản xạ');
    checkAndUpdateDailyStreak(true);
  }

  const fbArea = document.getElementById('reflex-feedback-area');
  if (!fbArea) return;

  fbArea.classList.remove('hidden');
  if (evaluation.status === 'perfect') {
    fbArea.className = 'rounded-2xl p-5 border bg-emerald-50/90 border-emerald-300 space-y-3';
  } else if (evaluation.status === 'typo') {
    fbArea.className = 'rounded-2xl p-5 border bg-amber-50/90 border-amber-300 space-y-3';
  } else {
    fbArea.className = 'rounded-2xl p-5 border bg-rose-50/90 border-rose-300 space-y-3';
  }

  fbArea.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div>
        <h4 class="font-bold text-base ${
          evaluation.status === 'perfect'
            ? 'text-emerald-800'
            : evaluation.status === 'typo'
            ? 'text-amber-800'
            : 'text-rose-800'
        }">
          ${
            evaluation.status === 'perfect'
              ? '🎉 Chính xác tuyệt đối! (100%)'
              : evaluation.status === 'typo'
              ? `🤏 Gần chính xác! (${evaluation.similarity}% - Có lỗi chính tả nhẹ)`
              : `❌ Chưa chính xác (${evaluation.similarity}%)`
          }
        </h4>
        <p class="text-xs text-slate-600 mt-1">So khớp từ vựng: ${evaluation.diffHtml}</p>
      </div>
      <button onclick="speakText('${q.accepted_answers[0].replace(/'/g, "\\'")}')"
        class="shrink-0 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">
        🔊 Nghe câu chuẩn
      </button>
    </div>

    <div class="text-sm space-y-1 bg-white/80 p-3.5 rounded-xl border border-slate-200/70">
      <p class="font-semibold text-slate-800">✅ Đáp án chuẩn: <span class="text-indigo-700">${q.accepted_answers[0]}</span></p>
      ${
        q.accepted_answers.length > 1
          ? `<p class="text-xs text-slate-500">Các cách diễn đạt khác được chấp nhận: ${q.accepted_answers
              .slice(1)
              .join(' / ')}</p>`
          : ''
      }
      <p class="text-xs text-slate-700 pt-1 border-t border-slate-100 mt-1">📘 <strong>Giải thích ngữ pháp:</strong> ${
        q.grammar
      }</p>
    </div>

    <div id="ai-extra-feedback" class="hidden text-xs bg-purple-50 text-purple-900 p-3 rounded-xl border border-purple-200"></div>

    <div class="flex justify-end pt-1">
      <button onclick="nextReflexQuestion()"
        class="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition">
        ${AppState.reflexIndex + 1 < AppState.reflexBatch.length ? 'Câu tiếp theo →' : 'Xem tổng kết cụm 5 câu →'}
      </button>
    </div>
  `;

  const checkBtn = document.getElementById('btn-check-reflex');
  if (checkBtn) {
    checkBtn.textContent =
      AppState.reflexIndex + 1 < AppState.reflexBatch.length ? 'Câu tiếp theo →' : 'Hoàn thành cụm →';
  }
};

/**
 * Chấm điểm tự do bằng Gemini API nếu người dùng nhập API Key cá nhân trong Cài đặt
 */
window.checkReflexAnswerWithAI = async function () {
  const apiKey = AppState.userState?.settings?.apiKey?.trim();
  if (!apiKey) {
    showToast('Vui lòng nhập Gemini API Key trong mục Cài đặt trước!', 'error');
    return;
  }

  // Chấm cơ bản trước nếu chưa bấm
  if (!AppState.reflexAnswered) {
    window.checkReflexAnswer();
  }

  const userRaw = document.getElementById('reflex-user-input')?.value?.trim();
  const q = AppState.reflexBatch[AppState.reflexIndex];
  const aiBox = document.getElementById('ai-extra-feedback');
  if (!aiBox || !userRaw) return;

  aiBox.classList.remove('hidden');
  aiBox.innerHTML = '⏳ AI đang phân tích ngữ pháp và cách diễn đạt của bạn...';

  try {
    const prompt = `Bạn là giáo viên tiếng Anh. Học viên đang dịch câu tiếng Việt: "${q.vi}" sang tiếng Anh.
Câu học viên viết: "${userRaw}".
Đáp án mẫu: "${q.accepted_answers[0]}".
Hãy nhận xét ngắn gọn trong 2-3 câu bằng tiếng Việt: câu của học viên có tự nhiên và đúng ngữ pháp không, nếu sai thì sửa thế nào.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
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
    aiBox.innerHTML = `⚠️ Lỗi gọi AI API: ${err.message}. Hãy kiểm tra lại API Key trong Cài đặt.`;
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
      <div class="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-3xl mx-auto">
        🏆
      </div>
      <h3 class="text-xl font-bold text-slate-800">Hoàn thành cụm 5 câu phản xạ!</h3>
      <p class="text-slate-600 text-sm max-w-md mx-auto">
        Bạn đã trả lời đúng <strong class="text-emerald-600">${AppState.reflexScore}/${AppState.reflexBatch.length}</strong> câu (${percent}%).
        Hệ thống Spaced Repetition đã lưu lịch sử để nhắc bạn ôn lại các câu khó vào ngày mai.
      </p>
      <div class="pt-2 flex flex-wrap justify-center gap-3">
        <button onclick="startNewReflexBatch()"
          class="px-6 py-3 rounded-2xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition">
          🔄 Luyện tiếp cụm 5 câu mới
        </button>
      </div>
    </div>
  `;
}

/**
 * Chuẩn hóa chuỗi & Thuật toán Levenshtein Distance
 */
function normalizeEnglishString(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[.,?!;:"'’]/g, function (match) {
      return match === "'" || match === '’' ? "'" : '';
    })
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

  // Nếu đạt từ 84% trở lên -> Chấp nhận nhưng báo lỗi chính tả nhẹ (Typo)
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
        return `<span class="text-emerald-700 font-semibold">${uw}</span>`;
      } else if (cleanTw && levenshteinDistance(cleanUw, cleanTw) <= 2) {
        return `<span class="underline decoration-wavy decoration-amber-500 text-amber-800 font-semibold" title="Gợi ý: ${targetWords[idx]}">${uw}</span>`;
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
    prev.interval = 1; // Ôn lại ngay vào ngày mai
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
      ? 'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 text-white shadow-sm transition'
      : 'px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100 transition';

  document.getElementById('btn-submode-typing').className =
    mode === 'typing'
      ? 'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 text-white shadow-sm transition'
      : 'px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100 transition';

  renderVocabModule();
};

function renderVocabModule() {
  const list = AppState.vocabList;
  const container = document.getElementById('vocab-stage-container');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `<p class="text-center text-slate-500 py-8">Chưa có từ vựng nào.</p>`;
    return;
  }

  const item = list[AppState.vocabIndex];
  const vStat = (AppState.userState.vocabProgress || {})[item.id] || { status: 'learning', typedCount: 0 };
  const isMastered = vStat.status === 'mastered';

  document.getElementById('vocab-counter-text').textContent = `Từ ${AppState.vocabIndex + 1} / ${list.length}`;

  if (AppState.vocabSubMode === 'flashcard') {
    container.innerHTML = `
      <div class="max-w-lg mx-auto space-y-5">
        <!-- Thẻ 3D Flashcard -->
        <div class="perspective-1000 h-72 sm:h-80 w-full cursor-pointer select-none" onclick="flipCurrentFlashcard()">
          <div id="flashcard-3d-inner" class="flip-card-inner ${AppState.isCardFlipped ? 'is-flipped' : ''}">
            <!-- Mặt trước (Tiếng Anh + IPA) -->
            <div class="flip-card-front bg-white border-2 border-slate-200 shadow-md p-6 flex flex-col justify-between">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">${item.type}</span>
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${
                  isMastered ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }">${isMastered ? '✓ Đã thuộc' : 'Đang học'}</span>
              </div>
              <div class="text-center space-y-2 my-auto">
                <h3 class="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight">${item.word}</h3>
                <p class="text-sm font-mono text-indigo-500">${item.ipa}</p>
                <button onclick="event.stopPropagation(); speakText('${item.word.replace(/'/g, "\\'")}')"
                  class="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition">
                  🔊 Phát âm
                </button>
              </div>
              <p class="text-center text-xs text-slate-400">👆 Chạm vào thẻ để lật xem nghĩa & ví dụ</p>
            </div>

            <!-- Mặt sau (Nghĩa tiếng Việt + Câu ví dụ) -->
            <div class="flip-card-back bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-md p-6 flex flex-col justify-between">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20">${item.word} (${item.type})</span>
                <button onclick="event.stopPropagation(); speakText('${item.example.replace(/'/g, "\\'")}')"
                  class="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-full">
                  🔊 Nghe câu ví dụ
                </button>
              </div>
              <div class="text-center space-y-3 my-auto">
                <p class="text-2xl font-bold text-amber-300">${item.meaning}</p>
                <div class="bg-white/10 p-3.5 rounded-xl text-left space-y-1">
                  <p class="text-sm font-medium leading-snug">"${item.example}"</p>
                  <p class="text-xs text-indigo-200">${item.exampleVi}</p>
                </div>
              </div>
              <p class="text-center text-xs text-indigo-200">👆 Chạm để lật lại mặt trước</p>
            </div>
          </div>
        </div>

        <!-- Nút điều hướng & Đánh dấu Đã thuộc -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <button onclick="prevVocabCard()"
            class="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700">
            ← Từ trước
          </button>

          <button onclick="toggleMasteredVocab('${item.id}')"
            class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
              isMastered
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            }">
            ${isMastered ? '✅ Đã thuộc từ này' : '☑️ Đánh dấu Đã thuộc (+5 XP)'}
          </button>

          <button onclick="nextVocabCard()"
            class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold">
            Từ tiếp →
          </button>
        </div>
      </div>
    `;
  } else {
    // Chế độ Typing Practice (Luyện gõ từng ký tự)
    container.innerHTML = `
      <div class="max-w-lg mx-auto bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">Loại từ: ${item.type}</span>
          <button onclick="speakText('${item.word.replace(/'/g, "\\'")}')"
            class="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
            🔊 Nghe phát âm gợi ý
          </button>
        </div>

        <div class="text-center space-y-1 py-2">
          <p class="text-xs uppercase tracking-wider text-slate-400 font-semibold">Nghĩa tiếng Việt:</p>
          <h3 class="text-2xl font-bold text-slate-800">${item.meaning}</h3>
          <p class="text-xs text-slate-500 italic">"${item.example.replace(new RegExp(item.word, 'gi'), '_____')}"</p>
        </div>

        <!-- Hiển thị các ô ký tự real-time -->
        <div id="typing-char-boxes" class="flex flex-wrap justify-center gap-1.5 py-2">
          ${renderTypingCharBoxes('', item.word)}
        </div>

        <div class="space-y-3">
          <input type="text" id="vocab-typing-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            placeholder="Gõ từ tiếng Anh tương ứng (${item.word.length} ký tự)..."
            class="w-full p-3.5 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none text-center text-lg font-bold tracking-wide text-slate-800"
            oninput="handleVocabTypingInput(this.value)" />

          <div class="flex items-center justify-between text-xs">
            <button onclick="revealNextLetter()" class="font-semibold text-amber-600 hover:text-amber-700">
              💡 Gợi ý 1 chữ cái
            </button>
            <div class="flex gap-2">
              <button onclick="prevVocabCard()" class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-semibold">← Trước</button>
              <button onclick="nextVocabCard()" class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-semibold">Tiếp →</button>
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
  if (inner) {
    inner.classList.toggle('is-flipped', AppState.isCardFlipped);
  }
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
      if (ch === ' ') {
        return `<span class="w-4"></span>`;
      }
      const uCh = typedStr[idx];
      if (uCh === undefined) {
        return `<span class="w-8 h-10 rounded-lg border-2 border-slate-200 bg-slate-50 flex items-center justify-center font-mono font-bold text-slate-400">_</span>`;
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
   6. MODULE 4: TIẾN ĐỘ, STREAK, CALENDAR & TÀI KHOẢN ĐA THIẾT BỊ
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
    // Khi mới mở trang: Kiểm tra nếu bỏ lỡ quá 1 ngày thì reset streak về 0
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

  // Các con số thống kê
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

  // Vẽ Lịch học 28 ngày gần nhất (Activity Heatmap Calendar)
  const calGrid = document.getElementById('study-calendar-grid');
  if (calGrid) {
    const today = getTodayDateString();
    const cells = [];
    for (let i = 27; i >= 0; i--) {
      const dateStr = addDaysToDateString(today, -i);
      const dayLog = s.streak?.historyDates?.[dateStr];
      const xpEarned = dayLog?.xp || 0;
      const dayNum = dateStr.split('-')[2];

      let bgClass = 'bg-slate-100 text-slate-400 border-slate-200';
      if (xpEarned >= 40) {
        bgClass = 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-sm';
      } else if (xpEarned > 0) {
        bgClass = 'bg-emerald-200 text-emerald-900 border-emerald-300 font-semibold';
      }

      cells.push(`
        <div class="p-2 rounded-xl border text-center transition ${bgClass}" title="Ngày ${dateStr}: ${xpEarned} XP">
          <div class="text-xs">${dayNum}</div>
          <div class="text-[10px] opacity-80">${xpEarned > 0 ? `+${xpEarned}` : '-'}</div>
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
      statusBadge.className = 'text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-800';
    } else {
      statusBadge.textContent = `Đã đăng nhập: @${currentUsername}`;
      statusBadge.className = 'text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800';
    }
  }

  // Đổ dữ liệu cài đặt hiện tại vào form
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
    updateAccountUI();
    renderHeaderStats();
    renderListeningModule();
    startNewReflexBatch();
    renderVocabModule();
    renderProgressModule();

    if (result.mode === 'cloud-login') {
      showToast(`☁️ Đã đăng nhập & tải tiến độ từ Cloud cho @${result.username}!`, 'success');
    } else if (result.mode === 'register') {
      showToast(`🎉 Đã tạo tài khoản @${result.username} thành công!`, 'success');
    } else {
      showToast(`👋 Chào mừng quay lại, @${result.username}!`, 'success');
    }
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
    showToast('☁️ Đang đồng bộ dữ liệu giữa thiết bị và Đám mây...', 'info');
    const res = await window.accountManager.syncNow();
    AppState.userState = res.data;
    renderHeaderStats();
    renderProgressModule();
    showToast('✅ Đồng bộ thành công! Laptop và Điện thoại đã có chung dữ liệu mới nhất.', 'success');
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

/**
 * Sao lưu tiến độ ra file JSON (Export JSON)
 */
window.exportProgressJSON = function () {
  const dataStr = JSON.stringify(AppState.userState, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const uname = window.accountManager.getCurrentUsername();
  a.href = url;
  a.download = `english-hub-backup-${uname}-${getTodayDateString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Đã tải xuống file sao lưu (.json) thành công!', 'success');
};

/**
 * Khôi phục tiến độ từ file JSON (Import JSON)
 */
window.importProgressJSON = function (event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported || typeof imported !== 'object' || !imported.streak) {
        throw new Error('File JSON không đúng định dạng của English Foundation Hub.');
      }
      const merged = window.accountManager.mergeProgress(AppState.userState, imported);
      AppState.userState = merged;
      saveState();
      updateAccountUI();
      renderListeningModule();
      startNewReflexBatch();
      renderVocabModule();
      renderProgressModule();
      showToast('🎉 Đã khôi phục và gộp tiến độ học tập thành công!', 'success');
    } catch (err) {
      showToast('Lỗi đọc file JSON: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
};

/* ==========================================
   8. THÔNG BÁO TOAST & NHẮC NHỞ HỌC TẬP (SETINTERVAL)
   ========================================== */
function startStudyReminderTimer() {
  if (AppState.reminderIntervalId) {
    clearInterval(AppState.reminderIntervalId);
  }
  const mins = parseInt(AppState.userState?.settings?.reminderMinutes || 15, 10);
  if (mins <= 0) return;

  AppState.reminderIntervalId = setInterval(() => {
    showToast(
      '⏰ Nhắc nhở học tập: Hãy hoàn thành thêm 1 cụm 5 câu phản xạ hoặc ôn 5 thẻ Flashcard để giữ vững chuỗi Streak hôm nay nhé!',
      'info'
    );
  }, mins * 60 * 1000);
}

window.showToast = function (message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  let colorClass = 'bg-slate-900 text-white border-slate-700';
  if (type === 'success') colorClass = 'bg-emerald-600 text-white border-emerald-500';
  if (type === 'error') colorClass = 'bg-rose-600 text-white border-rose-500';

  toast.className = `px-4 py-3 rounded-2xl shadow-lg border text-xs sm:text-sm font-medium flex items-center justify-between gap-3 transition-all duration-300 ${colorClass}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" class="opacity-75 hover:opacity-100 font-bold">✕</button>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 4200);
};

/* ==========================================
   9. TIỆN ÍCH (HELPERS)
   ========================================== */
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

/* ==========================================
   10. CẨM NANG NGỮ PHÁP & TỰ TẠO BÀI HỌC MỚI (AI / THỦ CÔNG)
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
        AppState.dataset.questions.push(cq);
      }
    });
  }
  if (Array.isArray(custom.vocabulary)) {
    custom.vocabulary.forEach((cv) => {
      if (!AppState.dataset.vocabulary.some((v) => v.id === cv.id)) {
        AppState.dataset.vocabulary.push(cv);
      }
    });
  }
}

function populateLessonDropdowns() {
  const lessons = AppState.dataset.lessons || [];
  const totalQ = (AppState.dataset.questions || []).length;
  const totalV = (AppState.dataset.vocabulary || []).length;

  const reflexSelect = document.getElementById('select-reflex-lesson');
  if (reflexSelect) {
    reflexSelect.innerHTML =
      `<option value="all">🔀 Trộn thông minh (${totalQ} câu cũ + mới)</option>` +
      lessons.map((l) => `<option value="${l.id}">${l.title}</option>`).join('');
  }

  const vocabSelect = document.getElementById('select-vocab-lesson');
  if (vocabSelect) {
    vocabSelect.innerHTML =
      `<option value="all">Tất cả chủ đề (${totalV} từ)</option>` +
      lessons.map((l) => `<option value="${l.id}">${l.title}</option>`).join('');
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
      ? 'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 text-white shadow-sm transition'
      : 'px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100 transition';
  }
  if (btnGram) {
    btnGram.className = !isTranslate
      ? 'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 text-white shadow-sm transition'
      : 'px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100 transition';
  }
  if (!isTranslate) {
    renderGrammarHub();
  }
};

function renderGrammarHub() {
  const wrapper = document.getElementById('reflex-grammar-wrapper');
  if (!wrapper) return;

  const topics = AppState.dataset.grammarTopics || [];
  if (topics.length === 0) {
    wrapper.innerHTML = `<p class="text-center text-slate-500 py-8">Chưa có chủ điểm ngữ pháp nào.</p>`;
    return;
  }

  wrapper.innerHTML = topics
    .map((t, tIdx) => {
      return `
        <div class="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-base sm:text-lg font-extrabold text-slate-900">${t.title}</h3>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">Cấp độ ${t.level}</span>
          </div>

          <div class="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 font-mono text-xs sm:text-sm font-bold text-indigo-900">
            📐 Công thức: ${t.formula}
          </div>

          <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">${t.summary}</p>

          <div class="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 text-xs sm:text-sm">
            <p class="font-semibold text-slate-700">💡 Ví dụ thực tế:</p>
            ${t.examples.map((ex) => `<p class="text-slate-600 pl-2">• ${ex}</p>`).join('')}
          </div>

          <!-- Bài tập trắc nghiệm nhanh -->
          <div class="pt-3 border-t border-slate-100 space-y-2.5">
            <p class="text-xs font-bold uppercase tracking-wider text-indigo-600">✍️ Bài tập áp dụng (+10 XP):</p>
            <p class="text-sm font-semibold text-slate-800">${t.quiz.question}</p>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              ${t.quiz.options
                .map(
                  (opt, oIdx) => `
                  <button onclick="checkGrammarQuizOption(${tIdx}, ${oIdx})"
                    id="gquiz-btn-${tIdx}-${oIdx}"
                    class="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 text-xs sm:text-sm font-semibold text-slate-700 transition">
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
    explainBox.className = 'p-3 rounded-xl text-xs bg-emerald-50 border border-emerald-200 text-emerald-900';
    explainBox.innerHTML = `✅ <strong>Chính xác!</strong> ${topic.quiz.explanation}`;
    addXP(10, `Hoàn thành bài tập ${topic.title}`);
    checkAndUpdateDailyStreak(true);
  } else {
    explainBox.className = 'p-3 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-900';
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
  const titleEl = document.getElementById('custom-lesson-title');
  const linesEl = document.getElementById('custom-lesson-lines');
  const title = titleEl?.value?.trim();
  const rawLines = linesEl?.value?.trim();

  if (!title || !rawLines) {
    showToast('Vui lòng nhập Tên bài học và ít nhất 1 dòng câu song ngữ!', 'error');
    return;
  }

  const lines = rawLines
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const newLessonId = `custom-${Date.now()}`;
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

    newQuestions.push({
      id: `${newLessonId}-q${idx + 1}`,
      lessonId: newLessonId,
      vi,
      accepted_answers: [en.replace(/[.,?!]+$/, '')],
      hint: en.split(' ').slice(0, 3).join(' ') + '...',
      grammar: grammarNote
    });
  });

  if (transcript.length === 0) {
    showToast('Không tìm thấy câu hợp lệ nào!', 'error');
    return;
  }

  const newLessonObj = {
    id: newLessonId,
    title,
    level: 'Tự tạo',
    duration: '1:30',
    topic: 'Custom Lesson',
    audioUrl: '',
    description: `Bài học tự tạo gồm ${transcript.length} câu giao tiếp và phản xạ ngữ pháp.`,
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
  AppState.selectedLessonId = newLessonId;
  renderListeningModule();
  startNewReflexBatch();
  toggleCustomLessonModal(false);

  if (titleEl) titleEl.value = '';
  if (linesEl) linesEl.value = '';
  showToast(`🎉 Đã thêm bài học mới "${title}" thành công!`, 'success');
};

window.generateLessonWithAI = async function () {
  const apiKey = AppState.userState?.settings?.apiKey?.trim();
  if (!apiKey) {
    showToast('Bạn hãy nhập Gemini API Key miễn phí trong Tab 4 (Cài đặt) để dùng tính năng AI tự soạn bài nhé!', 'error');
    return;
  }
  const titleEl = document.getElementById('custom-lesson-title');
  const topicPrompt = titleEl?.value?.trim();
  if (!topicPrompt) {
    showToast('Hãy nhập tên Chủ đề hoặc Ngữ pháp bạn muốn AI soạn vào ô phía trên!', 'error');
    return;
  }

  const btn = document.getElementById('btn-generate-ai-lesson');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ AI đang biên soạn bài nghe & ngữ pháp...';
  }

  try {
    const prompt = `Hãy đóng vai giáo viên tiếng Anh, tạo 5 câu giao tiếp tiếng Anh thực tế theo chủ đề/ngữ pháp: "${topicPrompt}".
Trả về kết quả CHỈ GỒM 5 DÒNG, mỗi dòng đúng định dạng:
Câu tiếng Anh | Nghĩa tiếng Việt | Giải thích ngữ pháp ngắn gọn
Không thêm bất kỳ lời dẫn hay ký hiệu markdown nào khác.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error(data?.error?.message || 'Không nhận được dữ liệu từ AI.');

    const linesEl = document.getElementById('custom-lesson-lines');
    if (linesEl) {
      linesEl.value = text.replace(/```/g, '').trim();
    }
    showToast('✨ AI đã soạn xong 5 câu! Bạn hãy bấm "Lưu vào kho bài học" nhé.', 'success');
  } catch (err) {
    showToast('Lỗi tạo bài bằng AI: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✨ Nhờ AI tự động soạn bài học theo chủ đề trên';
    }
  }
};

