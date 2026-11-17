# 🦈 IoT Shark Tank: Battle of Innovators

Simulasi presentasi & investasi proyek IoT siswa SMP Kelas IX — realtime, multi-device, dompet bersama per kelompok.

- `/` — Layar Siswa & Panggung (presenter otomatis masuk **Mode Panggung** untuk proyektor)
- `/admin` — Panel Kontrol Guru (password: `VITE_ADMIN_PASSWORD`, default `guru123`)

## Struktur Folder

```
iot-shark-tank/
├── supabase/
│   ├── schema.sql          ← jalankan di Supabase SQL Editor (wajib)
│   └── seed_contoh.sql     ← data uji coba 9A (opsional)
├── src/
│   ├── lib/supabase.js
│   ├── utils/soundEffects.js
│   ├── utils/format.js
│   ├── hooks/useSharkTankSync.js
│   ├── components/shared.jsx
│   ├── pages/StudentPage.jsx
│   ├── pages/AdminPage.jsx
│   ├── App.jsx, main.jsx, index.css
├── .env.example
├── vercel.json, public/_redirects   ← agar /admin tidak 404 saat di-deploy
└── package.json
```

## Cara Menjalankan

1. Buat proyek di supabase.com → **SQL Editor** → tempel `supabase/schema.sql` → **Run**.
2. (Opsional) jalankan `supabase/seed_contoh.sql`.
3. Salin `.env.example` menjadi `.env`, isi URL & anon key dari **Project Settings → API**.
4. `npm install` lalu `npm run dev` → buka `http://localhost:5173` dan `http://localhost:5173/admin`.
5. Deploy: push ke GitHub → import di Vercel/Netlify → isi 3 Environment Variables → deploy.

## Alur Satu Sesi Presenter (±16 menit)

1. Guru pilih **Kelas Aktif** → pilih **Presenter**.
2. **Mulai Pitch (10:00)** → **Mulai Q&A (05:00)** (klik `+1 Tanya` tiap kelompok yang bertanya) → **Buka Investasi (01:00)**.
3. Pantau kolom `Sudah Invest ✅ / Belum ⏳`. Jika ada kendala teknis, klik **Buka Investasi** lagi untuk membuka ulang 60 detik.
4. Ganti presenter → ulangi. Di akhir: matikan **Freeze** untuk pengumuman, lalu **Export CSV**.

## Catatan Keamanan (penting dibaca)

- `VITE_ADMIN_PASSWORD` ikut terbundel di JavaScript browser — siswa yang paham DevTools bisa menemukannya. RLS juga terbuka (permisif) sesuai spesifikasi, dan PIN bisa dibaca lewat API. Ini memadai untuk simulasi kelas, **bukan** untuk data penting. Hapus/ganti proyek Supabase setelah kegiatan selesai bila perlu.
- Pengaman di database (trigger): investasi hanya diterima saat fase `INVEST` untuk presenter aktif, waktu belum habis (toleransi 5 detik), saldo cukup, dan kelas sama.
