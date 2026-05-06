"""
middleware.py — Decorator login_required.
"""
from functools import wraps
from flask import session, jsonify


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("logged_in"):
            return jsonify({"success": False, "error": "unauthorized"}), 401
        return f(*args, **kwargs)
    return wrapper
