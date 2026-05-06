// ── Rekap ──────────────────────────────────────────────────
      async function loadRekap() {
        const tbody = document.getElementById("rekap-body");
        const r = await fetch("/api/rekap?" + getParams()),
          rows = await r.json();
        document.getElementById("cb-tbl").textContent =
          rows.length + " karyawan";
        if (!rows.length) {
          tbody.innerHTML = `<tr><td colspan="10" class="empty"><span class="ico">🔍</span>Tidak ada data</td></tr>`;
          return;
        }
        tbody.innerHTML = rows
          .map((r) => {
            const col = DEPT_COLORS[r.divisi] || "#6b7280";
            const hb = r.hadir >= 18 ? "bg" : r.hadir >= 10 ? "bb" : "by";
            return `<tr onclick="openDetail('${r.id}','${r.nama}')">
      <td class="td-no">${r.no}</td>
      <td class="td-no" style="font-size:11px">${r.id}</td>
      <td><span class="td-name">${r.nama}</span></td>
      <td><span class="divisi-tag"><span class="divisi-dot" style="background:${col}"></span>${
              r.divisi
            }</span></td>
      <td><span class="badge ${hb}">${r.hadir}</span></td>
      <td>${
        r.terlambat > 0
          ? `<span class="badge by">${r.terlambat}</span>`
          : r.terlambat
      }</td>
      <td>${
        r.tidak_hadir > 0
          ? `<span class="badge br">${r.tidak_hadir}</span>`
          : r.tidak_hadir
      }</td>
      <td><span class="jam-chip">${r.total_jam || 0} jam</span></td>
      <td><span class="jam-chip">${r.avg_jam || 0} jam</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openDetail('${
        r.id
      }','${r.nama}')">👁 Detail</button></td>
    </tr>`;
          })
          .join("");
      }
