// =====================================================================
// db.js — "DATABASE" PENGGANTI MYSQL UNTUK VERSI STATIC (PORTOFOLIO)
// =====================================================================
// File ini menggantikan peran server.js + MySQL. Semua data disimpan
// di localStorage browser, dan fungsi-fungsi di sini meniru query SQL
// yang dulu ada di server.js (SELECT, INSERT, UPDATE, DELETE).
//
// CATATAN: karena ini cuma demo/portofolio, data tersimpan per-browser
// (localStorage), bukan database server sungguhan. Kalau dibuka di
// device/browser lain, datanya akan kembali ke data awal (seed).
// =====================================================================

const DB_KEYS = {
    users: 'avepos_db_users',
    products: 'avepos_db_products',
    transactions: 'avepos_db_transactions',
    transactionDetails: 'avepos_db_transaction_details',
    seeded: 'avepos_db_seeded'
};

// ---------- SEED DATA AWAL ----------
const SEED_USERS = [
    { id: 1, username: 'owner', password: 'owner123', nama: 'Owner', alamat: 'Jl. Merdeka No. 1', role: 'owner', status: 'aktif' },
    { id: 2, username: 'admin', password: 'admin123', nama: 'Admin', alamat: 'Jl. Sudirman No. 5', role: 'admin', status: 'aktif' },
    { id: 3, username: 'kasir', password: 'kasir123', nama: 'Kasir', alamat: 'Jl. Gatot Subroto No. 9', role: 'kasir', status: 'aktif' }
];

