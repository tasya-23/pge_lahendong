// ── Modal Detail ───────────────────────────────────────────
      async function openDetail(id, nama) {
        loading(true);
        const r = await fetch(`/api/detail/${id}?${getParams()}`),
          d = await r.json();
        loading(false);
        if (d.error) {
          toast("❌ " + d.error, "err");
          return;
        }

        document.getElementById("m-nama").textContent = d.nama || nama;
        document.getElementById("m-divisi").textContent =
          "🏭 " +
          (d.divisi || "—") +
          (d.jabatan ? " · " + d.jabatan : "") +
          " · ID: " +
          id;
        document.getElementById("m-hadir").textContent = d.rekap.hadir;
        document.getElementById("m-lambat").textContent = d.rekap.terlambat;
        document.getElementById("m-tidak").textContent = d.rekap.tidak_hadir;
        document.getElementById("m-total-jam").textContent =
          (d.rekap.total_jam || 0) + " jam";
        document.getElementById("m-avg-jam").textContent =
          (d.rekap.avg_jam || 0) + " jam/hari";

        const SC = {
          Hadir: "sp-hadir",
          Terlambat: "sp-terlambat",
          "Tidak Hadir": "sp-tidak",
        };
        document.getElementById("m-body").innerHTML = d.detail
          .map(
            (row) => `<tr>
    <td>${row.tanggal}</td>
    <td style="color:var(--mut)">${row.hari}</td>
    <td style="font-family:'DM Mono',monospace">${row.jam_masuk}</td>
    <td style="font-family:'DM Mono',monospace">${row.jam_keluar}</td>
    <td><span class="jam-chip">${row.jam_kerja || "-"}</span></td>
    <td><span class="sp ${SC[row.status] || ""}">${row.status}</span></td>
  </tr>`
          )
          .join("");

        document.getElementById("modal-bg").classList.add("open");
      }

      function closeModal(e) {
        if (e.target.id === "modal-bg")
          document.getElementById("modal-bg").classList.remove("open");
      }
      function closeModalDirect() {
        document.getElementById("modal-bg").classList.remove("open");
      }
