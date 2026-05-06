async function goDash() {
        loading(true);
        await loadFilterOptions();
        autoSelectLatest();
        switchPage("dash");
        loading(false);
      }

      // ── Filter options ─────────────────────────────────────────
      async function loadFilterOptions() {
        const r = await fetch("/api/filter-options"),
          d = await r.json();

        // Sync bulan ke semua filter
        ["f-bulan", "rf-bulan"].forEach((id) => {
          const sel = document.getElementById(id);
          if (!sel) return;
          const cur = sel.value;
          sel.innerHTML = '<option value="0">Semua Bulan</option>';
          d.bulan.forEach((b) => {
            const o = document.createElement("option");
            o.value = b;
            o.textContent = BULAN[b] || b;
            sel.appendChild(o);
          });
          if (cur) sel.value = cur;
        });

        // Sync tahun
        ["f-tahun", "rf-tahun"].forEach((id) => {
          const sel = document.getElementById(id);
          if (!sel) return;
          const cur = sel.value;
          sel.innerHTML = '<option value="0">Semua Tahun</option>';
          d.tahun.forEach((t) => {
            const o = document.createElement("option");
            o.value = t;
            o.textContent = t;
            sel.appendChild(o);
          });
          if (cur) sel.value = cur;
        });

        // Divisi filter — admin & manager bisa lihat
        const showDept = userRole === "admin" || userRole === "manager";
        ["fdiv-dept", "fg-dept", "rfdiv-dept", "rfg-dept"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.style.display = showDept ? "" : "none";
        });

        if (showDept) {
          // Divisi PGE + dari data API
          const divisiPGE = [
            "Maintenance",
            "Operasi",
            "HSSE",
            "GPR",
            "Business Support",
          ];
          const divisiDariData = d.divisi || [];

          const semuaDivisi = [
            ...new Set([...divisiDariData, ...divisiPGE]),
          ].sort();

          ["f-dept", "rf-dept"].forEach((id) => {
            const sel = document.getElementById(id);
            if (!sel) return;
            sel.innerHTML = '<option value="">Semua Divisi</option>';
            semuaDivisi.forEach((dep) => {
              const o = document.createElement("option");
              o.value = dep;
              o.textContent = dep;
              sel.appendChild(o);
            });
          });

          // Manager auto filter ke divisi sendiri
          if (userRole === "manager" && userDept) {
            ["f-dept", "rf-dept"].forEach((id) => {
              const sel = document.getElementById(id);
              if (sel) sel.value = userDept;
            });
          }
        }
      }

      function autoSelectLatest() {
        ["f-bulan", "rf-bulan"].forEach((id) => {
          const sel = document.getElementById(id);
          if (sel && sel.options.length > 1)
            sel.selectedIndex = sel.options.length - 1;
        });
        ["f-tahun", "rf-tahun"].forEach((id) => {
          const sel = document.getElementById(id);
          if (sel && sel.options.length > 1)
            sel.selectedIndex = sel.options.length - 1;
        });
      }

      function getParams() {
        const deptVal = document.getElementById("f-dept")?.value || "";
        return new URLSearchParams({
          bulan: document.getElementById("f-bulan")?.value || "0",
          tahun: document.getElementById("f-tahun")?.value || "0",
          divisi: deptVal === "Semua" ? "" : deptVal,
        }).toString();
      }

      function getPeriodeLabel() {
        const b = document.getElementById("f-bulan"),
          t = document.getElementById("f-tahun");
        if (!b || !t) return "";
        const bl = b.options[b.selectedIndex]?.text || "Semua";
        const tl = t.value === "0" ? "" : t.value;
        return `${bl} ${tl}`.trim();
      }

      function applyFilter() {
        deptCache = null; // 🔥 RESET CACHE BIAR DATA UPDATE
        syncFilters();
        const p = getParams();
        const lbl = getPeriodeLabel();

        document.getElementById("dash-periode").textContent = "Periode: " + lbl;
        document.getElementById("rekap-periode").textContent =
          "Periode: " + lbl;
        document.getElementById("rank-periode").textContent = "Periode: " + lbl;

        ["btn-excel", "btn-excel2"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.href = "/export/excel?" + p;
        });

        ["btn-pdf", "btn-pdf2"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.href = "/export/pdf?" + p;
        });

        const activePage = document.querySelector(".page.active")?.id;
        if (activePage === "page-dash") {
          if (typeof loadDashboard === "function") loadDashboard();
          else console.error("❌ loadDashboard tidak ditemukan — pastikan dashboard.js ter-load");
        }
        if (activePage === "page-rekap") {
          if (typeof loadRekap === "function") loadRekap();
          else console.error("❌ loadRekap tidak ditemukan — pastikan rekap.js ter-load");
        }
        if (activePage === "page-rank") {
          if (typeof loadRanking === "function") loadRanking();
          else console.error("❌ loadRanking tidak ditemukan — pastikan ranking.js ter-load");
        }
      }
