import pandas as pd
from flask import Blueprint, jsonify, request, session
from mysql.connector import Error
from extensions import get_db
from helpers import hitung_status, hitung_tidak_hadir, load_absensi
from middleware import login_required
import os

UPLOAD_FOLDER = "uploads"

upload_bp = Blueprint("upload", __name__)


# ==============================
# 📤 UPLOAD MASTER
# ==============================
@upload_bp.route("/upload-master", methods=["POST"])
@login_required
def upload_master():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "File tidak ditemukan"})

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"success": False, "error": "File kosong"})

    try:
        if file.filename.lower().endswith(".csv"):
            df = pd.read_csv(file, low_memory=False)
        else:
            df = pd.read_excel(file)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

    df.columns = df.columns.astype(str).str.strip()

    # 🔥 Mapping kolom → pakai DIVISI
    col_map = {}
    for col in df.columns:
        c = col.lower()
        if "nama" in c:
            col_map[col] = "Nama"
        elif "user" in c:
            col_map[col] = "Username"
        elif "pass" in c:
            col_map[col] = "Password"
        elif "role" in c:
            col_map[col] = "Role"
        elif "divisi" in c or "depart" in c:
            col_map[col] = "Divisi"

    df = df.rename(columns=col_map)

    # 🔥 Validasi kolom
    required = ["Nama", "Username", "Password", "Role", "Divisi"]
    for col in required:
        if col not in df.columns:
            return jsonify({
                "success": False,
                "error": f"Kolom '{col}' tidak ditemukan",
                "kolom_terdeteksi": df.columns.tolist()
            })

    if df.empty:
        return jsonify({"success": False, "error": "File kosong / tidak ada data"})

    roles_count = df["Role"].value_counts().to_dict()

    try:
        conn = get_db()
        cursor = conn.cursor()

        # ❌ HAPUS INI (biar tidak reset data)
        # cursor.execute("DELETE FROM users")

        for _, row in df.iterrows():
            cursor.execute("""
                INSERT INTO users (nama, username, password, role, divisi)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    nama=VALUES(nama),
                    password=VALUES(password),
                    role=VALUES(role),
                    divisi=VALUES(divisi)
            """, (
                str(row["Nama"]),
                str(row["Username"]),
                str(row["Password"]),
                str(row["Role"]),
                str(row["Divisi"])
            ))

        conn.commit()
        cursor.close()
        conn.close()

    except Error as e:
        return jsonify({"success": False, "error": f"Database error: {str(e)}"}), 500

    return jsonify({
        "success": True,
        "filename": file.filename,
        "total": len(df),
        "roles": roles_count
    })
# ==============================
# 📥 UPLOAD ABSENSI
# ==============================
@upload_bp.route("/upload-absensi", methods=["POST"])
@login_required
def upload_absensi():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "File tidak ditemukan"})

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"success": False, "error": "File kosong"})

    try:
        if file.filename.lower().endswith(".csv"):
            df = pd.read_csv(file, low_memory=False)
        else:
            df = pd.read_excel(file)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

    if len(df) > 30000:
        df = df.head(30000)

    # ==============================
    # 🔍 DETEKSI KOLOM
    # ==============================
    original_cols = df.columns.astype(str).str.strip().tolist()
    lower_cols    = [c.lower() for c in original_cols]
    df.columns    = original_cols

    def find_col(keywords):
        for i, col in enumerate(lower_cols):
            for k in keywords:
                if k in col:
                    return original_cols[i]
        return None

    col_person = find_col(["person", "id"])
    col_name   = find_col(["name", "nama"])
    col_time   = find_col(["time", "date", "jam"])
    col_status = find_col(["attendance status", "status", "attendance"])

    print("DETECT:", col_person, col_name, col_time, col_status)

    if not all([col_person, col_name, col_time, col_status]):
        return jsonify({
            "success": False,
            "error": "Format file tidak sesuai",
            "kolom_terdeteksi": original_cols
        })

    df = df.rename(columns={
        col_person: "Person ID",
        col_name:   "Name",
        col_time:   "Time",
        col_status: "Attendance Status"
    })

    # ==============================
    # 🔧 CLEANING DATA
    # ==============================
    df["Person ID"] = df["Person ID"].astype(str).str.strip()
    df["Time"] = pd.to_datetime(df["Time"], errors="coerce")
    df = df.dropna(subset=["Time"])
    df["Tanggal"] = df["Time"].dt.date

    total_karyawan   = df["Person ID"].nunique()
    hari_kerja       = df["Tanggal"].nunique()
    hadir, terlambat = hitung_status(df)
    tidak_hadir      = hitung_tidak_hadir(df)

    # ==============================
    # 🔥 MAPPING KE MASTER (DIVISI)
    # ==============================
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT nama, divisi FROM users")
        master = cursor.fetchall()
        cursor.close()
        conn.close()

        if master:
            from difflib import get_close_matches

            master_df = pd.DataFrame(master)
            master_df.columns = ["Name_master", "Divisi_master"]

            master_lower = master_df["Name_master"].astype(str).str.lower().tolist()
            master_map   = dict(zip(master_lower, master_df["Divisi_master"]))

            def cari_divisi(nama):
                nama_lower = str(nama).lower().strip()

                # exact match
                if nama_lower in master_map:
                    return master_map[nama_lower]

                # fuzzy match
                saran = get_close_matches(nama_lower, master_lower, n=1, cutoff=0.6)
                if saran:
                    return master_map[saran[0]]

                return "-"

            df["Divisi"] = df["Name"].apply(cari_divisi)

        else:
            df["Divisi"] = "-"

    except Exception as e:
        print(f"Warning mapping master: {e}")
        df["Divisi"] = "-"

    # ==============================
    # 💾 SIMPAN FILE
    # ==============================
    save_path = os.path.join(UPLOAD_FOLDER, "absensi_latest.csv")
    df.to_csv(save_path, index=False)

    return jsonify({
        "success": True,
        "filename": file.filename,
        "total_karyawan": int(total_karyawan),
        "hari_kerja": int(hari_kerja),
        "periode": f"{hari_kerja} hari kerja",
        "preview": {
            "hadir": hadir,
            "terlambat": terlambat,
            "tidak_hadir": tidak_hadir
        }
    })
