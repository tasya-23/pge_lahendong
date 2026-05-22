// ── Dashboard ──────────────────────────────────────────────
async function loadDashboard() {
  await Promise.all([
    loadSummary(),
    loadPieChart(),
    loadBarChart(),
    loadDeptChart(),
    loadDeptTable(),
  ]);
  // Kalau role user, load trend harian
  if (typeof userRole !== "undefined" && userRole === "user") {
    await loadUserTrend();
  }
  // Kalau role manager, load insight manager
  if (typeof userRole !== "undefined" && userRole === "manager") {
    await loadManagerInsight();
  }
}

// =======================
// SUMMARY — Stat Cards + Total Jam
// =======================
async function loadSummary() {
  try {
    const d = await safeFetch("/api/summary?" + getParams());
    if (!d || d.error) return;

    animNum("sv-kar",    d.total_karyawan   || 0);
    animNum("sv-hk",     d.hari_kerja        || 0);
    animNum("sv-hadir",  d.total_hadir       || 0);
    animNum("sv-lambat", d.total_terlambat   || 0);
    animNum("sv-tidak",  d.total_tidak_hadir || 0);

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    // Sub-label pakai total_slot (karyawan × hari kerja) = akurat
    const slot    = d.total_slot || 1;
    const pctH    = d.pct_hadir     || 0;
    const pctL    = d.pct_terlambat || 0;
    const pctT    = d.pct_tidak     || 0;

    set("sv-hadir-pct",  pctH + "% tingkat kehadiran");
    set("sv-lambat-pct", pctL + "% dari total slot");
    set("sv-tidak-sub",  pctT + "% dari total slot");

    // Update label card agar lebih informatif
    const lblHadir = document.querySelector(".sc.p .sc-lbl");
    const lblHk    = document.querySelector(".sc.b .sc-sub");
    if (lblHadir) lblHadir.textContent = "Tingkat Kehadiran";
    if (lblHk)    lblHk.textContent    = slot + " total slot";

    // Total Jam
    const jam = d.total_jam_kerja || 0;
    const jamFmt = jam % 1 === 0
      ? jam.toLocaleString("id-ID")
      : jam.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    set("sv-jam", jamFmt + " jam");

  } catch (e) {
    console.error("loadSummary error:", e);
  }
}

// =======================
// PIE CHART — Grafik Kehadiran (donut)
// =======================
async function loadPieChart() {
  try {
    const d = await safeFetch("/api/chart-pie?" + getParams());
    if (!d || d.error || !d.values) {
      console.warn("Pie chart: tidak ada data");
      return;
    }

    const ctx = document.getElementById("chartPie");
    if (!ctx) return;

    if (chartPie) { chartPie.destroy(); chartPie = null; }

    const total   = (d.values || []).reduce((a, b) => a + b, 0);
    const pctArr  = (d.values || []).map(v => total > 0 ? Math.round(v / total * 100) : 0);

    chartPie = new Chart(ctx.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: d.labels || ["Hadir", "Terlambat", "Tidak Hadir"],
        datasets: [{
          data:            d.values || [0, 0, 0],
          backgroundColor: ["#1a5c3a", "#f0a500", "#dc3545"],
          borderWidth:     0,
          hoverOffset:     4,
        }],
      },
      options: {
        cutout:  "72%",
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
      },
    });

    // Progress bars
    const ids = ["hadir", "lambat", "tidak"];
    pctArr.forEach((pct, i) => {
      const bar = document.getElementById("pb-" + ids[i]);
      const val = document.getElementById("pb-" + ids[i] + "-v");
      if (bar) bar.style.width = pct + "%";
      if (val) val.textContent  = pct + "%";
    });

    // Teks tengah donut
    const center = document.getElementById("pie-center");
    if (center) center.textContent = pctArr[0] + "%";

    // Badge
    const badge = document.getElementById("cb-pie");
    if (badge) badge.textContent = (d.total_karyawan || 0) + " karyawan";

  } catch (e) {
    console.error("loadPieChart error:", e);
  }
}

// =======================
// BAR CHART — Distribusi Status (per Divisi)
// =======================
async function loadBarChart() {
  try {
    const d = await safeFetch("/api/chart-dept?" + getParams());
    if (!d || d.error) return;

    const ctx = document.getElementById("chartBar");
    if (!ctx) return;

    if (chartBar) { chartBar.destroy(); chartBar = null; }

    chartBar = new Chart(ctx.getContext("2d"), {
      type: "bar",
      data: {
        labels: d.divisi || [],
        datasets: [
          { label: "Hadir",       data: d.hadir       || [], backgroundColor: "#1a5c3a", borderRadius: 4 },
          { label: "Terlambat",   data: d.terlambat   || [], backgroundColor: "#f0a500", borderRadius: 4 },
          { label: "Tidak Hadir", data: d.tidak_hadir || [], backgroundColor: "#dc3545", borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { font: { size: 11 } } } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true },
        },
      },
    });

    const badge = document.getElementById("cb-bar");
    if (badge) badge.textContent = (d.divisi || []).length + " divisi";

  } catch (e) {
    console.error("loadBarChart error:", e);
  }
}

