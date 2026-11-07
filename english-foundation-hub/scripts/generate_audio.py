"""
Script tự động tạo file âm thanh .mp3 từ giọng đọc AI tự nhiên của Microsoft (edge-tts)
Dựa trên dữ liệu bài học trong file data/lessons.json.

Cách chạy:
1. Cài đặt thư viện:
   pip install edge-tts
2. Chạy script từ thư mục gốc của dự án:
   python scripts/generate_audio.py
"""

import asyncio
import json
from pathlib import Path
import edge_tts

VOICE = "en-US-AriaNeural"  # Có thể đổi thành "en-US-GuyNeural" hoặc "en-GB-SoniaNeural"
RATE = "-5%"                # Đọc chậm hơn một chút cho người học nền tảng dễ nghe


async def generate_lesson_audio():
    root_dir = Path(__file__).resolve().parent.parent
    lessons_file = root_dir / "data" / "lessons.json"
    output_dir = root_dir / "assets" / "audio"
    output_dir.mkdir(parents=True, exist_ok=True)

    with open(lessons_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    lessons = data.get("lessons", [])
    print(f"Bắt đầu tạo file MP3 cho {len(lessons)} bài học bằng giọng {VOICE}...")

    for lesson in lessons:
        lesson_id = lesson["id"]
        transcript = lesson.get("transcript", [])
        full_text = " ... ".join(item["en"] for item in transcript)
        out_path = output_dir / f"{lesson_id}.mp3"

        print(f" -> Đang tạo: {out_path.name} ...")
        communicate = edge_tts.Communicate(full_text, VOICE, rate=RATE)
        await communicate.save(str(out_path))

    print("✅ Hoàn tất! Các file MP3 đã được lưu tại thư mục assets/audio/.")


if __name__ == "__main__":
    asyncio.run(generate_lesson_audio())
