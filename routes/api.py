import pandas as pd
from flask import Blueprint, jsonify, request, session
from mysql.connector import Error
from extensions import get_db
from helpers import (load_absensi, load_master, filter_df,
                     hitung_status, hitung_tidak_hadir, hitung_jam_kerja,
                     JAM_MASUK_STANDAR, MENIT_TOLERANSI, JAM_MIN_KERJA, JAM_MAX_KERJA)
from middleware import login_required
import os

UPLOAD_FOLDER = "uploads"

api_bp = Blueprint("api", __name__)


# ==============================
# 👤 API ME
# ==============================
@api_bp.route("/api/me")
@login_required
def api_me():
    return jsonify({
        "nama":   session.get("nama"),
        "role":   session.get("role"),
        "divisi": session.get("divisi")
    })

# ==============================
# 📁 API FILE STATUS
# ==============================
@api_bp.route("/api/file-status")
@login_required
def api_file_status():
    path = os.path.join(UPLOAD_FOLDER, "absensi_latest.csv")
    has_absensi = os.path.exists(path)
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        total = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        has_master = total > 0
    except:
        has_master = False
    return jsonify({
        "has_file":    has_absensi,
        "has_absensi": has_absensi,
        "has_master":  has_master
    })

# ==============================
# 🔍 API FILTER OPTIONS
# ==============================
@api_bp.route("/api/filter-options")
@login_required
def api_filter_options():
    df = load_absensi()

    if df is None:
        return jsonify({
            "divisi": [],
            "tanggal": [],
            "bulan": [],
            "tahun": []
        })

    # 🔥 ambil divisi
    divisi = []
    if "Divisi" in df.columns:
        divisi = sorted(df["Divisi"].dropna().unique().tolist())

    tanggal = sorted(df["Tanggal"].dropna().unique().tolist())
    bulan   = sorted(df["Time"].dt.month.dropna().unique().astype(int).tolist())
    tahun   = sorted(df["Time"].dt.year.dropna().unique().astype(int).tolist())

    return jsonify({
        "divisi":  divisi,
        "tanggal": tanggal,
        "bulan":   bulan,
        "tahun":   tahun
    })
# ==============================
# 📊 API SUMMARY
# ==============================
@api_bp.route("/api/summary")
@login_required
def api_summary():
    df = load_absensi()
    if df is None:
        return jsonify({
            "total_hadir": 0, "total_terlambat": 0, "total_tidak_hadir": 0,
            "total_karyawan": 0, "hari_kerja": 0, "pct_hadir": 0,
            "pct_terlambat": 0, "total_jam_kerja": 0,
            "hadir": 0, "terlambat": 0, "tidak_hadir": 0
        })

    df = filter_df(df, request.args)

    role   = session.get("role", "user")
    nama   = session.get("nama", "")
    divisi = session.get("divisi", "")

    # Role user: hanya data diri sendiri
    if role == "user":
        if "Name" in df.columns and nama:
            df = df[df["Name"].astype(str).str.lower() == nama.lower()]
    # Role manager: hanya data divisinya
    elif role == "manager":
        if "Divisi" in df.columns and divisi:
            df = df[df["Divisi"] == divisi]
    # Role admin: semua data

    if df.empty:
        return jsonify({
            "total_hadir": 0, "total_terlambat": 0, "total_tidak_hadir": 0,
            "total_karyawan": 0, "hari_kerja": 0, "pct_hadir": 0,
            "pct_terlambat": 0, "total_jam_kerja": 0,
            "hadir": 0, "terlambat": 0, "tidak_hadir": 0
        })

    total_karyawan   = df["Person ID"].nunique()
    hari_kerja       = df["Tanggal"].nunique()
    hadir, terlambat = hitung_status(df)
    tidak_hadir      = hitung_tidak_hadir(df)
    total_absen      = hadir + terlambat + tidak_hadir

    pct_hadir     = round(hadir / total_absen * 100, 1) if total_absen > 0 else 0
    pct_terlambat = round(terlambat / total_absen * 100, 1) if total_absen > 0 else 0
    total_jam     = hitung_jam_kerja(df)

    return jsonify({
        "total_hadir":       hadir,
        "total_terlambat":   terlambat,
        "total_tidak_hadir": tidak_hadir,
        "total_karyawan":    int(total_karyawan),
        "hari_kerja":        int(hari_kerja),
        "pct_hadir":         pct_hadir,
        "pct_terlambat":     pct_terlambat,
        "total_jam_kerja":   total_jam,
        "hadir":             hadir,
        "terlambat":         terlambat,
        "tidak_hadir":       tidak_hadir,
    })

