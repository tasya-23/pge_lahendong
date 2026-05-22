"""
helpers.py — Konstanta, helper load data, filter, dan perhitungan absensi.
Diimpor oleh semua route blueprint.
"""
import pandas as pd
import os
from extensions import get_db

UPLOAD_FOLDER = "uploads"

# ==============================
# ⚙️ KONFIGURASI JAM KERJA
# ==============================
JAM_MASUK_STANDAR  = 8   # Jam masuk standar (08:00)
MENIT_TOLERANSI    = 1   # Terlambat jika lewat 08:01
JAM_MIN_KERJA      = 1   # Minimal jam kerja yang masuk akal
JAM_MAX_KERJA      = 16  # Maksimal jam kerja yang masuk akal

# ==============================
# 🔗 KONEKSI DATABASE
# ==============================
def get_db():
    try:
        conn = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="dashboard_db"
        )
        return conn
    except Error as e:
        print(f"❌ DB Error: {e}")
        raise

# ==============================
# 🔐 AUTH
# ==============================
def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("logged_in"):
            return jsonify({"success": False, "error": "unauthorized"}), 401
        return f(*args, **kwargs)
    return wrapper

# ==============================
# 🔧 HELPER LOAD ABSENSI
# ==============================
def load_absensi():
    path = os.path.join(UPLOAD_FOLDER, "absensi_latest.csv")
    if not os.path.exists(path):
        return None
    df = pd.read_csv(path, low_memory=False)
    df["Time"] = pd.to_datetime(df["Time"], errors="coerce")
    df = df.dropna(subset=["Time"])
    df["Tanggal"] = df["Time"].dt.date.astype(str)
    df["Person ID"] = df["Person ID"].astype(str).str.replace("^'", "", regex=True).str.strip()
    return df


# ==============================
# 🔧 HELPER LOAD MASTER
# ==============================
def load_master():
    """Ambil data karyawan dari tabel users sebagai master."""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True, buffered=True)
        cursor.execute("SELECT username AS `Person ID`, nama AS Nama, divisi AS Divisi FROM users")
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        if rows:
            return pd.DataFrame(rows)
    except Exception as e:
        print(f"Warning load_master: {e}")
    return None

# ==============================
# 🔧 HELPER FILTER DF
# ==============================
def filter_df(df, args):
    divisi = args.get("divisi")
    tgl1   = args.get("tgl1")
    tgl2   = args.get("tgl2")
    bulan  = args.get("bulan")
    tahun  = args.get("tahun")

    # 🔹 Filter berdasarkan divisi
    if divisi and divisi != "" and "Divisi" in df.columns:
        df = df[df["Divisi"] == divisi]

    # 🔹 Filter tanggal range
    if tgl1:
        df = df[df["Tanggal"] >= tgl1]
    if tgl2:
        df = df[df["Tanggal"] <= tgl2]

    # 🔹 Filter bulan
    if bulan and bulan != "0":
        df = df[df["Time"].dt.month == int(bulan)]

    # 🔹 Filter tahun
    if tahun and tahun != "0":
        df = df[df["Time"].dt.year == int(tahun)]

    return df

# ==============================
# 🔧 HELPER HITUNG STATUS (AKURAT)
# ==============================
def hitung_status(df):
    """
    HADIR   = jumlah unik (Person ID + Tanggal) yang ada Check-in
    TERLAMBAT = Check-in pertama yang jamnya > 08:01
    """
    if df.empty:
        return 0, 0

    checkin_mask = df["Attendance Status"].astype(str).str.lower().str.contains(
        "check-in|check in", na=False
    )
    df_checkin = df[checkin_mask]

    if df_checkin.empty:
        return 0, 0

    # HADIR: unik per orang per hari
    hadir = df_checkin.groupby(["Person ID", "Tanggal"]).ngroups

    # TERLAMBAT: ambil check-in PERTAMA per orang per hari
    # lalu cek apakah jamnya > 08:01
    first_in = df_checkin.groupby(["Person ID", "Tanggal"])["Time"].min().reset_index()
    batas_menit = JAM_MASUK_STANDAR * 60 + MENIT_TOLERANSI  # 481 menit = 08:01
    first_in["menit_masuk"] = first_in["Time"].dt.hour * 60 + first_in["Time"].dt.minute
    terlambat = int((first_in["menit_masuk"] > batas_menit).sum())

    return int(hadir), terlambat

# ==============================
# 🔧 HELPER HITUNG TIDAK HADIR (AKURAT)
# ==============================
def hitung_tidak_hadir(df):
    """
    Tidak Hadir = hari yang ada di data (Senin-Jumat) tapi
    karyawan tidak punya record Check-in sama sekali di hari itu.
    Menggunakan hari kerja yang muncul di data (bukan kalender penuh)
    agar akurat untuk karyawan shift.
    """
    if df.empty:
        return 0

    checkin_mask = df["Attendance Status"].astype(str).str.lower().str.contains(
        "check-in|check in", na=False
    )

    # Set tanggal yang karyawan hadir
    hadir_set = set(
        zip(
            df[checkin_mask]["Person ID"].astype(str),
            df[checkin_mask]["Tanggal"].astype(str)
        )
    )

    # Hari kerja = tanggal unik yang ada di data & Senin-Jumat
    semua_tanggal = pd.to_datetime(df["Tanggal"].unique())
    hari_kerja    = [str(t.date()) for t in semua_tanggal if t.weekday() < 5]

    semua_karyawan = df["Person ID"].astype(str).unique()

    total_tidak_hadir = 0
    for pid in semua_karyawan:
        for tgl in hari_kerja:
            if (pid, tgl) not in hadir_set:
                total_tidak_hadir += 1

    return int(total_tidak_hadir)

# ==============================
# 🔧 HELPER HITUNG JAM KERJA (AKURAT)
# ==============================
def hitung_jam_kerja(df):
    """
    Jam kerja = selisih Check-in pertama dan Check-out terakhir
    per orang per hari. Hanya dihitung jika ada keduanya dan
    selisihnya masuk akal (1-16 jam).
    """
    if df.empty:
        return 0.0

    try:
        checkin_mask  = df["Attendance Status"].astype(str).str.lower().str.contains(
            "check-in|check in", na=False
        )
        checkout_mask = df["Attendance Status"].astype(str).str.lower().str.contains(
            "check-out|check out", na=False
        )

        checkin_grp  = df[checkin_mask].groupby(["Person ID", "Tanggal"])["Time"].min()
        checkout_grp = df[checkout_mask].groupby(["Person ID", "Tanggal"])["Time"].max()

        merged = checkin_grp.to_frame("masuk").join(
            checkout_grp.to_frame("keluar"), how="inner"
        )
        merged["jam"] = (merged["keluar"] - merged["masuk"]).dt.total_seconds() / 3600

        # Filter yang masuk akal
        merged = merged[(merged["jam"] >= JAM_MIN_KERJA) & (merged["jam"] <= JAM_MAX_KERJA)]
        total_jam = merged["jam"].sum()
    except Exception as e:
        print(f"Error hitung jam kerja: {e}")
        total_jam = 0.0

    return round(float(total_jam), 1)

def hitung_total_hari_kerja_unik(df_full):
    """Menghitung jumlah tanggal unik (Senin-Jumat) dari data penuh."""
    if df_full is None or df_full.empty:
        return 0
    
    # Ambil kolom tanggal, ubah ke datetime, filter weekday
    dates = pd.to_datetime(df_full["Tanggal"].unique())
    workdays = [t for t in dates if t.weekday() < 5]
    return len(workdays)