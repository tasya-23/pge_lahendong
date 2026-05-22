let hasAbsensi = false;

// ==============================
// 🔥 INIT — cek status dari server saat halaman dibuka
// Tombol dashboard aktif jika absensi ada,
// master cukup dari database (tidak harus upload ulang)
// ==============================
(async () => {
  try {
    const st = await safeFetch("/api/file-status");
    if (!st) return;

    if (st.has_absensi) {
      hasAbsensi = true;
      document.getElementById("st-ab").textContent = "✅ Terupload";
      document.getElementById("st-ab").className = "up-status ok";
      document.getElementById("box-ab").style.borderColor = "var(--g)";
      document.getElementById("lbl-ab-txt").textContent = "Ganti file absensi";
    }

    if (st.has_master) {
      hasMaster = true;
      document.getElementById("st-mk").textContent = "✅ Tersimpan di database";
      document.getElementById("st-mk").className = "up-status ok";
      document.getElementById("box-mk").style.borderColor = "var(--acc)";
      document.getElementById("lbl-mk-txt").textContent =
        "Perbarui master.xlsx";
    }

    checkCanGo();
  } catch (e) {
    console.warn("Init upload status error:", e);
  }
})();

// ==============================
// 📥 UPLOAD ABSENSI
// ==============================
async function uploadAbsensi(file) {
  if (!file) return;
  if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
    toast("❌ Format tidak didukung", "err");
    return;
  }
  loading(true);
  const fd = new FormData();
  fd.append("file", file);
  try {
    const r = await fetch("/upload-absensi", { method: "POST", body: fd });
    const d = await r.json();
    if (d.success) {
      hasAbsensi = true;
      document.getElementById("st-ab").textContent = "✅ Terupload";
      document.getElementById("st-ab").className = "up-status ok";
      document.getElementById("box-ab").style.borderColor = "var(--g)";
      const ri = document.getElementById("res-ab");
      ri.style.display = "block";
      ri.innerHTML =
        `<strong>📄 ${d.filename}</strong><br>` +
        `${d.total_karyawan} karyawan` +
        (!hasMaster
          ? '<br><span style="color:var(--acc)">⚠️ Upload master.xlsx agar divisi terisi</span>'
          : "");
      document.getElementById("err-ab").style.display = "none";
      document.getElementById("lbl-ab-txt").textContent = "Ganti file absensi";
      checkCanGo();
      toast("✅ File absensi berhasil dimuat", "ok");
    } else {
      document.getElementById("err-ab").style.display = "block";
      document.getElementById("err-ab").textContent = "⚠️ " + d.error;
    }
  } catch (e) {
    toast("❌ Gagal: " + e.message, "err");
  }
  loading(false);
}

// ==============================
// 👥 UPLOAD MASTER
// ==============================
async function uploadMaster(file) {
  if (!file) return;
  if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
    toast("❌ Format tidak didukung", "err");
    return;
  }
  loading(true);
  const fd = new FormData();
  fd.append("file", file);
  try {
    const r = await fetch("/upload-master", { method: "POST", body: fd });
    const d = await r.json();
    if (d.success) {
      hasMaster = true;
      document.getElementById("st-mk").textContent = "✅ Terupload";
      document.getElementById("st-mk").className = "up-status ok";
      document.getElementById("box-mk").style.borderColor = "var(--acc)";
      const ri = document.getElementById("res-mk");
      ri.style.display = "block";
      const roles = Object.entries(d.roles || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ");
      ri.innerHTML = `<strong>👥 ${d.filename}</strong><br>${d.total} karyawan · ${roles}`;
      document.getElementById("err-mk").style.display = "none";
      document.getElementById("lbl-mk-txt").textContent = "Ganti master.xlsx";
      checkCanGo();
      toast("✅ Master karyawan berhasil dimuat", "ok");
    } else {
      document.getElementById("err-mk").style.display = "block";
      document.getElementById("err-mk").textContent = "⚠️ " + d.error;
    }
  } catch (e) {
    toast("❌ Gagal: " + e.message, "err");
  }
  loading(false);
}

// ==============================
// ✅ CEK TOMBOL DASHBOARD
// Aktif jika absensi ada — master tidak wajib upload ulang
// ==============================
function checkCanGo() {
  const btn = document.getElementById("btn-go-dash");
  const txt = document.getElementById("txt-go");
  if (!btn || !txt) return;

  if (hasAbsensi) {
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
    txt.textContent = hasMaster
      ? "✅ Siap ditampilkan dengan data divisi lengkap"
      : "⚠️ Bisa lanjut tapi divisi belum ada";
    txt.style.color = hasMaster ? "var(--g)" : "var(--acc)";
  } else {
    btn.style.opacity = "0.4";
    btn.style.pointerEvents = "none";
    txt.textContent = "Upload file absensi terlebih dahulu";
    txt.style.color = "var(--mut)";
  }
}

// ==============================
// 🖱️ DRAG & DROP
// ==============================
["ab", "mk"].forEach((k) => {
  const lbl = document.getElementById("lbl-" + k);
  if (!lbl) return;
  lbl.addEventListener("dragover", (e) => {
    e.preventDefault();
    lbl.style.borderColor = "var(--g)";
    lbl.style.background = "var(--gp)";
  });
  lbl.addEventListener("dragleave", () => {
    lbl.style.borderColor = "";
    lbl.style.background = "";
  });
  lbl.addEventListener("drop", (e) => {
    e.preventDefault();
    lbl.style.borderColor = "";
    lbl.style.background = "";
    const f = e.dataTransfer.files[0];
    if (k === "ab") uploadAbsensi(f);
    else uploadMaster(f);
  });
});
