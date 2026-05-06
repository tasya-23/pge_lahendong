"""
extensions.py — Koneksi database dan helper auth.
"""
import mysql.connector
from mysql.connector import Error


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
