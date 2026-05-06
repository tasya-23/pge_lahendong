// ── Ranking ────────────────────────────────────────────────
      async function loadRanking() {
        const topN = document.getElementById("rank-top")?.value || 10;
        const p = getParams() + "&top=" + topN;
        const r = await fetch("/api/ranking?" + p),
          rows = await r.json();
        document.getElementById("cb-rank").textContent =
          "Top " + topN + " Karyawan";
        document.getElementById("rank-periode").textContent =
          "Periode: " + getPeriodeLabel();

        if (!rows.length) {
          document.getElementById("rank-list").innerHTML =
            '<div style="padding:28px;text-align:center;color:var(--mut)">🔍 Tidak ada data</div>';
          return;
        }
        const maxH = rows[0].hadir || 1;
        const MEDALS = ["🥇", "🥈", "🥉"];
        const CLS = ["r1", "r2", "r3"];

        document.getElementById("rank-list").innerHTML = rows
          .map((r, i) => {
            const cls = i < 3 ? CLS[i] : "rn";
            const barW = Math.round((r.hadir / maxH) * 100);
            const dc = DEPT_COLORS[r.divisi] || "#6b7280";
            return `<div class="ri">
      <div class="rn ${cls}">${r.rank}</div>
      <div class="ri-info">
        <div class="ri-name">${r.nama}</div>
        <div class="ri-divisi"><span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${dc};margin-right:4px;vertical-align:middle"></span>${
              r.divisi
            }</div>
      </div>
      <div class="ri-bar">
        <div class="rb-track"><div class="rb-fill" style="width:0%" data-w="${barW}"></div></div>
        <div class="rb-pct">${r.pct_tepat}% tepat</div>
      </div>
      <div class="ri-hadir">${r.hadir}<span>hari</span></div>
      <div class="ri-medal">${
        i < 3
          ? MEDALS[i]
          : `<span style="font-size:11px;font-family:'DM Mono',monospace;color:var(--mut)">#${r.rank}</span>`
      }</div>
    </div>`;
          })
          .join("");

        setTimeout(
          () =>
            document
              .querySelectorAll(".rb-fill")
              .forEach((el) => (el.style.width = el.dataset.w + "%")),
          80
        );

        // Warning list
        const allR = await (
          await fetch("/api/ranking?" + getParams() + "&top=999")
        ).json();
        document.getElementById("cb-warn").textContent =
          allR.length + " karyawan";
        const topTidak = [...allR]
          .sort((a, b) => b.tidak_hadir - a.tidak_hadir)
          .slice(0, 5);
        const topLambat = [...allR]
          .sort((a, b) => b.terlambat - a.terlambat)
          .slice(0, 5);

        function warnItem(r, key, color, unit) {
          if (!r[key])
            return `<div style="padding:7px 17px;font-size:12px;color:var(--mut)">— Tidak ada</div>`;
          const dc = DEPT_COLORS[r.divisi] || "#6b7280";
          return `<div class="ri" style="padding:8px 17px">
      <div style="width:24px;height:24px;border-radius:6px;background:${color}20;display:grid;place-items:center;font-size:11px;font-weight:800;color:${color};flex-shrink:0">${r[key]}</div>
      <div class="ri-info">
        <div class="ri-name" style="font-size:12.5px">${r.nama}</div>
        <div class="ri-divisi"><span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${dc};margin-right:4px;vertical-align:middle"></span>${r.divisi}</div>
      </div>
      <div style="font-size:10px;font-weight:700;color:${color};font-family:'DM Mono',monospace">${r[key]} ${unit}</div>
    </div>`;
        }
        document.getElementById("warn-tidak").innerHTML = topTidak
          .map((r) => warnItem(r, "tidak_hadir", "#dc3545", "hari"))
          .join("");
        document.getElementById("warn-lambat").innerHTML = topLambat
          .map((r) => warnItem(r, "terlambat", "#f0a500", "kali"))
          .join("");
      }
