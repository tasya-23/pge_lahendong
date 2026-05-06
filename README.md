# Dashboard Absensi — PGE Lahendong

## Struktur Folder

```
pge_lahendong/
│
├── app.py                  ← Entry point (jalankan ini)
├── extensions.py           ← Koneksi database
├── middleware.py           ← Decorator login_required
├── helpers.py              ← Helper: load data, filter, hitung status
├── requirements.txt
│
├── routes/                 ← Semua route dipisah per fungsi
│   ├── __init__.py
│   ├── auth.py             ← /login, /logout
│   ├── pages.py            ← /, /dashboard
│   ├── upload.py           ← /upload-absensi, /upload-master
│   ├── api.py              ← /api/me, /api/rekap, /api/ranking, dst.
│   └── export.py           ← /export/excel, /export/pdf
│
├── templates/              ← Semua template HTML (Jinja2)
│   ├── layout.html         ← Base template (include CSS + JS)
│   ├── dashboard.html      ← Main dashboard (extends layout)
│   ├── login.html          ← Halaman login
│   └── partials/           ← Komponen yang di-include
│       ├── sidebar.html
│       ├── topbar.html
│       ├── modal.html
│       ├── page_upload.html
│       ├── page_nodata.html
│       ├── page_dashboard.html
│       ├── page_rekap.html
│       └── page_ranking.html
│
└── static/
    ├── css/
    │   └── main.css        ← Semua CSS
    └── js/
        ├── core.js         ← Globals, konstanta, helper UI
        ├── upload.js       ← Upload absensi & master
        ├── filter.js       ← Filter, getParams, applyFilter
        ├── dashboard.js    ← loadDashboard, loadPieChart, loadDeptChart
        ├── rekap.js        ← loadRekap, tabel karyawan
        ├── ranking.js      ← loadRanking
        ├── modal.js        ← openDetail, closeModal
        └── init.js         ← Inisialisasi saat halaman pertama dibuka
```

## Cara Menjalankan

```bash
pip install -r requirements.txt
python app.py
```

Buka browser: http://127.0.0.1:5000