# ==============================
# 👤 API SUMMARY DIRI SENDIRI (role user)
# ==============================
@api_bp.route("/api/summary-me")
@login_required
def api_summary_me():
    df = load_absensi()
    if df is None:
        return jsonify({
            "total_hadir": 0, "total_terlambat": 0, "total_tidak_hadir": 0,
            "hari_kerja": 0, "pct_hadir": 0, "pct_terlambat": 0,
            "total_jam_kerja": 0
        })

    nama = session.get("nama", "")
    df   = filter_df(df, request.args)

    if nama:
        df = df[df["Name"].astype(str).str.lower() == nama.lower()]

    if df.empty:
        return jsonify({
            "total_hadir": 0, "total_terlambat": 0, "total_tidak_hadir": 0,
            "hari_kerja": 0, "pct_hadir": 0, "pct_terlambat": 0,
            "total_jam_kerja": 0
        })

    checkin_mask = df["Attendance Status"].astype(str).str.lower().str.contains(
        "check-in|check in", na=False
    )
    df_checkin = df[checkin_mask]

    hari_hadir = int(df_checkin["Tanggal"].nunique())

    terlambat = 0
    if not df_checkin.empty:
        first_in = df_checkin.groupby("Tanggal")["Time"].min()
        batas    = JAM_MASUK_STANDAR * 60 + MENIT_TOLERANSI
        terlambat = int((first_in.dt.hour * 60 + first_in.dt.minute > batas).sum())

    semua_tgl  = pd.to_datetime(df["Tanggal"].unique())
    hari_kerja = int(sum(1 for t in semua_tgl if t.weekday() < 5))
    tidak_hadir = max(hari_kerja - hari_hadir, 0)
    total_jam   = hitung_jam_kerja(df)

    pct_hadir     = round(hari_hadir / hari_kerja * 100, 1) if hari_kerja > 0 else 0
    pct_terlambat = round(terlambat / hari_hadir * 100, 1) if hari_hadir > 0 else 0

    return jsonify({
        "total_hadir":       hari_hadir,
        "total_terlambat":   terlambat,
        "total_tidak_hadir": tidak_hadir,
        "hari_kerja":        hari_kerja,
        "pct_hadir":         pct_hadir,
        "pct_terlambat":     pct_terlambat,
        "total_jam_kerja":   total_jam,
    })

# ==============================
# 🥧 API CHART PIE
# ==============================
@api_bp.route("/api/chart-pie")
@login_required
def api_chart_pie():
    df = load_absensi()

    if df is None or df.empty:
        return jsonify({"labels": ["Hadir","Terlambat","Tidak Hadir"], "values": [0,0,0], "pct": [0,0,0], "total_karyawan": 0})

    df = filter_df(df, request.args)

    role   = session.get("role", "user")
    nama   = session.get("nama", "")
    divisi = session.get("divisi", "")

    if role == "user":
        if "Name" in df.columns and nama:
            df = df[df["Name"].astype(str).str.lower() == nama.lower()]
    elif role == "manager":
        if "Divisi" in df.columns and divisi:
            df = df[df["Divisi"] == divisi]

    if df.empty:
        return jsonify({"labels": ["Hadir","Terlambat","Tidak Hadir"], "values": [0,0,0], "pct": [0,0,0], "total_karyawan": 0})

    total_karyawan   = int(df["Person ID"].nunique())
    hadir, terlambat = hitung_status(df)
    tidak_hadir      = hitung_tidak_hadir(df)
    total_absen      = hadir + terlambat + tidak_hadir

    def pct(x):
        return round(x / total_absen * 100, 1) if total_absen > 0 else 0

    return jsonify({
        "labels":          ["Hadir", "Terlambat", "Tidak Hadir"],
        "values":          [hadir, terlambat, tidak_hadir],
        "pct":             [pct(hadir), pct(terlambat), pct(tidak_hadir)],
        "total_karyawan":  total_karyawan,
    })
