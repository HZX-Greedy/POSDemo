// =====================================================================
// app.js — VERSI STATIC (tanpa backend Express, tanpa MySQL)
// Semua fetch(`${API_URL}/...`) pada versi asli diganti panggilan
// langsung ke DB.xxx() dari db.js, yang baca/tulis ke localStorage.
// =====================================================================

let loggedInUser = null;
let productsCache = [];
let currentCart = [];
let usersCache = [];
let consumerRowsCache = [];
let currentConsumerDate = null;

function resolveImage(gambar) {
    if (!gambar) return 'https://via.placeholder.com/160x130?text=No+Image';
    return gambar; // di versi static, gambar selalu URL atau base64 (data:)
}

function canManageTx() {
    return loggedInUser && (loggedInUser.role === 'admin' || loggedInUser.role === 'owner');
}

// ===== SESI LOGIN (localStorage) =====

function saveSession(user) {
    localStorage.setItem('avepos_session', JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem('avepos_session');
}

function restoreSession() {
    const saved = localStorage.getItem('avepos_session');
    if (!saved) return false;
    try {
        loggedInUser = JSON.parse(saved);
        return true;
    } catch (err) {
        clearSession();
        return false;
    }
}

function applyLoggedInUI() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('user-name').innerText = loggedInUser.nama;
    document.getElementById('role-indicator').innerText = `Role: ${loggedInUser.role.toUpperCase()}`;
    document.getElementById('user-role-label').innerText = loggedInUser.role.toUpperCase();

    document.getElementById('owner-menu').hidden = (loggedInUser.role !== 'owner');
    document.getElementById('manage-menu').hidden = !(loggedInUser.role === 'owner' || loggedInUser.role === 'admin');

    initDashboard();
    loadPOSProducts();
}

window.addEventListener('DOMContentLoaded', () => {
    if (restoreSession()) {
        applyLoggedInUI();
    }
});

async function performLogin() {
    const usernameInput = document.getElementById('login-username').value;
    const passwordInput = document.getElementById('login-password').value;
    try {
        const result = await DB.login(usernameInput, passwordInput);
        if (!result.ok) return alert(result.message);

        loggedInUser = result.data;
        saveSession(loggedInUser);
        applyLoggedInUI();
    } catch (err) {
        alert('Gagal memuat data demo.');
    }
}

function performLogout() {
    loggedInUser = null;
    currentCart = [];
    clearSession();
    document.getElementById('login-screen').style.display = 'flex';
}

function navigate(event, panelId, routeName) {
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));

    document.getElementById(`view-${panelId}`).classList.add('active');
    document.getElementById('path-indicator').innerText = routeName;

    if (event && event.currentTarget) event.currentTarget.classList.add('active');

    if (panelId === 'dashboard') initDashboard();
    if (panelId === 'konsumen') fetchConsumers();
    if (panelId === 'info-user') fetchUsers();
    if (panelId === 'role-management') fetchRoleManagement();
    if (panelId === 'profile') setupProfile();
    if (panelId === 'kelola-menu') fetchMenuManagement();
}

async function initDashboard() {
    const data = await DB.getDashboard();
    document.getElementById('dash-sales').innerText = data.penjualan;
    document.getElementById('dash-income').innerText = `Rp ${Number(data.pemasukan).toLocaleString('id-ID')}`;
    document.getElementById('dash-employees').innerText = data.karyawan;
}

async function loadPOSProducts() {
    productsCache = await DB.getProducts();
    const container = document.getElementById('pos-products-list');
    container.innerHTML = '';
    productsCache.forEach(p => {
        container.innerHTML += `
            <div class="prod-card" onclick="addToCart(${p.id})">
                <img src="${resolveImage(p.gambar)}">
                <div class="prod-card-body">
                    <h4>${p.nama_menu}</h4>
                    <b>Rp ${Number(p.harga).toLocaleString('id-ID')}</b>
                </div>
            </div>
        `;
    });
}

function addToCart(id) {
    const product = productsCache.find(p => p.id === id);
    const exist = currentCart.find(item => item.id === id);
    if (exist) {
        exist.qty++;
    } else {
        currentCart.push({
            ...product,
            qty: 1
        });
    }
    renderCart();
}

function increaseQty(id) {
    const item = currentCart.find(i => i.id === id);
    if (item) item.qty++;
    renderCart();
}

