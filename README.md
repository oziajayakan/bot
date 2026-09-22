# 🔗 SafeBot — Auto Safelink Opener

Bot otomatis untuk bypass & membuka link safelink **1x sehari** secara otomatis menggunakan Vercel Cron Jobs.

## ✨ Fitur

- ✅ **Tambah link berapapun** — tidak ada batasan jumlah link
- ✅ **Auto bypass 1x/hari** — via Vercel Cron Jobs (00:00 UTC)
- ✅ **Trigger manual** — tombol "Jalankan" per link atau semua sekaligus
- ✅ **Dashboard premium** — dark glassmorphism UI yang modern
- ✅ **Log riwayat** — catat setiap hasil bypass (berhasil/gagal)
- ✅ **Toggle aktif/nonaktif** — kontrol per link
- ✅ **Persistent storage** — data tersimpan di Upstash Redis

## 🚀 Deploy ke Vercel

### 1. Setup Upstash Redis

1. Buka [https://console.upstash.com](https://console.upstash.com)
2. Buat database baru (pilih region terdekat, mis. `ap-southeast-1`)
3. Copy nilai:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 2. Deploy ke Vercel

```bash
# Install Vercel CLI (jika belum)
npm i -g vercel

# Deploy
vercel --prod
```

Atau: Import repo GitHub ke [vercel.com/new](https://vercel.com/new)

### 3. Set Environment Variables di Vercel

Di **Vercel Dashboard → Settings → Environment Variables**, tambahkan:

| Key | Value |
|-----|-------|
| `UPSTASH_REDIS_REST_URL` | URL dari Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Token dari Upstash |
| `CRON_SECRET` | Random string (optional, untuk keamanan) |

### 4. Verifikasi Cron Job

Di Vercel Dashboard → **Cron Jobs**, pastikan ada cron:
- Path: `/api/cron`
- Schedule: `0 0 * * *` (setiap hari pukul 00:00 UTC = 07:00 WIB)

## 🛠 Development Lokal

```bash
# Clone repo
git clone ...
cd tools-roken

# Install dependencies
npm install

# Copy env
cp .env.example .env.local
# Edit .env.local dengan nilai Upstash Anda

# Jalankan dev server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

## 📁 Struktur Proyek

```
app/
├── page.tsx              # Dashboard utama
├── layout.tsx            # Root layout
├── globals.css           # Global styles (dark glassmorphism)
└── api/
    ├── links/route.ts    # GET/POST links
    ├── links/[id]/route.ts  # DELETE/PATCH link
    ├── run/route.ts      # Manual trigger bypass
    ├── cron/route.ts     # Vercel Cron endpoint
    └── logs/route.ts     # GET logs
lib/
├── kv.ts                 # Upstash Redis client
└── bypass.ts             # Safelink bypass engine (7 strategi)
vercel.json               # Cron job config
```

## 🔧 Safelink Bypass Engine

Mendukung berbagai format safelink:
1. `window.location` redirect
2. `<meta http-equiv="refresh">` redirect
3. Base64 encoded URL dalam halaman
4. `data-url` attribute
5. URL parameter (`?url=`, `?link=`, `?go=`)
6. Button link dengan class `btn`/`get-link`/`download`
7. `location.assign()` / `location.replace()`

## ⏰ Jadwal Cron

Default: `0 0 * * *` = pukul **00:00 UTC** = **07:00 WIB**

Ubah jadwal di `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Contoh jadwal lain:
- `0 7 * * *` → 07:00 UTC (14:00 WIB)
- `0 12 * * *` → 12:00 UTC (19:00 WIB)
- `30 6 * * *` → 06:30 UTC (13:30 WIB)
