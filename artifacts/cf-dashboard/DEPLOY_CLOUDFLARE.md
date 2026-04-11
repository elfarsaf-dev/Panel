# Deploy ke Cloudflare

## Kebutuhan
- Node.js
- PNPM
- Cloudflare API token
- Proxy Cloudflare yang sudah menyisipkan `ACCOUNT_ID`

## Build lokal
```bash
pnpm install
pnpm --filter @workspace/cf-dashboard build
```

## Jalankan lokal
```bash
pnpm --filter @workspace/cf-dashboard dev
```

## Deploy ke Cloudflare Pages
1. Masuk ke Cloudflare Dashboard
2. Buka **Workers & Pages**
3. Pilih **Create application**
4. Pilih **Pages**
5. Hubungkan repository GitHub
6. Atur:
   - **Build command**: `pnpm --filter @workspace/cf-dashboard build`
   - **Build output directory**: `artifacts/cf-dashboard/dist`
   - **Root directory**: kosongkan
7. Tambahkan environment variable bila perlu
8. Klik **Save and Deploy**

## Catatan penting
- App ini butuh proxy API yang aktif di `https://panelv1.elfar.my.id`
- Login pakai kredensial proxy, bukan Cloudflare dashboard langsung
- Menu Pages di dashboard ini akan pakai API Cloudflare yang sudah diarahkan lewat proxy

## Kalau project Pages kosong
- Pastikan token Cloudflare punya izin untuk **Cloudflare Pages**
- Pastikan repo GitHub sudah terhubung ke Cloudflare
- Pastikan account ID yang dipakai di proxy benar
