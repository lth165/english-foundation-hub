/**
 * Database & Storage Manager (IndexedDB for Voice Recordings + LocalStorage & Cloud Sync for Accounts)
 */

const DB_NAME = 'EnglishFoundationHubDB';
const DB_VERSION = 1;
const STORE_RECORDINGS = 'recordings';

class StorageManager {
  constructor() {
    this.db = null;
    this.initPromise = this.initIndexedDB();
  }

  initIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('Trình duyệt không hỗ trợ IndexedDB.');
        resolve(null);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_RECORDINGS)) {
          const store = db.createObjectStore(STORE_RECORDINGS, { keyPath: 'id' });
          store.createIndex('lessonId', 'lessonId', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };
      request.onerror = (event) => {
        console.error('Lỗi khởi tạo IndexedDB:', event.target.error);
        resolve(null);
      };
    });
  }

  /**
   * Lưu file thu âm Blob vào IndexedDB
   * @param {string} id - ID câu hoặc bài học (VD: 'l1-s1')
   * @param {string} lessonId - ID bài học
   * @param {Blob} blob - Dữ liệu âm thanh
   * @param {number} score - Điểm phát âm (nếu có)
   */
  async saveRecording(id, lessonId, blob, score = null) {
    await this.initPromise;
    if (!this.db) return false;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_RECORDINGS], 'readwrite');
      const store = tx.objectStore(STORE_RECORDINGS);
      const item = {
        id,
        lessonId,
        blob,
        score,
        updatedAt: new Date().toISOString()
      };
      const req = store.put(item);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Lấy bản ghi âm theo ID
   */
  async getRecording(id) {
    await this.initPromise;
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db.transaction([STORE_RECORDINGS], 'readonly');
      const store = tx.objectStore(STORE_RECORDINGS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  /**
   * Lấy tất cả bản ghi âm
   */
  async getAllRecordings() {
    await this.initPromise;
    if (!this.db) return [];
    return new Promise((resolve) => {
      const tx = this.db.transaction([STORE_RECORDINGS], 'readonly');
      const store = tx.objectStore(STORE_RECORDINGS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  /**
   * Xóa một bản ghi âm
   */
  async deleteRecording(id) {
    await this.initPromise;
    if (!this.db) return false;
    return new Promise((resolve) => {
      const tx = this.db.transaction([STORE_RECORDINGS], 'readwrite');
      const store = tx.objectStore(STORE_RECORDINGS);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  }
}

/**
 * Quản lý Tài khoản & Đồng bộ Đám mây (Laptop <-> Điện thoại)
 * Hỗ trợ:
 * 1. Tài khoản nội bộ (Local Account) + Mã đồng bộ Cloud miễn phí (Firebase Realtime DB URL hoặc JSONBin)
 * 2. Tự động đồng bộ tiến độ khi đăng nhập cùng tên tài khoản trên Laptop và Điện thoại
 */
class AccountSyncManager {
  constructor() {
    this.ACCOUNTS_KEY = 'ef_hub_accounts_v1';
    this.CURRENT_USER_KEY = 'ef_hub_current_user_v1';
  }

  getAccounts() {
    try {
      return JSON.parse(localStorage.getItem(this.ACCOUNTS_KEY) || '{}');
    } catch {
      return {};
    }
  }

  saveAccounts(accounts) {
    localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  getCurrentUsername() {
    return localStorage.getItem(this.CURRENT_USER_KEY) || 'guest';
  }

  setCurrentUsername(username) {
    localStorage.setItem(this.CURRENT_USER_KEY, username);
  }

  /**
   * Tạo cấu trúc tiến độ mặc định cho người dùng
   */
  createDefaultProgress(username = 'Học viên', email = '') {
    return {
      profile: {
        username,
        email,
        createdAt: new Date().toISOString(),
        dailyGoal: 10
      },
      streak: {
        count: 0,
        best: 0,
        lastStudyDate: null,
        historyDates: {} // { '2026-11-07': { xp: 50, questions: 5, vocab: 4 } }
      },
      xp: 0,
      questionHistory: {}, // { 'q-1': { attempts: 2, correct: 2, lastReviewed: '2026-11-07', interval: 1, nextReview: '2026-11-08' } }
      vocabProgress: {},   // { 'v-1': { status: 'mastered' | 'learning', typedCount: 3, lastPracticed: '...' } }
      completedLessons: [],
      settings: {
        voiceAccent: 'en-US',
        speechRate: 1.0,
        aiProvider: 'gemini',
        apiKey: '',
        reminderMinutes: 15,
        cloudSyncUrl: '', // Firebase Realtime DB URL hoặc Cloud Endpoint
        cloudSyncSecret: ''
      },
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Lấy tiến độ của người dùng hiện tại
   */
  getUserState() {
    const username = this.getCurrentUsername();
    const accounts = this.getAccounts();
    if (!accounts[username]) {
      accounts[username] = {
        passwordHash: '',
        data: this.createDefaultProgress(username === 'guest' ? 'Khách (Guest)' : username)
      };
      this.saveAccounts(accounts);
    }
    return accounts[username].data;
  }

  /**
   * Lưu tiến độ của người dùng hiện tại
   */
  saveUserState(state) {
    const username = this.getCurrentUsername();
    const accounts = this.getAccounts();
    state.updatedAt = new Date().toISOString();
    if (!accounts[username]) {
      accounts[username] = { passwordHash: '', data: state };
    } else {
      accounts[username].data = state;
    }
    this.saveAccounts(accounts);
  }

  /**
   * Đăng ký hoặc Đăng nhập tài khoản
   */
  async loginOrRegister(username, pin, isRegister = false, cloudUrl = '') {
    const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (!cleanUser || cleanUser.length < 3) {
      throw new Error('Tên tài khoản cần ít nhất 3 ký tự (chữ cái hoặc số, không dấu).');
    }
    if (!pin || pin.length < 4) {
      throw new Error('Mật khẩu / Mã PIN cần ít nhất 4 ký tự.');
    }

    const accounts = this.getAccounts();
    const simpleHash = btoa(unescape(encodeURIComponent(cleanUser + ':' + pin)));

    // Nếu có cấu hình Cloud URL, thử tải từ Cloud về trước khi đăng nhập
    if (cloudUrl && cloudUrl.trim()) {
      try {
        const remoteAccount = await this.fetchFromCloud(cloudUrl.trim(), cleanUser);
        if (remoteAccount) {
          if (remoteAccount.passwordHash && remoteAccount.passwordHash !== simpleHash) {
            throw new Error('Sai mật khẩu cho tài khoản đám mây này!');
          }
          accounts[cleanUser] = remoteAccount;
          accounts[cleanUser].data.settings.cloudSyncUrl = cloudUrl.trim();
          this.saveAccounts(accounts);
          this.setCurrentUsername(cleanUser);
          return { mode: 'cloud-login', username: cleanUser, data: accounts[cleanUser].data };
        }
      } catch (err) {
        if (err.message.includes('Sai mật khẩu')) throw err;
        console.warn('Không tìm thấy dữ liệu trước đó trên Cloud, tạo mới:', err);
      }
    }

    if (isRegister) {
      if (accounts[cleanUser] && accounts[cleanUser].passwordHash) {
        throw new Error('Tài khoản này đã tồn tại trên máy. Vui lòng chọn Đăng nhập.');
      }
      // Chuyển dữ liệu từ guest sang nếu đang ở guest
      const currentGuestData = this.getCurrentUsername() === 'guest' ? this.getUserState() : null;
      const newData = currentGuestData
        ? JSON.parse(JSON.stringify(currentGuestData))
        : this.createDefaultProgress(username.trim());

      newData.profile.username = username.trim();
      if (cloudUrl && cloudUrl.trim()) {
        newData.settings.cloudSyncUrl = cloudUrl.trim();
      }

      accounts[cleanUser] = {
        passwordHash: simpleHash,
        data: newData
      };
      this.saveAccounts(accounts);
      this.setCurrentUsername(cleanUser);

      if (newData.settings.cloudSyncUrl) {
        await this.pushToCloud(newData.settings.cloudSyncUrl, cleanUser, accounts[cleanUser]);
      }
      return { mode: 'register', username: cleanUser, data: newData };
    } else {
      // Đăng nhập
      if (!accounts[cleanUser]) {
        // Nếu chưa có trên máy hiện tại (ví dụ đăng nhập trên Điện thoại lần đầu), tạo phiên mới
        const newData = this.createDefaultProgress(username.trim());
        if (cloudUrl && cloudUrl.trim()) {
          newData.settings.cloudSyncUrl = cloudUrl.trim();
        }
        accounts[cleanUser] = {
          passwordHash: simpleHash,
          data: newData
        };
        this.saveAccounts(accounts);
        this.setCurrentUsername(cleanUser);
        return { mode: 'new-device', username: cleanUser, data: newData };
      }

      if (accounts[cleanUser].passwordHash && accounts[cleanUser].passwordHash !== simpleHash) {
        throw new Error('Mật khẩu / Mã PIN không chính xác!');
      }

      this.setCurrentUsername(cleanUser);
      if (cloudUrl && cloudUrl.trim()) {
        accounts[cleanUser].data.settings.cloudSyncUrl = cloudUrl.trim();
        this.saveAccounts(accounts);
      }
      return { mode: 'login', username: cleanUser, data: accounts[cleanUser].data };
    }
  }

  /**
   * Đẩy dữ liệu tài khoản lên Cloud (Firebase Realtime DB REST API)
   */
  async pushToCloud(baseUrl, username, accountPayload) {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const endpoint = `${cleanUrl}/ef_hub_users/${encodeURIComponent(username)}.json`;
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountPayload)
    });
    if (!res.ok) {
      throw new Error(`Lỗi đồng bộ lên Cloud (HTTP ${res.status})`);
    }
    return await res.json();
  }

  /**
   * Tải dữ liệu tài khoản từ Cloud (Firebase Realtime DB REST API)
   */
  async fetchFromCloud(baseUrl, username) {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const endpoint = `${cleanUrl}/ef_hub_users/${encodeURIComponent(username)}.json`;
    const res = await fetch(endpoint);
    if (!res.ok) {
      throw new Error(`Lỗi kết nối Cloud (HTTP ${res.status})`);
    }
    return await res.json();
  }

  /**
   * Đồng bộ 2 chiều thông minh giữa thiết bị hiện tại và Cloud
   */
  async syncNow() {
    const username = this.getCurrentUsername();
    if (username === 'guest') {
      throw new Error('Vui lòng đăng nhập tài khoản trước khi đồng bộ đám mây.');
    }
    const accounts = this.getAccounts();
    const currentAccount = accounts[username];
    const cloudUrl = currentAccount?.data?.settings?.cloudSyncUrl;

    if (!cloudUrl) {
      throw new Error('Bạn chưa nhập đường dẫn Cloud Database URL trong mục Tài khoản / Cài đặt.');
    }

    const remote = await this.fetchFromCloud(cloudUrl, username);
    if (remote && remote.data) {
      const localTime = new Date(currentAccount.data.updatedAt || 0).getTime();
      const remoteTime = new Date(remote.data.updatedAt || 0).getTime();

      // Gộp dữ liệu (Merge thông minh để không mất tiến độ ở cả 2 máy)
      const merged = this.mergeProgress(currentAccount.data, remote.data);
      currentAccount.data = merged;
      this.saveAccounts(accounts);
      await this.pushToCloud(cloudUrl, username, currentAccount);
      return { status: 'merged', localTime, remoteTime, data: merged };
    } else {
      await this.pushToCloud(cloudUrl, username, currentAccount);
      return { status: 'pushed', data: currentAccount.data };
    }
  }

  /**
   * Gộp tiến độ từ 2 thiết bị (Laptop & Điện thoại) không bị mất bài đã học
   */
  mergeProgress(local, remote) {
    const merged = JSON.parse(JSON.stringify(local));
    merged.xp = Math.max(local.xp || 0, remote.xp || 0);

    // Gộp lịch sử ngày học & Streak
    merged.streak.historyDates = {
      ...(remote.streak?.historyDates || {}),
      ...(local.streak?.historyDates || {})
    };
    const totalDays = Object.keys(merged.streak.historyDates).length;
    merged.streak.count = Math.max(local.streak?.count || 0, remote.streak?.count || 0, totalDays > 0 ? 1 : 0);
    merged.streak.best = Math.max(local.streak?.best || 0, remote.streak?.best || 0, merged.streak.count);

    // Gộp lịch sử câu hỏi Spaced Repetition
    merged.questionHistory = {
      ...(remote.questionHistory || {}),
      ...(local.questionHistory || {})
    };

    // Gộp từ vựng
    merged.vocabProgress = {
      ...(remote.vocabProgress || {}),
      ...(local.vocabProgress || {})
    };

    // Gộp bài học đã hoàn thành
    const setLessons = new Set([...(local.completedLessons || []), ...(remote.completedLessons || [])]);
    merged.completedLessons = Array.from(setLessons);

    // Gộp các bài học tự tạo (Custom Dataset)
    if (local.customDataset || remote.customDataset) {
      merged.customDataset = {
        lessons: [...(remote.customDataset?.lessons || [])],
        questions: [...(remote.customDataset?.questions || [])],
        vocabulary: [...(remote.customDataset?.vocabulary || [])]
      };
      (local.customDataset?.lessons || []).forEach((l) => {
        if (!merged.customDataset.lessons.some((x) => x.id === l.id)) merged.customDataset.lessons.push(l);
      });
      (local.customDataset?.questions || []).forEach((q) => {
        if (!merged.customDataset.questions.some((x) => x.id === q.id)) merged.customDataset.questions.push(q);
      });
      (local.customDataset?.vocabulary || []).forEach((v) => {
        if (!merged.customDataset.vocabulary.some((x) => x.id === v.id)) merged.customDataset.vocabulary.push(v);
      });
    }

    // Gộp danh sách bài học YouTube Shadowing
    if (local.youtubeLessons || remote.youtubeLessons) {
      merged.youtubeLessons = [...(remote.youtubeLessons || [])];
      (local.youtubeLessons || []).forEach((yt) => {
        if (!merged.youtubeLessons.some((x) => x.id === yt.id)) merged.youtubeLessons.unshift(yt);
      });
    }

    merged.updatedAt = new Date().toISOString();
    return merged;
  }
}

window.storageDB = new StorageManager();
window.accountManager = new AccountSyncManager();