// =======================
// DEPT CHART — Grafik per Divisi
// =======================
async function loadDeptChart() {
  try {
    const d = await safeFetch("/api/chart-dept?" + getParams());
    if (!d || d.error) return;

    const ctx = document.getElementById("chartDept");
    if (!ctx) return;

    if (chartDept) { chartDept.destroy(); chartDept = null; }

    chartDept = new Chart(ctx.getContext("2d"), {
      type: "bar",
      data: {
        labels: d.divisi || [],
        datasets: [
          { label: "Hadir",       data: d.hadir       || [], backgroundColor: "#2d8a5a", borderRadius: 4 },
          { label: "Terlambat",   data: d.terlambat   || [], backgroundColor: "#f0a500", borderRadius: 4 },
          { label: "Tidak Hadir", data: d.tidak_hadir || [], backgroundColor: "#dc3545", borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { font: { size: 11 } } } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true },
        },
      },
    });

    const badge = document.getElementById("cb-dept");
    if (badge) badge.textContent = (d.divisi || []).length + " divisi";

  } catch (e) {
    console.error("loadDeptChart error:", e);
  }
}

// =======================
// TABLE DIVISI — Rekap per Divisi
// =======================
async function loadDeptTable() {
  try {
    const d = await safeFetch("/api/chart-dept?" + getParams());
    if (!d || d.error) {
      console.warn("Data divisi error / kosong");
      return;
    }

    const el = document.getElementById("divisiTable");
    if (!el) return;

    const divisi    = d.divisi      || [];
    const hadir     = d.hadir       || [];
    const terlambat = d.terlambat   || [];
    const tidak     = d.tidak_hadir || [];
    const pct       = d.pct_hadir   || [];

    if (!divisi.length) {
      el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--mut)">📭 Tidak ada data divisi</div>`;
      return;
    }

    el.innerHTML = `
      <table class="dt">
        <thead>
          <tr>
            <th>Divisi</th>
            <th>% Hadir</th>
            <th>H</th>
            <th>T</th>
            <th>Tdk H</th>
          </tr>
        </thead>
        <tbody>
          ${divisi.map((dep, i) => `
            <tr>
              <td>${escapeHTML(String(dep || "-"))}</td>
              <td>${pct[i] ?? 0}%</td>
              <td>${hadir[i] ?? 0}</td>
              <td>${terlambat[i] ?? 0}</td>
              <td>${tidak[i] ?? 0}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;

  } catch (e) {
    console.error("loadDeptTable error:", e);
  }
}

// =======================
// TREND HARIAN — khusus role user
// =======================
let chartTrend    = null;
let chartJamMasuk = null;
let chartKetepatan = null;