# ==============================
# 📊 API CHART DEPT (FIXED)
# ==============================
@api_bp.route("/api/chart-dept")
@login_required
def api_chart_dept():
    df = load_absensi()

    # 🔥 VALIDASI AWAL
    if df is None or df.empty:
        return jsonify({
            "divisi": [],
            "hadir": [],
            "terlambat": [],
            "tidak_hadir": [],
            "pct_hadir": []
        })

    # 🔥 Pastikan kolom ada
    if "Divisi" not in df.columns:
        df["Divisi"] = "Belum Diatur"

    # 🔥 Filter
    df = filter_df(df, request.args)

    role   = session.get("role", "user")
    divisi = session.get("divisi", "")

    # User hanya lihat divisinya sendiri, bukan semua divisi
    if role == "user":
        return jsonify({"divisi": [], "hadir": [], "terlambat": [], "tidak_hadir": [], "pct_hadir": []})
    elif role == "manager":
        if "Divisi" in df.columns and divisi:
            df = df[df["Divisi"] == divisi]

    if df.empty:
        return jsonify({
            "divisi": [],
            "hadir": [],
            "terlambat": [],
            "tidak_hadir": [],
            "pct_hadir": []
        })

    result = []

    for div, grp in df.groupby("Divisi"):
        hadir, terlambat = hitung_status(grp)
        tdk_hdr = hitung_tidak_hadir(grp)

        total = hadir + terlambat + tdk_hdr
        pct = round((hadir / total) * 100, 1) if total > 0 else 0

        result.append({
            "divisi": str(div) if div else "Belum Diatur",
            "hadir": int(hadir or 0),
            "terlambat": int(terlambat or 0),
            "tidak_hadir": int(tdk_hdr or 0),
            "pct_hadir": pct,
        })

    # 🔥 SORT (biar chart bagus)
    result.sort(key=lambda x: x["hadir"], reverse=True)

    return jsonify({
        "divisi": [r["divisi"] for r in result],
        "hadir": [r["hadir"] for r in result],
        "terlambat": [r["terlambat"] for r in result],
        "tidak_hadir": [r["tidak_hadir"] for r in result],
        "pct_hadir": [r["pct_hadir"] for r in result],
    })
# ==============================
# 📋 API REKAP
# ==============================
@api_bp.route("/api/rekap")
@login_required
def api_rekap():
    df = load_absensi()
    if df is None:
        return jsonify([])

    df = filter_df(df, request.args)

    role        = session.get("role", "user")
    nama        = session.get("nama", "")
    user_divisi = session.get("divisi", "")

    # User: hanya data diri sendiri
    if role == "user":
        if "Name" in df.columns and nama:
            df = df[df["Name"].astype(str).str.lower() == nama.lower()]
    # Manager: hanya data divisinya
    elif role == "manager" and user_divisi:
        if "Divisi" in df.columns:
            df = df[df["Divisi"] == user_divisi]
    # Admin: semua data

    rows = []
    for pid, grp in df.groupby("Person ID"):
        name    = grp["Name"].iloc[0] if "Name" in grp.columns else str(pid)
        div_val = grp["Divisi"].iloc[0] if "Divisi" in grp.columns else "-"

        hadir, terlambat = hitung_status(grp)
        tdk_hdr          = hitung_tidak_hadir(grp)
        jam_kerja        = hitung_jam_kerja(grp)
        avg_jam          = round(jam_kerja / hadir, 1) if hadir > 0 else 0

        rows.append({
            "id":          str(pid),
            "nama":        name,
            "divisi":      div_val,
            "hadir":       hadir,
            "terlambat":   terlambat,
            "tidak_hadir": tdk_hdr,
            "total_jam":   jam_kerja,
            "avg_jam":     avg_jam,
        })

    rows.sort(key=lambda x: x["hadir"], reverse=True)

    # Tambahkan nomor urut
    for i, r in enumerate(rows, 1):
        r["no"] = i

    return jsonify(rows)  # array langsung sesuai ekspektasi frontend
