from flask import Blueprint, jsonify, request, send_file, session, redirect
from mysql.connector import Error
from extensions import get_db

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["GET"])
def login_page():
    return send_file("templates/login.html")


@auth_bp.route("/login", methods=["POST"])
def login_post():
    try:
        if request.is_json:
            data = request.get_json()
            username = data.get("username")
            password = data.get("password")
        else:
            username = request.form.get("username")
            password = request.form.get("password")

        if not username or not password:
            return jsonify({"success": False, "error": "Username dan password wajib diisi"}), 400

        conn = get_db()
        cursor = conn.cursor(dictionary=True, buffered=True)
        cursor.execute(
            "SELECT nama, role, divisi FROM users WHERE username=%s AND password=%s",
            (username, password)
        )
        user = cursor.fetchone()

        if user:
            session.permanent = True
            session["logged_in"] = True
            session["role"]      = user.get("role")
            session["nama"]      = user.get("nama")
            session["divisi"]    = user.get("divisi")

            cursor2 = conn.cursor(dictionary=True, buffered=True)
            cursor2.execute("SELECT COUNT(*) as total FROM users")
            total_users = cursor2.fetchone()["total"]
            cursor2.close()

            cursor.close()
            conn.close()
            return jsonify({"success": True, "has_master": total_users > 0})

        cursor.close()
        conn.close()
        return jsonify({"success": False, "error": "Username / Password salah"}), 401

    except Error as e:
        return jsonify({"success": False, "error": f"Database error: {str(e)}"}), 500


# ==============================
# 🔑 GANTI PASSWORD
# Semua role bisa ganti password sendiri.
# Wajib verifikasi password lama sebelum ganti.
# ==============================
@auth_bp.route("/change-password", methods=["POST"])
def change_password():
    if not session.get("logged_in"):
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    try:
        data         = request.get_json() if request.is_json else request.form
        password_lama = (data.get("password_lama") or "").strip()
        password_baru = (data.get("password_baru") or "").strip()
        konfirmasi    = (data.get("konfirmasi")    or "").strip()

        # Validasi input
        if not password_lama or not password_baru or not konfirmasi:
            return jsonify({"success": False, "error": "Semua field wajib diisi"}), 400

        if len(password_baru) < 6:
            return jsonify({"success": False, "error": "Password baru minimal 6 karakter"}), 400

        if password_baru != konfirmasi:
            return jsonify({"success": False, "error": "Konfirmasi password tidak cocok"}), 400

        if password_baru == password_lama:
            return jsonify({"success": False, "error": "Password baru tidak boleh sama dengan password lama"}), 400

        nama = session.get("nama")

        conn   = get_db()
        cursor = conn.cursor(dictionary=True, buffered=True)

        # Cari user berdasarkan nama + password lama
        cursor.execute(
            "SELECT id FROM users WHERE nama = %s AND password = %s",
            (nama, password_lama)
        )
        user = cursor.fetchone()

        if not user:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "error": "Password lama tidak sesuai"}), 401

        # Update password
        cursor.execute(
            "UPDATE users SET password = %s WHERE id = %s",
            (password_baru, user["id"])
        )
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": "Password berhasil diubah"})

    except Error as e:
        return jsonify({"success": False, "error": f"Database error: {str(e)}"}), 500


# ==============================
# 📝 REGISTER
# ==============================
REGISTER_CODE = "PGE2026"

@auth_bp.route("/register", methods=["GET"])
def register_page():
    return send_file("templates/register.html")


@auth_bp.route("/register", methods=["POST"])
def register_post():
    try:
        data      = request.get_json() if request.is_json else request.form
        username  = (data.get("username") or "").strip()
        password  = (data.get("password") or "").strip()
        nama      = (data.get("nama")     or "").strip()
        divisi    = (data.get("divisi")   or "").strip()
        role      = (data.get("role")     or "user").strip()
        kode      = (data.get("kode")     or "").strip()

        if not all([username, password, nama, divisi, kode]):
            return jsonify({"success": False, "error": "Semua field wajib diisi"}), 400

        if len(password) < 6:
            return jsonify({"success": False, "error": "Password minimal 6 karakter"}), 400

        if role not in ("admin", "manager", "user"):
            role = "user"

        if kode != REGISTER_CODE:
            return jsonify({"success": False, "error": "Kode akses salah"}), 403

        conn   = get_db()
        cursor = conn.cursor(dictionary=True, buffered=True)

        cursor.execute("SELECT COUNT(*) AS total FROM users")
        total = cursor.fetchone()["total"]

        if total > 0:
            if not session.get("logged_in") or session.get("role") != "admin":
                cursor.close()
                conn.close()
                return jsonify({"success": False, "error": "Hanya admin yang dapat menambah user baru"}), 403

        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({"success": False, "error": "Username sudah digunakan"}), 409

        cursor.execute(
            "INSERT INTO users (username, password, nama, divisi, role) VALUES (%s, %s, %s, %s, %s)",
            (username, password, nama, divisi, role)
        )
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": f"Akun '{username}' berhasil dibuat"})

    except Error as e:
        return jsonify({"success": False, "error": f"Database error: {str(e)}"}), 500


@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect("/login")