function decreaseQty(id) {
    const item = currentCart.find(i => i.id === id);
    if (!item) return;
    item.qty--;
    if (item.qty <= 0) {
        currentCart = currentCart.filter(i => i.id !== id);
    }
    renderCart();
}

function removeFromCart(id) {
    currentCart = currentCart.filter(i => i.id !== id);
    renderCart();
}

function renderCart() {
    const container = document.getElementById('pos-cart-items');
    container.innerHTML = '';
    let total = 0;
    currentCart.forEach(item => {
        total += item.harga * item.qty;
        container.innerHTML += `
            <div class="cart-item">
                <div>
                    <b>${item.nama_menu}</b>
                    <div class="qty-control">
                        <button class="qty-btn" onclick="decreaseQty(${item.id})">-</button>
                        <span>${item.qty}</span>
                        <button class="qty-btn" onclick="increaseQty(${item.id})">+</button>
                        <span class="cart-item-remove" onclick="removeFromCart(${item.id})"><i class="fa-solid fa-trash"></i></span>
                    </div>
                </div>
                <b style="align-self:center;">Rp ${(item.harga * item.qty).toLocaleString('id-ID')}</b>
            </div>
        `;
    });
    document.getElementById('pos-total-price').innerText = `Rp ${total.toLocaleString('id-ID')}`;
}

function toggleCashField() {
    const type = document.getElementById('pos-pay-type').value;
    document.getElementById('cash-input-group').style.display = (type === 'qris') ? 'none' : 'block';
}

