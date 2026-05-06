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
            session["role"]   = user.get("role")
            session["nama"]   = user.get("nama")
            session["divisi"] = user.get("divisi")

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


@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect("/login")
