# AvePOS — Point of Sale System

Aplikasi kasir (POS) untuk coffee shop: login multi-role (Owner/Admin/Kasir), transaksi penjualan, manajemen menu, rekap konsumen harian, dan manajemen staff.

## 🔗 Demo
**[Coba demo di sini](https://hzx-greedy.github.io/POSDemo/)**

**Akun demo:**
| Role  | Username | Password |
|-------|----------|----------|
| Owner | `owner`  | `owner123` |
| Admin | `admin`  | `admin123` |
| Kasir | `kasir`  | `kasir123` |

> Versi demo ini berjalan 100% di browser (tanpa server/database), jadi data tersimpan di `localStorage` masing-masing browser. Ada tombol **Reset Data Demo** di halaman Profile kalau data ingin dikembalikan ke kondisi awal.

## 🛠️ Tentang Versi Ini
Project ini awalnya dibangun **full-stack** dengan Node.js/Express + MySQL (lihat folder [`backend-original/`](./backend-original)). Karena GitHub Pages hanya mendukung file statis, versi yang di-deploy di sini sudah dikonversi:

- `server.js` (Express + MySQL) → diganti `db.js` yang meniru query database tapi menyimpan data di `localStorage` browser
- Upload foto produk (`multer`, disk storage) → diganti base64 (`FileReader`) karena tidak ada server untuk menyimpan file
- Struktur HTML, CSS, dan alur UI/UX **tidak diubah sama sekali** dari versi aslinya

Backend asli (Express + MySQL) tetap disertakan di folder `backend-original/` sebagai bukti implementasi full-stack yang sesungguhnya.

## ✨ Fitur
- Login & role-based access (Owner, Admin, Kasir)
- Transaksi POS: tambah ke keranjang, atur qty, pembayaran tunai/QRIS, cetak struk
- Dashboard ringkasan penjualan harian
- Rekap konsumen per tanggal + detail transaksi (edit/hapus untuk Admin & Owner)
- Manajemen menu (CRUD produk + upload foto)
- Manajemen staff & hak akses role (khusus Owner)

## 🚀 Menjalankan Versi Static (lokal)
Karena ini file statis, cukup buka `index.html` langsung di browser, atau pakai live server:

```bash
npx serve .
```

## 🗄️ Menjalankan Versi Full-Stack Asli (opsional)
Kalau ingin menjalankan versi asli dengan database MySQL sungguhan:

```bash
cd backend-original
npm install
# siapkan database MySQL "avepos" sesuai skema di server.js
node server.js
```

## 🧩 Tech Stack
- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Backend asli:** Node.js, Express, MySQL2, Multer
- **Versi demo:** localStorage sebagai pengganti database

---
Dibuat sebagai bagian dari portofolio.