let pendingTxPayload = null;
async function checkoutOrder() {
    if (currentCart.length === 0) return alert('Pilih item produk terlebih dahulu!');
    const payType = document.getElementById('pos-pay-type').value;
    const total = currentCart.reduce((sum, i) => sum + (i.harga * i.qty), 0);
    const customerName = document.getElementById('pos-customer-name').value.trim() || 'Umum';

    pendingTxPayload = {
        user_id: loggedInUser.id,
        total_harga: total,
        jenis_pembayaran: payType,
        nama_konsumen: customerName,
        items: currentCart
    };

    if (payType === 'tunai') {
        const cash = Number(document.getElementById('pos-cash-tendered').value);
        if (!cash || cash < total) return alert('Uang tunai pembayaran tidak mencukupi nilai tagihan!');
        executeTransaction(cash - total);
    } else {
        document.getElementById('qris-amount-label').innerText = `Rp ${total.toLocaleString('id-ID')}`;
        document.getElementById('qris-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=AVEPOS_${total}`;
        document.getElementById('qris-modal').style.display = 'flex';
    }
}

function confirmQrisPaid() {
    closeModal('qris-modal');
    executeTransaction(0);
}

async function executeTransaction(change) {
    const result = await DB.addTransaction(pendingTxPayload);
    if (result.success) {
        alert('Data transaksi disimpan.');
        openReceiptWindow(result.invoice, pendingTxPayload.total_harga, pendingTxPayload.jenis_pembayaran, change);
        currentCart = [];
        document.getElementById('pos-cash-tendered').value = '';
        document.getElementById('pos-customer-name').value = '';
        renderCart();
    }
}

function openReceiptWindow(inv, total, type, change) {
    const w = window.open('', '_blank', 'width=300,height=420');
    const itemLines = pendingTxPayload.items
        .map(i => `${i.nama_menu}\n  ${i.qty}x Rp ${i.harga} = Rp ${i.qty * i.harga}`)
        .join('\n');
    w.document.write(`<pre style="font-family:monospace; font-size:12px; padding:10px;">
============================
         AVEPOS COFFEE      
============================
Invoice : ${inv}
Konsumen: ${pendingTxPayload.nama_konsumen}
Metode  : ${type.toUpperCase()}
----------------------------
${itemLines}
----------------------------
TOTAL  : Rp ${total.toLocaleString('id-ID')}
BAYAR  : Rp ${(Number(total) + Number(change)).toLocaleString('id-ID')}
KEMBALI: Rp ${change.toLocaleString('id-ID')}
============================
</pre>`);
    w.document.close();
    w.print();
    w.close();
}

async function fetchConsumers() {
    const data = await DB.getConsumers();
    const container = document.getElementById('consumer-cards-container');
    container.innerHTML = '';
    document.getElementById('detail-consumer-box').style.display = 'none';
    data.forEach(c => {
        const dateParsed = new Date(c.tanggal).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        container.innerHTML += `
            <div class="card card-metric" style="position:relative; border-left:4px solid #0f766e;">
                <h4 style="color:var(--text-main); font-size:14px;">${dateParsed}</h4>
                <p style="font-size:12px; margin-top:6px; opacity:0.8; font-weight:normal; color:#115e59;">Omset: Rp ${Number(c.total_pendapatan).toLocaleString('id-ID')}</p>
                <p style="font-size:12px; opacity:0.8; font-weight:normal; color:#115e59;">Total: ${c.total_konsumen} Pelanggan</p>
                <button class="btn btn-primary" style="padding:4px 10px; font-size:11px; margin-top:12px;" onclick="showConsumerDetails('${c.tanggal}')">Detail Data</button>
            </div>
        `;
    });
}

async function showConsumerDetails(dateStr) {
    currentConsumerDate = dateStr;
    document.getElementById('detail-consumer-box').style.display = 'block';
    document.getElementById('detail-date-title').innerText = `Data Transaksi Tanggal: ${dateStr}`;

    const allowManage = canManageTx();
    document.getElementById('detail-action-header').style.display = allowManage ? 'table-cell' : 'none';

    consumerRowsCache = await DB.getConsumersByDate(dateStr);
    renderConsumerRows(allowManage);

    document.getElementById('detail-consumer-box').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

function renderConsumerRows(allowManage) {
    const tbody = document.getElementById('detail-consumer-rows');
    tbody.innerHTML = '';
    consumerRowsCache.forEach(r => {
        const actionCell = allowManage ? `
            <td>
                <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="openEditTxModal(${r.id})">Edit</button>
                <button class="btn btn-danger" style="padding:4px 8px; font-size:12px;" onclick="deleteTx(${r.id})">Hapus</button>
            </td>
        ` : '';
        tbody.innerHTML += `
            <tr>
                <td><b>${r.invoice}</b></td>
                <td>${r.nama_konsumen || 'Umum'}</td>
                <td>${r.nama_kasir || 'Sistem'}</td>
                <td><span class="badge badge-success">${r.jenis_pembayaran}</span></td>
                <td><b>Rp ${Number(r.total_harga).toLocaleString('id-ID')}</b></td>
                ${actionCell}
            </tr>
        `;
    });
}

function openEditTxModal(id) {
    const tx = consumerRowsCache.find(r => r.id === id);
    if (!tx) return;
    document.getElementById('tx-crud-id').value = tx.id;
    document.getElementById('tx-customer-name').value = tx.nama_konsumen || '';
    document.getElementById('tx-total').value = tx.total_harga;
    document.getElementById('tx-jenis').value = tx.jenis_pembayaran;
    document.getElementById('crud-tx-modal').style.display = 'flex';
}

async function submitTxData() {
    const id = document.getElementById('tx-crud-id').value;
    const payload = {
        nama_konsumen: document.getElementById('tx-customer-name').value.trim() || 'Umum',
        total_harga: Number(document.getElementById('tx-total').value),
        jenis_pembayaran: document.getElementById('tx-jenis').value
    };
    try {
        const result = await DB.updateTransaction(id, payload);
        if (!result.success) return alert('Gagal memperbarui transaksi.');
        closeModal('crud-tx-modal');
        if (currentConsumerDate) showConsumerDetails(currentConsumerDate);
    } catch (err) {
        alert('Gagal memperbarui data.');
    }
}

async function deleteTx(id) {
    if (!confirm('Konfirmasi hapus transaksi ini secara permanen?')) return;
    try {
        const result = await DB.deleteTransaction(id);
        if (!result.success) return alert('Gagal menghapus transaksi.');
        if (currentConsumerDate) await showConsumerDetails(currentConsumerDate);
        refreshConsumerCardsOnly();
    } catch (err) {
        alert('Gagal menghapus data.');
    }
}

async function refreshConsumerCardsOnly() {
    const data = await DB.getConsumers();
    const container = document.getElementById('consumer-cards-container');
    container.innerHTML = '';
    data.forEach(c => {
        const dateParsed = new Date(c.tanggal).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        container.innerHTML += `
            <div class="card card-metric" style="position:relative; border-left:4px solid #0f766e;">
                <h4 style="color:var(--text-main); font-size:14px;">${dateParsed}</h4>
                <p style="font-size:12px; margin-top:6px; opacity:0.8; font-weight:normal; color:#115e59;">Omset: Rp ${Number(c.total_pendapatan).toLocaleString('id-ID')}</p>
                <p style="font-size:12px; opacity:0.8; font-weight:normal; color:#115e59;">Total: ${c.total_konsumen} Pelanggan</p>
                <button class="btn btn-primary" style="padding:4px 10px; font-size:11px; margin-top:12px;" onclick="showConsumerDetails('${c.tanggal}')">Detail Data</button>
            </div>
        `;
    });
}

function setupProfile() {
    document.getElementById('prof-nama').value = loggedInUser.nama;
    document.getElementById('prof-username').value = loggedInUser.username;
    document.getElementById('prof-password').value = loggedInUser.password;
    document.getElementById('prof-alamat').value = loggedInUser.alamat || '';
}

async function updateProfileData() {
    const body = {
        username: document.getElementById('prof-username').value,
        password: document.getElementById('prof-password').value,
        nama: document.getElementById('prof-nama').value,
        alamat: document.getElementById('prof-alamat').value,
        role: loggedInUser.role,
        status: loggedInUser.status
    };
    const result = await DB.updateUser(loggedInUser.id, body);
    if (result.success) {
        alert('Data diperbarui, silahkan autentikasi ulang.');
        performLogout();
    }
}

async function fetchUsers() {
    usersCache = await DB.getUsers();
    const tbody = document.getElementById('info-user-table-body');
    tbody.innerHTML = '';
    usersCache.forEach(u => {
        const statusBadge = u.status === 'aktif' ? 'badge-success' : 'badge-danger';
        tbody.innerHTML += `
            <tr>
                <td><b>${u.nama}</b></td>
                <td>${u.username}</td>
                <td><span class="badge" style="background:#e2e8f0; color:#334155">${u.role}</span></td>
                <td><span class="badge ${statusBadge}">${u.status}</span></td>
                <td>
                    <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="openEditUserModal(${u.id})">Edit</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:12px;" onclick="deleteUser(${u.id})">Hapus</button>
                </td>
            </tr>
        `;
    });
}

async function fetchRoleManagement() {
    const data = await DB.getUsers();
    const tbody = document.getElementById('role-management-table-body');
    tbody.innerHTML = '';
    data.forEach(u => {
        tbody.innerHTML += `
            <tr>
                <td><b>${u.nama}</b></td>
                <td><span class="badge badge-success" style="background:#e2e8f0; color:#334155">${u.role.toUpperCase()}</span></td>
                <td>
                    <select class="input-ctrl" style="width:140px; margin:0; padding:5px;" onchange="changeUserRole(${u.id}, this.value)">
                        <option value="kasir" ${u.role === 'kasir' ? 'selected' : ''}>Kasir</option>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="owner" ${u.role === 'owner' ? 'selected' : ''}>Owner</option>
                    </select>
                </td>
            </tr>
        `;
    });
}

async function changeUserRole(userId, newRole) {
    const targetUser = usersCache.find(u => u.id === userId) || {
        id: userId,
        nama: 'Karyawan',
        username: 'user',
        password: '123',
        status: 'aktif'
    };
    targetUser.role = newRole;
    await DB.updateUser(userId, targetUser);
    alert('Tingkat otoritas jabatan berhasil diperbarui.');
    if (userId === loggedInUser.id) performLogout();
}

function openAddUserModal() {
    document.getElementById('crud-id').value = '';
    document.getElementById('crud-title').innerText = 'Tambah Pengguna Baru';
    document.getElementById('crud-nama').value = '';
    document.getElementById('crud-username').value = '';
    document.getElementById('crud-password').value = '';
    document.getElementById('crud-alamat').value = '';
    document.getElementById('role-box-container').style.display = 'block';
    document.getElementById('status-box-container').style.display = 'none';
    document.getElementById('crud-user-modal').style.display = 'flex';
}

function openEditUserModal(id) {
    const u = usersCache.find(x => x.id === id);
    document.getElementById('crud-id').value = u.id;
    document.getElementById('crud-title').innerText = 'Modifikasi Data Staff';
    document.getElementById('crud-nama').value = u.nama;
    document.getElementById('crud-username').value = u.username;
    document.getElementById('crud-password').value = u.password;
    document.getElementById('crud-alamat').value = u.alamat || '';
    document.getElementById('role-box-container').style.display = 'none';
    document.getElementById('status-box-container').style.display = 'block';
    document.getElementById('crud-status').value = u.status;
    document.getElementById('crud-user-modal').style.display = 'flex';
}

async function submitUserData() {
    const id = document.getElementById('crud-id').value;
    const payload = {
        nama: document.getElementById('crud-nama').value,
        username: document.getElementById('crud-username').value,
        password: document.getElementById('crud-password').value,
        alamat: document.getElementById('crud-alamat').value,
        role: document.getElementById('crud-role').value,
        status: 'aktif'
    };

    if (id) {
        const origin = usersCache.find(x => x.id == id);
        payload.role = origin.role;
        payload.status = document.getElementById('crud-status').value;
        await DB.updateUser(id, payload);
    } else {
        await DB.addUser(payload);
    }
    closeModal('crud-user-modal');
    fetchUsers();
}

async function deleteUser(id) {
    if (confirm('Konfirmasi hapus staff pengguna secara permanen?')) {
        await DB.deleteUser(id);
        fetchUsers();
    }
}

// ===== KELOLA MENU (PRODUK) =====

async function fetchMenuManagement() {
    productsCache = await DB.getProducts();
    const container = document.getElementById('manage-products-list');
    container.innerHTML = '';
    productsCache.forEach(p => {
        container.innerHTML += `
            <div class="prod-card manage-card">
                <img src="${resolveImage(p.gambar)}">
                <div class="prod-card-body">
                    <h4>${p.nama_menu}</h4>
                    <b>Rp ${Number(p.harga).toLocaleString('id-ID')}</b>
                    <div class="manage-actions">
                        <button class="btn btn-secondary" onclick="openEditProductModal(${p.id})">Edit</button>
                        <button class="btn btn-danger" onclick="deleteProduct(${p.id})">Hapus</button>
                    </div>
                </div>
            </div>
        `;
    });
}

let pendingProductImageBase64 = null;

function previewProductImage(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('product-foto-preview');
    if (!file) {
        preview.style.display = 'none';
        pendingProductImageBase64 = null;
        return;
    }
    const reader = new FileReader();
    reader.onload = e => {
        preview.src = e.target.result;
        preview.style.display = 'block';
        // Di versi static, foto disimpan langsung sebagai base64 (data URL)
        // di localStorage, karena tidak ada server untuk menyimpan file.
        pendingProductImageBase64 = e.target.result;
    };
    reader.readAsDataURL(file);
}

function openAddProductModal() {
    document.getElementById('product-crud-id').value = '';
    document.getElementById('product-crud-title').innerText = 'Tambah Menu';
    document.getElementById('product-nama').value = '';
    document.getElementById('product-harga').value = '';
    document.getElementById('product-foto').value = '';
    document.getElementById('product-foto-preview').style.display = 'none';
    pendingProductImageBase64 = null;
    document.getElementById('crud-product-modal').style.display = 'flex';
}

function openEditProductModal(id) {
    const p = productsCache.find(x => x.id === id);
    document.getElementById('product-crud-id').value = p.id;
    document.getElementById('product-crud-title').innerText = 'Edit Menu';
    document.getElementById('product-nama').value = p.nama_menu;
    document.getElementById('product-harga').value = p.harga;
    document.getElementById('product-foto').value = '';
    const preview = document.getElementById('product-foto-preview');
    preview.src = resolveImage(p.gambar);
    preview.style.display = 'block';
    pendingProductImageBase64 = null;
    document.getElementById('crud-product-modal').style.display = 'flex';
}

async function submitProductData() {
    const id = document.getElementById('product-crud-id').value;
    const nama = document.getElementById('product-nama').value;
    const harga = document.getElementById('product-harga').value;

    if (!nama || !harga) return alert('Nama menu dan harga wajib diisi!');

    const payload = {
        nama_menu: nama,
        harga,
        gambar: pendingProductImageBase64 // null kalau tidak ganti foto
    };

    if (id) {
        await DB.updateProduct(id, payload);
    } else {
        await DB.addProduct(payload);
    }
    closeModal('crud-product-modal');
    fetchMenuManagement();
}

async function deleteProduct(id) {
    if (confirm('Konfirmasi hapus menu ini secara permanen?')) {
        await DB.deleteProduct(id);
        fetchMenuManagement();
    }
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function resetDemoData() {
    if (!confirm('Ini akan menghapus semua data transaksi/perubahan dan mengembalikan ke data awal demo. Lanjutkan?')) return;
    DB.resetToSeed();
    alert('Data demo berhasil direset. Silahkan login ulang.');
    performLogout();
}
