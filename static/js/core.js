// ── Konstanta ──────────────────────────────────────────────
      const BULAN = [
        "",
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ];
      const DEPT_COLORS = {
        Operasi: "#1a5c3a",
        Maintenance: "#d97706",
        "Business Support": "#2563eb",
        HSSE: "#dc3545",
        GPR: "#7c3aed",
        "Belum Diatur": "#6b7280",
      };

      let chartPie = null,
        chartBar = null,
        chartDept = null;
      let userRole = "user",
        userDept = "",
        hasMaster = false;
      // CACHE
      let deptCache = null;
      // SAFE FETCH (biar tidak crash kalau API error)
      async function safeFetch(url) {
        const r = await fetch(url, {
          credentials: "include", // 🔥 WAJIB
        });

        if (r.status === 401) {
          alert("Session habis, silakan login ulang");
          window.location.href = "/login";
          return;
        }

        if (!r.ok) throw new Error("Server error");
        return r.json();
      }

      // ANTI XSS (WAJIB untuk keamanan)
      function escapeHTML(str = "") {
        return str.replace(
          /[&<>"']/g,
          (m) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#039;",
            }[m])
        );
      }
      // ── UI helpers ─────────────────────────────────────────────
      const loading = (v) =>
        document.getElementById("lov").classList.toggle("show", v);
      function toast(msg, type = "") {
        const el = document.getElementById("toast");
        el.textContent = msg;
        el.className = "toast show" + (type ? " " + type : "");
        setTimeout(() => el.classList.remove("show"), 3000);
      }
      function animNum(id, target) {
        const el = document.getElementById(id);
        if (!el) return;
        let cur = 0;
        const step = Math.max(1, Math.ceil(target / 30));
        clearInterval(el._t);
        el._t = setInterval(() => {
          cur = Math.min(cur + step, target);
          el.textContent = cur.toLocaleString("id-ID");
          if (cur >= target) clearInterval(el._t);
        }, 22);
      }

      // ── Page switching ─────────────────────────────────────────
      function switchPage(page) {
        document
          .querySelectorAll(".page")
          .forEach((p) => p.classList.remove("active"));
        document
          .querySelectorAll(".ni")
          .forEach((n) => n.classList.remove("active"));
        document.getElementById("page-" + page)?.classList.add("active");
        document.getElementById("nb-" + page)?.classList.add("active");
        const titles = {
          dash: "Monitoring Absensi",
          rekap: "Rekap Karyawan",
          rank: "Ranking",
          upload: "Upload Data",
        };
        document.getElementById("tb-page").textContent = titles[page] || page;

        // Show export buttons untuk admin dan manager
        const showExport =
          (page === "dash" || page === "rekap") &&
          (userRole === "admin" || userRole === "manager");
        document.getElementById("btn-excel").style.display = showExport
          ? "flex"
          : "none";
        document.getElementById("btn-pdf").style.display = showExport
          ? "flex"
          : "none";

        if (page === "dash") {
          applyFilter(); // set href export + load dashboard
        }
        if (page === "rekap") {
          applyFilter(); // set href export + load rekap
        }
        if (page === "rank") loadRanking();
      }

      function syncFilters() {
        // Sync all filter selects
        ["bulan", "tahun", "dept"].forEach((k) => {
          const a = document.getElementById("f-" + k);
          const b = document.getElementById("rf-" + k);
          if (!a || !b) return;
          if (a.value !== b.value) b.value = a.value;
        });
      }

      // ── Upload ─────────────────────────────────────────────────
