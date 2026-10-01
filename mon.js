/* ============================================================
   mon.js — chế độ "Chọn món" của vòng quay
   ------------------------------------------------------------
   Luật Thành đặt:
   · mỗi lượt lấy ÍT NHẤT 3, NHIỀU NHẤT 5 quán
   · mỗi lượt bày đúng 10 món (thiếu thì lấy hết những gì có)
   · có nút "Trộn món" để bốc lại
   · nhập một con số thì thực đơn đổi theo thần số học — cùng một
     con số luôn ra cùng một thực đơn, nên bốc được quẻ thì giữ được

   Nguồn món ghi rõ: "đã gọi" là món Thành thật sự ăn, "thực đơn"
   là món lấy từ trang chính thức của quán. Không bịa món.
   ============================================================ */
(function () {
  "use strict";

  var IT_NHAT_QUAN = 3, NHIEU_NHAT_QUAN = 5, SO_MON = 10;

  /* Bộ sinh số ngẫu nhiên có hạt giống — cùng hạt thì cùng kết quả. */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function tron(ds, rnd) {
    var a = ds.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Thần số học: cộng dồn các chữ số tới khi còn một số 1–9.
     Giữ 11, 22, 33 làm "số chủ" vì dân thần số học coi đó là số riêng. */
  function rutGon(n) {
    var s = String(Math.abs(Math.trunc(n))).replace(/\D/g, "");
    if (!s) return null;
    function cong(x) {
      return x.split("").reduce(function (a, b) { return a + Number(b); }, 0);
    }
    var t = cong(s);
    while (t > 9 && t !== 11 && t !== 22 && t !== 33) t = cong(String(t));
    return t;
  }
  var YNGHIA = {
    1: "số của người mở đường — thử món chưa ăn bao giờ",
    2: "số của cặp đôi — gọi món chia hai được",
    3: "số của niềm vui — món nào nhìn vui mắt thì gọi",
    4: "số của nền nếp — quay lại món ruột cũng không sao",
    5: "số của xê dịch — đổi vùng ẩm thực đi",
    6: "số của sum vầy — gọi phần lớn cho cả bàn",
    7: "số của ngẫm nghĩ — chọn món ăn chậm",
    8: "số của đủ đầy — hôm nay cho phép gọi món đắt",
    9: "số của trọn vẹn — gọi món đã thích từ lâu",
    11: "số chủ 11 — tin vào miếng đầu tiên",
    22: "số chủ 22 — gọi nguyên set, đừng lẻ tẻ",
    33: "số chủ 33 — rủ thêm người rồi hãy gọi"
  };

  /* Gom món của một quán: món đã gọi đứng trước, rồi tới thực đơn. */
  function monCuaQuan(r) {
    var ds = [];
    if (r.mon) ds.push({ ten: r.mon, nguon: "đã gọi" });
    (r.monList || []).forEach(function (m) {
      if (m && m !== r.mon) ds.push({ ten: m, nguon: "thực đơn" });
    });
    return ds;
  }

  function khongDau(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  }

  var MON = window.MON = {
    hat: null,        // hạt giống đang dùng (null = bốc ngẫu nhiên)
    so: null,         // con số Thành nhập
    soChuDao: null,   // số sau khi rút gọn

    datSo: function (n) {
      var g = rutGon(n);
      if (g === null) { this.so = null; this.soChuDao = null; this.hat = null; return null; }
      this.so = Math.abs(Math.trunc(n));
      this.soChuDao = g;
      this.hat = this.so * 2654435761 % 4294967296;
      return g;
    },
    tronLai: function () {
      this.so = null; this.soChuDao = null;
      this.hat = Math.floor(Math.random() * 4294967296);
    },
    yNghia: function () { return YNGHIA[this.soChuDao] || ""; },

    /* Trả về danh sách món cho vòng quay, mỗi món là một bản sao của
       quán kèm id riêng — để tick chọn từng món không dính cả quán. */
    tao: function (dsQuan) {
      var coMon = dsQuan.filter(function (r) { return monCuaQuan(r).length > 0; });
      if (!coMon.length) return [];

      var rnd = mulberry32(this.hat === null ? Math.floor(Math.random() * 4294967296) : this.hat);
      var thuTu = tron(coMon, rnd);

      /* Chốt số quán trong khoảng 3–5, không vượt số quán đang có. */
      var soQuan = Math.min(NHIEU_NHAT_QUAN, thuTu.length);
      if (thuTu.length >= IT_NHAT_QUAN) soQuan = Math.max(IT_NHAT_QUAN, soQuan);
      var chon = thuTu.slice(0, soQuan);

      /* Lấy luân phiên từng quán một món, để không quán nào lấn át. */
      var kho = chon.map(function (r) { return { quan: r, mon: tron(monCuaQuan(r), rnd) }; });
      var ra = [], vong = 0, an_toan = 0;
      while (ra.length < SO_MON && an_toan++ < 200) {
        var themDuoc = false;
        for (var i = 0; i < kho.length && ra.length < SO_MON; i++) {
          if (kho[i].mon.length > vong) {
            var m = kho[i].mon[vong], r = kho[i].quan;
            ra.push(Object.assign({}, r, {
              id: r.id + "::" + khongDau(m.ten),
              quanId: r.id,
              mon: m.ten,
              nguonMon: m.nguon
            }));
            themDuoc = true;
          }
        }
        if (!themDuoc) break;
        vong++;
      }
      this.soQuanDaDung = chon.length;
      return tron(ra, rnd);
    }
  };

  /* ---------- Bảng điều khiển: nút trộn + ô nhập số ---------- */
  function dungBang() {
    if (document.querySelector("#monDieuKhien")) return;
    var neo = document.querySelector("#wheelCount");
    if (!neo) return;
    var d = document.createElement("div");
    d.id = "monDieuKhien";
    d.hidden = true;
    d.innerHTML =
      '<div class="mon-hang">' +
        '<button type="button" class="btn sm" id="monTron">Trộn món</button>' +
        '<label class="mon-so"><span>Số của bạn</span>' +
          '<input type="number" id="monSo" inputmode="numeric" placeholder="vd. ngày sinh 2710" min="0">' +
        '</label>' +
        '<button type="button" class="btn sm" id="monBoiSo">Xem quẻ</button>' +
      '</div>' +
      '<p class="mon-que" id="monQue"></p>';
    neo.parentNode.insertBefore(d, neo.nextSibling);

    document.querySelector("#monTron").onclick = function () {
      MON.tronLai();
      document.querySelector("#monSo").value = "";
      capNhatQue("Đã trộn lại — thực đơn mới hoàn toàn.");
      if (window.refreshWheel) window.refreshWheel();
    };
    function boiSo() {
      var v = document.querySelector("#monSo").value;
      if (v === "") { capNhatQue("Nhập một con số bất kỳ — ngày sinh, biển số, số nhà."); return; }
      var g = MON.datSo(Number(v));
      if (g === null) { capNhatQue("Số không hợp lệ."); return; }
      capNhatQue("Số chủ đạo <b>" + g + "</b> — " + MON.yNghia() + ".");
      if (window.refreshWheel) window.refreshWheel();
    }
    document.querySelector("#monBoiSo").onclick = boiSo;
    document.querySelector("#monSo").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); boiSo(); }
    });
  }
  function capNhatQue(html) {
    var p = document.querySelector("#monQue");
    if (p) p.innerHTML = html;
  }

  /* Hiện bảng này chỉ khi đang ở chế độ chọn món. */
  MON.dongBo = function () {
    dungBang();
    var d = document.querySelector("#monDieuKhien");
    if (d) d.hidden = (window.wheelMode !== "dishes");
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", MON.dongBo);
  else MON.dongBo();
})();
