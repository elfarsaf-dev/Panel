# Panduan Deploy ke Cloudflare Pages

## 1. Penyebab Error `Unknown lockfile version: bun.lock`
Jika Anda melihat error seperti:
```
error: Unknown lockfile version at bun.lock:2:22
UnknownLockfileVersion: failed to parse lockfile: 'bun.lock'
error: lockfile had changes, but lockfile is frozen
```
**Penyebabnya:**
Cloudflare Pages mendeteksi keberadaan file `bun.lock` di root repository dan otomatis mencoba menjalankan `bun install --frozen-lockfile`. Karena format versi `bun.lock` tidak cocok dengan runtime Bun di Cloudflare Pages, build gagal.

**Solusi:**
File `bun.lock` sudah dihapus dari repository sehingga Cloudflare Pages akan menggunakan `npm` standar.

---

## 2. Pengaturan Build di Cloudflare Pages Dashboard

Masuk ke **Cloudflare Dashboard** -> **Workers & Pages** -> Pilih project Pages Anda -> **Settings** -> **Builds & deployments**:

### Konfigurasi Build:
* **Framework preset**: `None` (atau `Vite`)
* **Build command**: `npm run build`
* **Build output directory**: `artifacts/cf-dashboard/dist/public`
* **Root directory**: `/` (kosongkan)

### Environment Variables (opsional / disarankan):
Di bagian **Settings** -> **Environment variables**:
* `NODE_VERSION`: `20` (atau `22`)

---

## 3. Catatan Penting Aplikasi
* Aplikasi ini menggunakan proxy API yang aktif di `https://panelv1.elfar.my.id` (atau proxy kustom yang dikonfigurasi).
* Login menggunakan kredensial proxy Anda.
* Fitur Workers dengan Monaco Editor (VS Code style) berjalan sepenuhnya di frontend dan langsung terhubung ke API Cloudflare via proxy.
