// ══ GANTI PASSWORD ════════════════════════════════════════

function openGantiPassword() {
  // Reset semua field & pesan
  ["pw-lama", "pw-baru", "pw-konfirm"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ""; el.type = "password"; }
  });
  const err = document.getElementById("pw-error");
  if (err) { err.style.display = "none"; err.textContent = ""; }

  // Reset strength bars
  ["psb-1","psb-2","psb-3","psb-4"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.background = "var(--bor)";
  });
  const lbl = document.getElementById("pw-strength-lbl");
  if (lbl) lbl.textContent = "";

  // Reset tombol submit
  const btn = document.getElementById("btn-submit-pw");
  if (btn) { btn.disabled = false; btn.textContent = "Simpan Password"; }

  document.getElementById("modal-ganti-pw").classList.add("open");
}

function closeGantiPassword() {
  document.getElementById("modal-ganti-pw").classList.remove("open");
}

// Toggle show/hide password
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "🙈";
  } else {
    input.type = "password";
    btn.textContent = "👁";
  }
}

// Indikator kekuatan password
function checkStrength(val) {
  let score = 0;
  if (val.length >= 6)                          score++;
  if (val.length >= 10)                         score++;
  if (/[A-Z]/.test(val) && /[a-z]/.test(val))  score++;
  if (/[0-9]/.test(val) || /[^A-Za-z0-9]/.test(val)) score++;

  const colors = ["#dc3545", "#f0a500", "#2563eb", "#1a5c3a"];
  const labels = ["Lemah", "Cukup", "Kuat", "Sangat Kuat"];

  for (let i = 1; i <= 4; i++) {
    const bar = document.getElementById("psb-" + i);
    if (bar) bar.style.background = i <= score ? colors[score - 1] : "var(--bor)";
  }
  const lbl = document.getElementById("pw-strength-lbl");
  if (lbl) {
    lbl.textContent = val.length > 0 ? labels[score - 1] || "" : "";
    lbl.style.color = score > 0 ? colors[score - 1] : "var(--mut)";
  }
}

// Submit ganti password
async function submitGantiPassword() {
  const lama    = (document.getElementById("pw-lama")?.value    || "").trim();
  const baru    = (document.getElementById("pw-baru")?.value    || "").trim();
  const konfirm = (document.getElementById("pw-konfirm")?.value || "").trim();
  const errEl   = document.getElementById("pw-error");
  const btn     = document.getElementById("btn-submit-pw");

  // Validasi sisi client
  const showErr = msg => {
    errEl.textContent    = "⚠️ " + msg;
    errEl.style.display  = "block";
  };

  errEl.style.display = "none";

  if (!lama || !baru || !konfirm) return showErr("Semua field wajib diisi");
  if (baru.length < 6)            return showErr("Password baru minimal 6 karakter");
  if (baru !== konfirm)           return showErr("Konfirmasi password tidak cocok");
  if (baru === lama)              return showErr("Password baru tidak boleh sama dengan password lama");

  // Kirim ke server
  btn.disabled    = true;
  btn.textContent = "Menyimpan...";

  try {
    const res = await fetch("/change-password", {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({
        password_lama: lama,
        password_baru: baru,
        konfirmasi:    konfirm,
      }),
    });

    const d = await res.json();

    if (d.success) {
      closeGantiPassword();
      toast("✅ Password berhasil diubah", "ok");
    } else {
      showErr(d.error || "Gagal mengubah password");
      btn.disabled    = false;
      btn.textContent = "Simpan Password";
    }
  } catch (e) {
    showErr("Terjadi kesalahan, coba lagi");
    btn.disabled    = false;
    btn.textContent = "Simpan Password";
  }
}

// Tutup modal jika klik di luar
document.getElementById("modal-ganti-pw")?.addEventListener("click", function(e) {
  if (e.target === this) closeGantiPassword();
});
