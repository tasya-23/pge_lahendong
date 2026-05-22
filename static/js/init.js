// ── INIT ───────────────────────────────────────────────────
(async () => {
  try {
    // Ambil info user
    const me = await (await fetch("/api/me")).json();
    userRole = me.role || "user";
    userDept = me.divisi || "";

    // Update sidebar
    document.getElementById("sb-nama").textContent =
      me.nama || me.username || "—";
    const roleLabel =
      { admin: "Admin", manager: "Manager", user: "Karyawan" }[userRole] ||
      userRole;
    const roleEl = document.getElementById("sb-role");
    roleEl.textContent = roleLabel + (userDept ? " · " + userDept : "");
    roleEl.className = "rb rb-" + userRole;

    // ── ATUR MENU BERDASARKAN ROLE ──────────────────────────
    if (userRole === "admin") {
      // Admin: akses penuh semua menu
      // Semua menu tampil, tidak ada yang disembunyikan
    } else if (userRole === "manager") {
      // Manager: bisa lihat dashboard, rekap, ranking — tidak bisa upload
      document.getElementById("nb-upload-section").style.display = "none";
      document.getElementById("nb-upload").style.display = "none";
    } else {
      // User/Karyawan: hanya lihat dashboard data diri sendiri
      document.getElementById("nb-upload-section").style.display = "none";
      document.getElementById("nb-upload").style.display = "none";
      document.getElementById("nb-rekap").style.display = "none";
      document.getElementById("nb-rank").style.display = "none";
    }

    // ── ATUR EXPORT BUTTON ──────────────────────────────────
    // Hanya admin & manager yang bisa export
    // Sembunyikan semua tombol export untuk role user
    if (userRole === "user") {
      ["btn-excel", "btn-excel2", "btn-pdf", "btn-pdf2"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
      });
    }
    if (userRole === "manager") {
      if (typeof showManagerDashboard === "function") {
        showManagerDashboard();
      }
    }
    // Cek apakah ada data
    const st = await (await fetch("/api/file-status")).json();

    if (st.has_file) {
      hasAbsensi = true;
      hasMaster = st.has_master;
      await loadFilterOptions();
      autoSelectLatest();
      applyFilter(); // pastikan href export sudah ter-set sejak awal

      if (userRole === "user") {
        // Karyawan: tampilkan hanya data dirinya sendiri
        applyUserFilter(me.nama);

        // 🔥 INI YANG KAMU BELUM ADA
        if (typeof showUserDashboard === "function") {
          showUserDashboard();
        }

        if (typeof loadUserTrend === "function") {
          loadUserTrend();
        }
      }

      switchPage("dash");
    } else {
      // Tidak ada data
      if (userRole === "admin") {
        switchPage("upload");
      } else {
        document
          .querySelectorAll(".page")
          .forEach((p) => p.classList.remove("active"));
        document.getElementById("page-nodata").classList.add("active");
      }
    }
  } catch (e) {
    console.error("Init error:", e);
    document
      .querySelectorAll(".page")
      .forEach((p) => p.classList.remove("active"));
    document.getElementById("page-nodata").classList.add("active");
  }
})();

// ── FILTER KHUSUS UNTUK ROLE USER ──────────────────────────
function applyUserFilter(nama) {
  // Sembunyikan filter divisi (tidak relevan untuk karyawan)
  const fgDept = document.getElementById("fg-dept");
  const fdivDept = document.getElementById("fdiv-dept");
  if (fgDept) fgDept.style.display = "none";
  if (fdivDept) fdivDept.style.display = "none";

  // Sembunyikan chart divisi (tidak relevan untuk karyawan)
  const threeCol = document.querySelector(".three-col");
  if (threeCol) threeCol.style.display = "none";

  // Ubah judul dashboard
  const h1 = document.querySelector("#page-dash h1");
  if (h1) h1.textContent = "Data Kehadiran Saya";

  // Tampilkan semua 5 card (reuse dengan label berbeda di loadSummary)
  document.querySelectorAll(".sc").forEach((c) => (c.style.display = ""));
}
