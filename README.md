# 🇬🇧 English Foundation Hub (PWA & Multi-Device Sync)

Ứng dụng web tự học tiếng Anh nền tảng hoạt động mượt mà trên cả **Laptop** và **Điện thoại**, thiết kế tối ưu để chạy miễn phí 100% trên **GitHub Pages** (không cần thuê máy chủ Backend).

---

## ✨ Tính năng đã hoàn thiện (Trọn gói 4 Module)

1. **Module 1 — Nghe & Thu âm Shadowing (`Listening & Shadowing`):**
   - Phát giọng đọc AI trực tiếp qua `Web Speech API` (chỉnh tốc độ `0.75x`, `1.0x`, `1.2x` và giọng Anh-Mỹ / Anh-Anh) hoặc tự động phát file `.mp3` tạo từ `edge-tts`.
   - Thu âm giọng nói trực tiếp từ Micro (`MediaStream Recording API`), tự động chấm % độ giống phát âm và lưu bản thu âm dạng Blob vào `IndexedDB` của trình duyệt để nghe lại đối chiếu bất kỳ lúc nào.
2. **Module 2 — Phản xạ dịch câu & Spaced Repetition (`5-Question Batch`):**
   - Chia nhỏ từng cụm **5 câu** giúp học không bị ngợp.
   - Thuật toán **Spaced Repetition** tự động trộn các câu cũ cần ôn tập với câu mới.
   - Chấm điểm thông minh bằng mảng `accepted_answers` (chấp nhận cả từ viết tắt như *I'm / I am*), chuẩn hóa chuỗi kết hợp thuật toán **Levenshtein distance** để bắt lỗi chính tả nhẹ và gạch chân từ cần sửa.
   - Hỗ trợ **AI Chấm điểm nâng cao (Gemini API)** khi người dùng nhập API Key cá nhân trong mục Cài đặt.
3. **Module 3 — Flashcard 3D & Luyện gõ từ (`Typing Practice`):**
   - Hiệu ứng lật thẻ 3D (`rotateY(180deg)`) kèm phiên âm IPA, nghĩa tiếng Việt, câu ví dụ và âm thanh.
   - Chế độ **Typing Practice** kiểm tra từng ký tự gõ theo thời gian thực (`onInput`), có gợi ý chữ cái.
4. **Module 4 — Theo dõi tiến độ, Lịch học, Streak & Tài khoản Đa thiết bị:**
   - Tự động tính chuỗi ngày học liên tiếp (**Streak**), điểm kinh nghiệm (**XP**), và hiển thị **Lịch học 28 ngày (Calendar Heatmap)**.
   - **Tài khoản & Đồng bộ Laptop ↔ Điện thoại:** Hỗ trợ tạo tài khoản và đồng bộ 2 chiều qua **Firebase Realtime Database** miễn phí hoặc sao lưu/khôi phục qua file **Export / Import JSON**.

---

## 🚀 Cách chạy thử ngay trên máy tính

Vì trình duyệt yêu cầu giao thức `http://` hoặc `https://` để tải file `data/lessons.json` và cấp quyền Micro, bạn có thể mở nhanh bằng Python (có sẵn trên máy):

```bash
cd english-foundation-hub
python -m http.server 8080
```
Sau đó mở trình duyệt tại địa chỉ: `http://localhost:8080`

---

## ☁️ Cách tạo Cloud Database miễn phí để đồng bộ Laptop ↔ Điện thoại (2 phút)

1. Truy cập [Firebase Console](https://console.firebase.google.com/) bằng tài khoản Google của bạn -> Bấm **Create a project**.
2. Ở menu bên trái, chọn **Build** -> **Realtime Database** -> Bấm **Create Database** -> Chọn chế độ **Start in test mode**.
3. Copy đường dẫn URL của Database (ví dụ: `https://ten-du-an-default-rtdb.asia-southeast1.firebasedatabase.app`).
4. Dán đường dẫn này vào ô **Đường dẫn Cloud Database** trong tab **4. Tiến độ & Tài khoản** của web, sau đó tạo Tên tài khoản + Mật khẩu.
5. Trên Điện thoại, bạn mở link web, nhập cùng URL + Tên tài khoản + Mật khẩu là toàn bộ Streak, XP, lịch sử câu đã học sẽ tự động đồng bộ!