const SEED_PRODUCTS = [
    { id: 1, nama_menu: 'Es Kopi Susu', harga: 18000, gambar: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=300' },
    { id: 2, nama_menu: 'Americano', harga: 15000, gambar: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?w=300' },
    { id: 3, nama_menu: 'Cappuccino', harga: 20000, gambar: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=300' },
    { id: 4, nama_menu: 'Matcha Latte', harga: 22000, gambar: 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=300' },
    { id: 5, nama_menu: 'Roti Bakar Coklat', harga: 12000, gambar: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=300' },
    { id: 6, nama_menu: 'Croissant', harga: 17000, gambar: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300' }
];

function seedIfEmpty() {
    if (localStorage.getItem(DB_KEYS.seeded)) return;
    localStorage.setItem(DB_KEYS.users, JSON.stringify(SEED_USERS));
    localStorage.setItem(DB_KEYS.products, JSON.stringify(SEED_PRODUCTS));
    localStorage.setItem(DB_KEYS.transactions, JSON.stringify([]));
    localStorage.setItem(DB_KEYS.transactionDetails, JSON.stringify([]));
    localStorage.setItem(DB_KEYS.seeded, '1');
}
seedIfEmpty();

// ---------- HELPER BACA/TULIS ----------
function readTable(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch (err) {
        return [];
    }
}
function writeTable(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}
function nextId(rows) {
    return rows.length ? Math.max(...rows.map(r => r.id)) + 1 : 1;
}
function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// =====================================================================
// "QUERY" — meniru endpoint-endpoint yang dulu ada di server.js
// Semua fungsi async (pakai Promise) supaya app.js nggak perlu banyak
// berubah pemanggilannya (tetap pakai await).
// =====================================================================

const DB = {

    // ---- AUTH ----
    login(username, password) {
        return new Promise(resolve => {
            const users = readTable(DB_KEYS.users);
            const user = users.find(u => u.username === username && u.password === password);
            if (!user) return resolve({ ok: false, status: 401, message: 'Akun tidak ditemukan!' });
            if (user.status === 'nonaktif') return resolve({ ok: false, status: 403, message: 'Akun dinonaktifkan!' });
            resolve({ ok: true, data: user });
        });
    },

    // ---- DASHBOARD ----
    getDashboard() {
        return new Promise(resolve => {
            const tx = readTable(DB_KEYS.transactions);
            const today = todayStr();
            const todayTx = tx.filter(t => t.tanggal === today);
            const penjualan = todayTx.length;
            const pemasukan = todayTx.reduce((sum, t) => sum + Number(t.total_harga), 0);
            const karyawan = readTable(DB_KEYS.users).length;
            resolve({ penjualan, pemasukan, karyawan });
        });
    },

    // ---- PRODUCTS ----
    getProducts() {
        return new Promise(resolve => {
            const rows = readTable(DB_KEYS.products).sort((a, b) => b.id - a.id);
            resolve(rows);
        });
    },
    addProduct({ nama_menu, harga, gambar }) {
        return new Promise(resolve => {
            const rows = readTable(DB_KEYS.products);
            rows.push({ id: nextId(rows), nama_menu, harga: Number(harga), gambar: gambar || null });
            writeTable(DB_KEYS.products, rows);
            resolve({ success: true });
        });
    },
    updateProduct(id, { nama_menu, harga, gambar }) {
        return new Promise(resolve => {
            const rows = readTable(DB_KEYS.products);
            const idx = rows.findIndex(p => p.id === Number(id));
            if (idx === -1) return resolve({ success: false });
            rows[idx].nama_menu = nama_menu;
            rows[idx].harga = Number(harga);
            if (gambar) rows[idx].gambar = gambar;
            writeTable(DB_KEYS.products, rows);
            resolve({ success: true });
        });
    },
    deleteProduct(id) {
        return new Promise(resolve => {
            let rows = readTable(DB_KEYS.products);
            rows = rows.filter(p => p.id !== Number(id));
            writeTable(DB_KEYS.products, rows);
            resolve({ success: true });
        });
    },

    // ---- TRANSACTIONS ----
    addTransaction({ user_id, total_harga, jenis_pembayaran, nama_konsumen, items }) {
        return new Promise(resolve => {
            const tx = readTable(DB_KEYS.transactions);
            const details = readTable(DB_KEYS.transactionDetails);
            const invoice = 'INV-' + Date.now();
            const newTx = {
                id: nextId(tx),
                invoice,
                user_id,
                total_harga,
                jenis_pembayaran,
                nama_konsumen: nama_konsumen || 'Umum',
                tanggal: todayStr()
            };
            tx.push(newTx);
            items.forEach(item => {
                details.push({
                    id: nextId(details),
                    transaction_id: newTx.id,
                    product_id: item.id,
                    jumlah: item.qty,
                    subtotal: item.harga * item.qty
                });
            });
            writeTable(DB_KEYS.transactions, tx);
            writeTable(DB_KEYS.transactionDetails, details);
            resolve({ success: true, invoice });
        });
    },
    updateTransaction(id, { total_harga, jenis_pembayaran, nama_konsumen }) {
        return new Promise(resolve => {
            const tx = readTable(DB_KEYS.transactions);
            const idx = tx.findIndex(t => t.id === Number(id));
            if (idx === -1) return resolve({ success: false });
            tx[idx].total_harga = total_harga;
            tx[idx].jenis_pembayaran = jenis_pembayaran;
            tx[idx].nama_konsumen = nama_konsumen;
            writeTable(DB_KEYS.transactions, tx);
            resolve({ success: true });
        });
    },
    deleteTransaction(id) {
        return new Promise(resolve => {
            let tx = readTable(DB_KEYS.transactions);
            let details = readTable(DB_KEYS.transactionDetails);
            tx = tx.filter(t => t.id !== Number(id));
            details = details.filter(d => d.transaction_id !== Number(id));
            writeTable(DB_KEYS.transactions, tx);
            writeTable(DB_KEYS.transactionDetails, details);
            resolve({ success: true });
        });
    },

    // ---- CONSUMERS (rekap harian) ----
    getConsumers() {
        return new Promise(resolve => {
            const tx = readTable(DB_KEYS.transactions);
            const grouped = {};
            tx.forEach(t => {
                if (!grouped[t.tanggal]) grouped[t.tanggal] = { tanggal: t.tanggal, total_konsumen: 0, total_pendapatan: 0 };
                grouped[t.tanggal].total_konsumen++;
                grouped[t.tanggal].total_pendapatan += Number(t.total_harga);
            });
            const rows = Object.values(grouped).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
            resolve(rows);
        });
    },
    getConsumersByDate(date) {
        return new Promise(resolve => {
            const tx = readTable(DB_KEYS.transactions).filter(t => t.tanggal === date);
            const users = readTable(DB_KEYS.users);
            const rows = tx
                .map(t => ({
                    ...t,
                    tanggal_formatted: t.tanggal,
                    nama_kasir: (users.find(u => u.id === t.user_id) || {}).nama || 'Sistem'
                }))
                .sort((a, b) => b.id - a.id);
            resolve(rows);
        });
    },

    // ---- USERS ----
    getUsers() {
        return new Promise(resolve => resolve(readTable(DB_KEYS.users)));
    },
    addUser({ username, password, nama, alamat, role }) {
        return new Promise(resolve => {
            const rows = readTable(DB_KEYS.users);
            rows.push({ id: nextId(rows), username, password, nama, alamat, role, status: 'aktif' });
            writeTable(DB_KEYS.users, rows);
            resolve({ success: true });
        });
    },
    updateUser(id, { username, password, nama, alamat, role, status }) {
        return new Promise(resolve => {
            const rows = readTable(DB_KEYS.users);
            const idx = rows.findIndex(u => u.id === Number(id));
            if (idx === -1) return resolve({ success: false });
            rows[idx] = { ...rows[idx], username, password, nama, alamat, role, status };
            writeTable(DB_KEYS.users, rows);
            resolve({ success: true });
        });
    },
    deleteUser(id) {
        return new Promise(resolve => {
            let rows = readTable(DB_KEYS.users);
            rows = rows.filter(u => u.id !== Number(id));
            writeTable(DB_KEYS.users, rows);
            resolve({ success: true });
        });
    },

    // ---- UTIL: reset data ke seed awal (dipanggil dari tombol "Reset Data Demo") ----
    resetToSeed() {
        localStorage.removeItem(DB_KEYS.seeded);
        seedIfEmpty();
    }
};