# ==============================
# 🏆 API RANKING
# ==============================
@api_bp.route("/api/ranking")
@login_required
def api_ranking():
    df_absen = load_absensi()
    df_master = load_master()  # ⬅️ ambil data master (untuk divisi)

    if df_absen is None or df_absen.empty:
        return jsonify([])

    role   = session.get("role", "user")
    divisi = session.get("divisi", "")

    # User tidak punya akses ke halaman ranking
    if role == "user":
        return jsonify([])

    # parameter top (default 10, aman dari error)
    try:
        top = int(request.args.get("top", 10))
    except ValueError:
        top = 10

    df_absen = filter_df(df_absen, request.args)

    # Manager hanya lihat ranking divisinya
    if role == "manager" and divisi:
        if "Divisi" in df_absen.columns:
            df_absen = df_absen[df_absen["Divisi"] == divisi]

    rows = []

    for pid, grp in df_absen.groupby("Person ID"):
        # ambil nama
        name = grp["Name"].iloc[0] if "Name" in grp.columns else str(pid)

        # ⬇️ ambil divisi dari MASTER, bukan dari absensi
        divisi = "-"
        if df_master is not None and not df_master.empty:
            data_master = df_master[df_master["Person ID"] == pid]
            if not data_master.empty:
                divisi = data_master["Divisi"].iloc[0]

        # hitung status
        hadir, terlambat = hitung_status(grp)
        tidak_hadir = hitung_tidak_hadir(grp)

        rows.append({
            "id": str(pid),
            "nama": name,
            "divisi": divisi,   # ⬅️ ganti dari departemen ke divisi
            "hadir": int(hadir),
            "terlambat": int(terlambat),
            "tidak_hadir": int(tidak_hadir)
        })

    rows.sort(key=lambda x: x["hadir"], reverse=True)

    result = []
    for i, row in enumerate(rows[:top], 1):
        hadir     = row["hadir"]
        terlambat = row["terlambat"]
        pct_tepat = round((hadir - terlambat) / hadir * 100, 1) if hadir > 0 else 0
        result.append({
            "rank":        i,
            "id":          row["id"],
            "nama":        row["nama"],
            "divisi":      row["divisi"],
            "hadir":       hadir,
            "terlambat":   terlambat,
            "tidak_hadir": row["tidak_hadir"],
            "pct_tepat":   max(round(pct_tepat, 1), 0),
        })

    return jsonify(result)  # array langsung sesuai ekspektasi frontend# ==============================
# 🔎 API DETAIL KARYAWAN
# ==============================
@api_bp.route("/api/detail/<pid>")
@login_required
def api_detail(pid):
    df = load_absensi()
    if df is None:
        return jsonify({"error": "Tidak ada data"})

    # Batasi akses berdasarkan role
    role = session.get("role", "user")
    nama = session.get("nama", "")

    # Filter per karyawan dulu
    df = df[df["Person ID"].astype(str) == str(pid)]
    if df.empty:
        return jsonify({"error": "Data tidak ditemukan"})

    # User hanya boleh lihat data dirinya sendiri
    if role == "user":
        if "Name" not in df.columns or df["Name"].astype(str).str.lower().iloc[0] != nama.lower():
            return jsonify({"error": "Akses ditolak"}), 403

    # Filter bulan/tahun dari request
    df = filter_df(df, request.args)
    if df.empty:
        return jsonify({"error": "Tidak ada data untuk periode ini"})

    # Info dasar
    nama    = df["Name"].iloc[0] if "Name" in df.columns else str(pid)
    divisi  = df["Divisi"].iloc[0] if "Divisi" in df.columns else "-"

    # Rekap keseluruhan
    hadir, terlambat = hitung_status(df)
    tidak_hadir      = hitung_tidak_hadir(df)
    total_jam        = hitung_jam_kerja(df)
    avg_jam          = round(total_jam / hadir, 1) if hadir > 0 else 0

    # Bangun detail harian
    HARI = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"]

    checkin_mask  = df["Attendance Status"].astype(str).str.lower().str.contains("check-in|check in", na=False)
    checkout_mask = df["Attendance Status"].astype(str).str.lower().str.contains("check-out|check out", na=False)

    df_ci = df[checkin_mask]
    df_co = df[checkout_mask]

    first_in  = df_ci.groupby("Tanggal")["Time"].min()  if not df_ci.empty else pd.Series(dtype="datetime64[ns]")
    last_out  = df_co.groupby("Tanggal")["Time"].max()  if not df_co.empty else pd.Series(dtype="datetime64[ns]")

    batas_menit = JAM_MASUK_STANDAR * 60 + MENIT_TOLERANSI

    semua_tgl = sorted(df["Tanggal"].unique())
    detail    = []
    for tgl in semua_tgl:
        tgl_dt = pd.to_datetime(tgl)
        hari   = HARI[tgl_dt.weekday()]

        if tgl in first_in.index:
            masuk_dt  = first_in[tgl]
            jam_masuk = masuk_dt.strftime("%H:%M")
            menit     = masuk_dt.hour * 60 + masuk_dt.minute
            status    = "Terlambat" if menit > batas_menit else "Hadir"
        else:
            jam_masuk = "-"
            status    = "Tidak Hadir"

        if tgl in last_out.index:
            keluar_dt  = last_out[tgl]
            jam_keluar = keluar_dt.strftime("%H:%M")
        else:
            jam_keluar = "-"

        # Jam kerja harian
        jam_kerja_hari = "-"
        if tgl in first_in.index and tgl in last_out.index:
            selisih = (last_out[tgl] - first_in[tgl]).total_seconds() / 3600
            if JAM_MIN_KERJA <= selisih <= JAM_MAX_KERJA:
                jam_kerja_hari = f"{round(selisih, 1)} jam"

        detail.append({
            "tanggal":    str(tgl),
            "hari":       hari,
            "jam_masuk":  jam_masuk,
            "jam_keluar": jam_keluar,
            "jam_kerja":  jam_kerja_hari,
            "status":     status,
        })

    return jsonify({
        "nama":      nama,
        "divisi":    divisi,
        "rekap": {
            "hadir":       hadir,
            "terlambat":   terlambat,
            "tidak_hadir": tidak_hadir,
            "total_jam":   total_jam,
            "avg_jam":     avg_jam,
        },
        "detail": detail,
    })

