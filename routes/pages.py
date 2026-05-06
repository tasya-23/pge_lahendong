from flask import Blueprint, session, redirect
from flask import render_template
from middleware import login_required

pages_bp = Blueprint("pages", __name__)


@pages_bp.route("/")
def root():
    if session.get("logged_in"):
        return render_template("dashboard.html")
    return redirect("/login")


@pages_bp.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html")