async function loadUserTrend() {
  try {
    const data = await safeFetch("/api/trend-me?" + getParams());
    if (!data || !data.length) {
      document.getElementById("trend-table-body").innerHTML =
        `<tr><td colspan="6" class="empty" style="padding:28px;text-align:center;color:var(--mut)">
          📭 Tidak ada data untuk periode ini
        </td></tr>`;
      return;
    }

    const labels  = data.map(d => d.hari.slice(0,3) + " " + d.tanggal_fmt);
    const STATUS_COLOR = { "Hadir": "#1a5c3a", "Terlambat": "#f0a500", "Tidak Hadir": "#dc3545" };

    // ── Chart 1: Trend bar (status per hari) ──────────────────
    const ctxTrend = document.getElementById("chartTrend");
    if (ctxTrend) {
      if (chartTrend) { chartTrend.destroy(); chartTrend = null; }
      chartTrend = new Chart(ctxTrend.getContext("2d"), {
        type: "bar",
        data: {
          labels,
          datasets: [{
            data: data.map(d =>
              d.status === "Hadir" ? 3 : d.status === "Terlambat" ? 2 : 1
            ),
            backgroundColor: data.map(d => STATUS_COLOR[d.status] || "#6b7280"),
            borderRadius: 5,
            borderSkipped: false,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => " " + data[ctx.dataIndex].status,
                afterLabel: ctx => {
                  const d = data[ctx.dataIndex];
                  if (d.jam_masuk !== "-")
                    return `  Masuk: ${d.jam_masuk}  Keluar: ${d.jam_keluar}`;
                  return "";
                }
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: {
              display: true, min: 0, max: 3.5,
              ticks: {
                stepSize: 1,
                callback: v => ({ 1:"Absen", 2:"Lambat", 3:"Hadir" }[v] || "")
              },
              grid: { color: "rgba(0,0,0,0.05)" }
            }
          }
        }
      });
    }

    // ── Chart 2: Jam masuk per hari ───────────────────────────
    const ctxJam = document.getElementById("chartJamMasuk");
    if (ctxJam) {
      if (chartJamMasuk) { chartJamMasuk.destroy(); chartJamMasuk = null; }

      const hadirData = data.filter(d => d.jam_float !== null);
      const jamLabels = hadirData.map(d => d.hari.slice(0,3) + " " + d.tanggal_fmt);
      const jamValues = hadirData.map(d => d.jam_float);
      const batasJam  = 8 + (15 / 60); // 08:15 default toleransi

      chartJamMasuk = new Chart(ctxJam.getContext("2d"), {
        type: "bar",
        data: {
          labels: jamLabels,
          datasets: [{
            label: "Jam masuk",
            data: jamValues,
            backgroundColor: jamValues.map(j => j > batasJam ? "#f0a500" : "#1a5c3a"),
            borderRadius: 4,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const val = ctx.raw;
                  const h   = Math.floor(val);
                  const m   = Math.round((val - h) * 60);
                  return ` ${h}:${m.toString().padStart(2,"0")}`;
                }
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: {
              min: 7.0, max: 9.0,
              grid: { color: "rgba(0,0,0,0.05)" },
              ticks: {
                font: { size: 10 },
                callback: v => {
                  const h = Math.floor(v);
                  const m = Math.round((v - h) * 60);
                  return `${h}:${m.toString().padStart(2,"0")}`;
                }
              }
            }
          },
          // Garis batas jam masuk
          plugins2: {},
        },
        plugins: [{
          id: "batasLine",
          afterDraw(chart) {
            const { ctx: c, chartArea: { left, right }, scales: { y } } = chart;
            const yPos = y.getPixelForValue(batasJam);
            c.save();
            c.beginPath();
            c.strokeStyle = "#dc3545";
            c.lineWidth = 1.5;
            c.setLineDash([5, 4]);
            c.moveTo(left, yPos);
            c.lineTo(right, yPos);
            c.stroke();
            c.setLineDash([]);
            c.fillStyle = "#dc3545";
            c.font = "10px sans-serif";
            c.fillText("Batas masuk", right - 70, yPos - 4);
            c.restore();
          }
        }]
      });
    }

    // ── Chart 3: Donut ketepatan waktu ────────────────────────
    const tepat    = data.filter(d => d.status === "Hadir").length;
    const lambat   = data.filter(d => d.status === "Terlambat").length;
    const absen    = data.filter(d => d.status === "Tidak Hadir").length;
    const hadirAll = tepat + lambat;
    const pctTepat = hadirAll > 0 ? Math.round(tepat / hadirAll * 100) : 0;

    const ctxKt = document.getElementById("chartKetepatan");
    if (ctxKt) {
      if (chartKetepatan) { chartKetepatan.destroy(); chartKetepatan = null; }
      chartKetepatan = new Chart(ctxKt.getContext("2d"), {
        type: "doughnut",
        data: {
          datasets: [{
            data: [tepat, lambat],
            backgroundColor: ["#1a5c3a", "#f0a500"],
            borderWidth: 0,
          }]
        },
        options: {
          cutout: "72%",
          plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
      });
    }

    // Set nilai teks
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("kt-pct",    pctTepat + "%");
    set("kt-tepat",  tepat);
    set("kt-lambat", lambat);
    set("kt-absen",  absen);

    const barTepat  = document.getElementById("kt-bar-tepat");
    const barLambat = document.getElementById("kt-bar-lambat");
    if (barTepat)  barTepat.style.width  = pctTepat + "%";
    if (barLambat) barLambat.style.width = (100 - pctTepat) + "%";

    // ── Tabel absensi terakhir (semua data, scroll) ───────────
    const SC = {
      "Hadir":       '<span class="sp sp-hadir">Hadir</span>',
      "Terlambat":   '<span class="sp sp-terlambat">Terlambat</span>',
      "Tidak Hadir": '<span class="sp sp-tidak">Tidak Hadir</span>',
    };

    // Tampilkan dari terbaru
    const reversed = [...data].reverse();
    document.getElementById("trend-table-body").innerHTML = reversed.map(d => `
      <tr>
        <td>${d.tanggal}</td>
        <td style="color:var(--mut)">${d.hari}</td>
        <td style="font-family:'DM Mono',monospace">${d.jam_masuk}</td>
        <td style="font-family:'DM Mono',monospace">${d.jam_keluar}</td>
        <td><span class="jam-chip">${d.jam_kerja !== null ? d.jam_kerja + " jam" : "-"}</span></td>
        <td>${SC[d.status] || d.status}</td>
      </tr>`).join("");

    const badge = document.getElementById("cb-trend-count");
    if (badge) badge.textContent = data.length + " hari";

  } catch (e) {
    console.error("loadUserTrend error:", e);
  }
}

// =======================
// TOGGLE TAMPILAN USER vs ADMIN
// Dipanggil dari init.js setelah role diketahui
// =======================
function showUserDashboard() {
  // Tampilkan section trend user
  const userSection = document.getElementById("user-trend-section");
  if (userSection) userSection.style.display = "";

  // Sembunyikan chart admin (donut, bar, rekap divisi, grafik divisi)
  ["admin-charts-row", "admin-dept-row"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // Sembunyikan filter divisi
  ["fdiv-dept", "fg-dept"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // Sembunyikan stat card "Total Karyawan" (tidak relevan untuk user)
  const karCard = document.querySelector(".sc.g");
  if (karCard) karCard.style.display = "none";

  // Update label stat cards agar lebih personal
  const setLbl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setLbl("sv-hadir-pct",  "hari hadir bulan ini");
  setLbl("sv-lambat-pct", "kali terlambat");
  setLbl("sv-tidak-sub",  "hari tidak hadir");

  // Ubah judul
  const h1 = document.querySelector("#page-dash h1");
  if (h1) h1.textContent = "Data Kehadiran Saya";
}

// =======================
// TOGGLE TAMPILAN MANAGER
// Dipanggil dari init.js setelah role diketahui
// =======================
function showManagerDashboard() {
  // Tampilkan section insight manager
  const ms = document.getElementById("manager-insight-section");
  if (ms) ms.style.display = "";

  // Sembunyikan grafik per divisi (tidak informatif untuk manager)
  const gpdCard = document.getElementById("grafik-per-divisi-card");
  if (gpdCard) gpdCard.style.display = "none";

  // Perlebar rekap per divisi mengisi ruang penuh
  const deptRow = document.getElementById("admin-dept-row");
  if (deptRow) {
    deptRow.style.gridTemplateColumns = "1fr";
  }
}

// =======================
// LOAD MANAGER INSIGHT
// Top terlambat, top absen, ringkasan harian
// =======================
async function loadManagerInsight() {
  try {
    const d = await safeFetch("/api/manager-insight?" + getParams());
    if (!d || d.error) return;

    // ── Ringkasan harian ──────────────────────────────────
    const rh = d.ringkasan_harian || {};
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set("mg-tanggal",    rh.tanggal        || "—");
    set("mg-hadir",      rh.hadir_hari     ?? "—");
    set("mg-absen",      rh.tidak_hadir_hari ?? "—");
    set("mg-pct-hadir",  (rh.pct_hadir     ?? 0) + "%");
    set("mg-pct-tepat",  (rh.pct_tepat     ?? 0) + "%");

    // ── Render list item ──────────────────────────────────
    function renderRankList(elId, data, key, color, unit, emptyMsg) {
      const el = document.getElementById(elId);
      if (!el) return;
      if (!data || !data.length) {
        el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--mut);font-size:13px">${emptyMsg}</div>`;
        return;
      }
      el.innerHTML = data.map((r, i) => {
        const dc = { "Operasi":"#1a5c3a","Maintenance":"#d97706","Business Support":"#2563eb","HSSE":"#dc3545","GPR":"#7c3aed" }[r.divisi] || "#6b7280";
        const medals = ["🥇","🥈","🥉"];
        return `<div style="display:flex;align-items:center;gap:10px;padding:9px 17px;border-bottom:1px solid var(--bor)">
          <div style="width:26px;height:26px;border-radius:7px;background:${color}18;display:grid;place-items:center;
                      font-size:13px;font-weight:800;color:${color};flex-shrink:0;font-family:'DM Mono',monospace">
            ${i < 3 ? medals[i] : r[key]}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(r.nama)}</div>
            <div style="font-size:11px;color:var(--mut);margin-top:1px">
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dc};margin-right:3px;vertical-align:middle"></span>
              ${escapeHTML(r.divisi)}
            </div>
          </div>
          <div style="font-size:16px;font-weight:800;font-family:'DM Mono',monospace;color:${color};text-align:right">
            ${r[key]}<span style="font-size:10px;font-weight:600;color:var(--mut);display:block;text-align:center">${unit}</span>
          </div>
        </div>`;
      }).join("");
    }

    renderRankList(
      "mg-top-terlambat", d.top_terlambat,
      "terlambat", "#f0a500", "kali",
      "✅ Tidak ada yang terlambat bulan ini"
    );
    renderRankList(
      "mg-top-absen", d.top_absen,
      "tidak_hadir", "#dc3545", "hari",
      "✅ Semua karyawan hadir bulan ini"
    );

  } catch (e) {
    console.error("loadManagerInsight error:", e);
  }
}