# ==============================
# 📈 API TREND HARIAN — khusus role user
# ==============================
@api_bp.route("/api/trend-me")
@login_required
def api_trend_me():
    import platform
    df = load_absensi()
    if df is None:
        return jsonify([])

    role   = session.get("role", "user")
    nama   = session.get("nama", "")
    divisi = session.get("divisi", "")

    df = filter_df(df, request.args)

    # Filter berdasarkan role
    if role == "user" and nama and "Name" in df.columns:
        df = df[df["Name"].astype(str).str.lower() == nama.lower()]
    elif role == "manager" and divisi and "Divisi" in df.columns:
        df = df[df["Divisi"] == divisi]

    if df.empty:
        return jsonify([])

    HARI = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"]

    checkin_mask  = df["Attendance Status"].astype(str).str.lower().str.contains(
        "check-in|check in", na=False)
    checkout_mask = df["Attendance Status"].astype(str).str.lower().str.contains(
        "check-out|check out", na=False)

    df_ci = df[checkin_mask]
    df_co = df[checkout_mask]

    first_in = (df_ci.groupby("Tanggal")["Time"].min()
                if not df_ci.empty else pd.Series(dtype="datetime64[ns]"))
    last_out = (df_co.groupby("Tanggal")["Time"].max()
                if not df_co.empty else pd.Series(dtype="datetime64[ns]"))

    batas_menit = JAM_MASUK_STANDAR * 60 + MENIT_TOLERANSI
    semua_tgl   = sorted(df["Tanggal"].unique())
    result      = []

    for tgl in semua_tgl:
        tgl_dt = pd.to_datetime(tgl)
        hari   = HARI[tgl_dt.weekday()]

        # Format tanggal aman di Windows maupun Linux
        try:
            tgl_fmt = tgl_dt.strftime("%-d %b")   # Linux
        except ValueError:
            tgl_fmt = tgl_dt.strftime("%#d %b")   # Windows
        except Exception:
            tgl_fmt = tgl_dt.strftime("%d %b").lstrip("0") or "1"

        if tgl in first_in.index:
            masuk_dt  = first_in[tgl]
            jam_masuk = masuk_dt.strftime("%H:%M")
            menit_val = masuk_dt.hour * 60 + masuk_dt.minute
            jam_float = round(masuk_dt.hour + masuk_dt.minute / 60, 4)
            status    = "Terlambat" if menit_val > batas_menit else "Hadir"
        else:
            jam_masuk = "-"
            jam_float = None
            status    = "Tidak Hadir"

        if tgl in last_out.index:
            jam_keluar = last_out[tgl].strftime("%H:%M")
        else:
            jam_keluar = "-"

        jam_kerja = None
        if tgl in first_in.index and tgl in last_out.index:
            selisih = (last_out[tgl] - first_in[tgl]).total_seconds() / 3600
            if JAM_MIN_KERJA <= selisih <= JAM_MAX_KERJA:
                jam_kerja = round(selisih, 1)

        result.append({
            "tanggal":     str(tgl),
            "tanggal_fmt": tgl_fmt,
            "hari":        hari,
            "jam_masuk":   jam_masuk,
            "jam_keluar":  jam_keluar,
            "jam_float":   jam_float,
            "jam_kerja":   jam_kerja,
            "status":      status,
        })

    return jsonify(result)
