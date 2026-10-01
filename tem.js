/* ============================================================
   tem.js — Tem kết quả vòng quay, kiểu tem bưu điện
   ------------------------------------------------------------
   Quay trúng quán (hoặc trúng món) thì in ra một con tem: ảnh quán,
   tên, địa chỉ, món phải gọi, dấu bưu điện, số sê-ri và mã QR dẫn
   thẳng tới bản đồ.

   Tem được VẼ TRÊN CANVAS, không phải HTML. Nhờ vậy hình hiện trên
   màn hình và hình bấm "Chép hình" là cùng một bản vẽ — không lo
   lệch phông hay lệch bố cục. Bản xuất vẽ ở 3× cho nét.

   Phụ thuộc: vendor/qrcode.js (MIT, Kazuhiko Arase) và các hàm sẵn
   có của trang: window.items, window.mapLink.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Bảng màu riêng của tem ----------
     Tem là vật in ra giấy, nên giữ màu cố định cho giống tem thật,
     không đổi theo sáng/tối của trang. */
  var M = {
    giay:    "#f4efe3",
    giay2:   "#eae2d2",
    muc:     "#1d2630",
    mucNhat: "#5d6a77",
    do:      "#b3122b",
    vang:    "#8a6216",
    xanh:    "#1f5f49",
    dau:     "#fdf4e6"
  };

  var W = 760, H = 1040;          // khổ gốc của tem
  var R_LO = 11, B_LO = 30;       // bán kính và bước răng cưa

  function $(s, g) { return (g || document).querySelector(s); }

  /* ================= tiện ích vẽ ================= */

  function duongBo(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* Cắt chữ thành nhiều dòng vừa bề ngang; trả về số dòng đã vẽ. */
  function veChu(c, chu, x, y, rong, caoDong, toiDa) {
    var tu = String(chu || "").split(/\s+/), dong = [], cur = "";
    for (var i = 0; i < tu.length; i++) {
      var thu = cur ? cur + " " + tu[i] : tu[i];
      if (c.measureText(thu).width > rong && cur) { dong.push(cur); cur = tu[i]; }
      else cur = thu;
    }
    if (cur) dong.push(cur);
    if (toiDa && dong.length > toiDa) {
      dong = dong.slice(0, toiDa);
      var l = dong[toiDa - 1];
      while (l.length > 1 && c.measureText(l + "…").width > rong) l = l.slice(0, -1);
      dong[toiDa - 1] = l + "…";
    }
    for (var j = 0; j < dong.length; j++) c.fillText(dong[j], x, y + j * caoDong);
    return dong.length;
  }

  /* Chữ dãn cách kiểu khắc trên tem. */
  function chuDan(c, chu, x, y, dan) {
    var s = String(chu || "");
    for (var i = 0; i < s.length; i++) { c.fillText(s[i], x, y); x += c.measureText(s[i]).width + dan; }
    return x;
  }
  function beRongDan(c, chu, dan) {
    var s = String(chu || ""), w = 0;
    for (var i = 0; i < s.length; i++) w += c.measureText(s[i]).width + dan;
    return w - dan;
  }

  /* ================= các mảng trang trí ================= */

  /* Răng cưa: khoét lỗ quanh bốn cạnh. */
  function rangCua(c) {
    c.save();
    c.globalCompositeOperation = "destination-out";
    var i;
    for (i = B_LO / 2; i < W; i += B_LO) {
      c.beginPath(); c.arc(i, 0, R_LO, 0, 7); c.fill();
      c.beginPath(); c.arc(i, H, R_LO, 0, 7); c.fill();
    }
    for (i = B_LO / 2; i < H; i += B_LO) {
      c.beginPath(); c.arc(0, i, R_LO, 0, 7); c.fill();
      c.beginPath(); c.arc(W, i, R_LO, 0, 7); c.fill();
    }
    c.restore();
  }

  /* Nền giấy: vân sợi mảnh + hoa văn guilloche rất nhạt. */
  function nenGiay(c) {
    var g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, M.giay); g.addColorStop(1, M.giay2);
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    c.save(); c.globalAlpha = 0.045; c.strokeStyle = M.muc; c.lineWidth = 1;
    for (var y = 0; y < H; y += 5) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.restore();

    c.save(); c.globalAlpha = 0.028; c.strokeStyle = M.do; c.lineWidth = 1.1;
    for (var k = 0; k < 26; k++) {
      c.beginPath();
      for (var t = 0; t <= 360; t += 4) {
        var a = t * Math.PI / 180, r = 150 + 42 * Math.sin(6 * a + k * 0.42);
        var x = W / 2 + r * Math.cos(a) * 1.5, yy = H / 2 + r * Math.sin(a) * 1.9;
        t ? c.lineTo(x, yy) : c.moveTo(x, yy);
      }
      c.stroke();
    }
    c.restore();
  }

  /* Khung kép kiểu khắc, kèm bốn góc hoa thị. */
  function khungKhac(c) {
    c.strokeStyle = M.muc; c.globalAlpha = .85;
    c.lineWidth = 2.4; duongBo(c, 30, 30, W - 60, H - 60, 10); c.stroke();
    c.lineWidth = 1; duongBo(c, 40, 40, W - 80, H - 80, 7); c.stroke();
    c.globalAlpha = 1;

    var goc = [[40, 40, 1, 1], [W - 40, 40, -1, 1], [40, H - 40, 1, -1], [W - 40, H - 40, -1, -1]];
    c.strokeStyle = M.do; c.lineWidth = 2;
    goc.forEach(function (g) {
      c.beginPath();
      c.moveTo(g[0] + 20 * g[2], g[1]);
      c.quadraticCurveTo(g[0], g[1], g[0], g[1] + 20 * g[3]);
      c.stroke();
      c.beginPath(); c.arc(g[0] + 11 * g[2], g[1] + 11 * g[3], 2.6, 0, 7);
      c.fillStyle = M.do; c.fill();
    });
  }

  /* Dấu bưu điện: hai vòng tròn, chữ vòng cung, mấy vạch sóng huỷ tem. */
  function dauBuuDien(c, x, y, ngay) {
    c.save();
    c.translate(x, y); c.rotate(-14 * Math.PI / 180);
    /* Ảnh quán sáng tối khác nhau, nên dấu dùng mực sáng kèm bóng đổ
       để đọc được trong cả hai trường hợp. */
    c.globalAlpha = .82; c.strokeStyle = M.dau; c.fillStyle = M.dau;
    c.shadowColor = "rgba(0,0,0,.45)"; c.shadowBlur = 7; c.shadowOffsetY = 1;

    c.lineWidth = 3.4; c.beginPath(); c.arc(0, 0, 86, 0, 7); c.stroke();
    c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, 73, 0, 7); c.stroke();

    c.font = "600 17px 'Be Vietnam Pro', sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle";
    var tren = "TP. HO CHI MINH";
    c.save();
    for (var i = 0; i < tren.length; i++) {
      var a = (i - (tren.length - 1) / 2) * 0.153;
      c.save(); c.rotate(a); c.translate(0, -56); c.fillText(tren[i], 0, 0); c.restore();
    }
    c.restore();

    c.font = "700 21px 'Be Vietnam Pro', sans-serif";
    c.fillText(ngay, 0, -6);
    c.font = "600 13px 'Be Vietnam Pro', sans-serif";
    c.fillText("SO QUAN AN", 0, 18);

    c.lineWidth = 3.6;
    for (var k = 0; k < 4; k++) {
      c.beginPath();
      for (var t = -132; t <= 132; t += 6) {
        var yy = 40 + k * 11 + Math.sin(t / 15) * 3.4;
        t === -132 ? c.moveTo(t, yy) : c.lineTo(t, yy);
      }
      c.stroke();
    }
    c.restore();
  }

  /* Mệnh giá — góc trên phải, như ô giá trên tem thật. */
  function menhGia(c, r) {
    var x = W - 196, y = 58, w = 138, h = 72;
    c.save();
    c.fillStyle = M.do; duongBo(c, x, y, w, h, 6); c.fill();
    c.strokeStyle = M.giay; c.lineWidth = 1.4;
    duongBo(c, x + 5, y + 5, w - 10, h - 10, 4); c.stroke();
    c.fillStyle = M.giay; c.textAlign = "center"; c.textBaseline = "middle";
    if (Number(r.gia) > 0) {
      c.font = "800 27px 'Bricolage Grotesque','Be Vietnam Pro',sans-serif";
      c.fillText(Math.round(Number(r.gia) / 1000) + "K", x + w / 2, y + h / 2 - 7);
      c.font = "600 11px 'Be Vietnam Pro',sans-serif";
      c.fillText("MỘT NGƯỜI", x + w / 2, y + h / 2 + 17);
    } else {
      c.font = "800 25px 'Bricolage Grotesque','Be Vietnam Pro',sans-serif";
      c.fillText(r.trangThai === "dadi" ? "ĐÃ ĐI" : "SẼ THỬ", x + w / 2, y + h / 2 - 6);
      c.font = "600 11px 'Be Vietnam Pro',sans-serif";
      c.fillText(r.trangThai === "dadi" ? "CÓ DẤU" : "CHỜ DẤU", x + w / 2, y + h / 2 + 17);
    }
    c.restore();
  }

  /* Mã QR vẽ từng ô, nét gọn ở mọi cỡ. */
  function veQR(c, chuoi, x, y, canh) {
    if (typeof qrcode !== "function") return false;
    /* Mức sửa lỗi càng cao thì mã càng nhiều ô, ô càng nhỏ càng khó quét.
       Thử M trước; nếu ô nhỏ hơn 3px thì hạ xuống L cho ô to ra. */
    function dung(muc) {
      try { var z = qrcode(0, muc); z.addData(chuoi); z.make(); return z; } catch (e) { return null; }
    }
    function oPx(z) { return Math.floor(canh / (z.getModuleCount() + 8)); }
    var q = dung("M");
    if (!q) return false;
    if (oPx(q) < 3) { var l = dung("L"); if (l && oPx(l) > oPx(q)) q = l; }
    /* Ô phải là số pixel NGUYÊN. Trước đây làm tròn lên nên ô to hơn lưới,
       các ô đè lên nhau và máy không đọc nổi mã. Viền trắng để đủ 4 ô
       theo chuẩn QR, thiếu viền thì điện thoại cũng chịu. */
    var n = q.getModuleCount(), vien = 4;
    var o = Math.max(1, Math.floor(canh / (n + vien * 2)));
    var thuc = o * (n + vien * 2);
    var lech = Math.round((canh - thuc) / 2);
    c.save();
    c.fillStyle = M.giay; duongBo(c, x - 6, y - 6, canh + 12, canh + 12, 5); c.fill();
    c.strokeStyle = M.muc; c.lineWidth = 1.2; c.globalAlpha = .55; c.stroke(); c.globalAlpha = 1;
    /* Nền trắng đặc dưới mã — giấy có vân, vân lẫn vào mã là hỏng. */
    c.fillStyle = "#ffffff";
    c.fillRect(x + lech, y + lech, thuc, thuc);
    c.fillStyle = "#000000";
    for (var r = 0; r < n; r++) for (var col = 0; col < n; col++) {
      if (q.isDark(r, col)) {
        c.fillRect(x + lech + (col + vien) * o, y + lech + (r + vien) * o, o, o);
      }
    }
    c.restore();
    return true;
  }

  /* ================= vẽ cả con tem ================= */

  function veTem(c, r, anh, opt) {
    opt = opt || {};
    var mon = opt.mon || "";                 // quay trúng món thì món đứng tên chính
    c.clearRect(0, 0, W, H);
    nenGiay(c);

    /* dải tiêu đề */
    c.fillStyle = M.muc; c.textAlign = "left"; c.textBaseline = "alphabetic";
    c.font = "600 15px 'Be Vietnam Pro',sans-serif";
    chuDan(c, "SỔ QUÁN ĂN · SÀI GÒN", 60, 84, 2.4);
    c.fillStyle = M.mucNhat; c.font = "500 13px 'Be Vietnam Pro',sans-serif";
    c.fillText(mon ? "Phiếu chọn món" : "Phiếu chọn quán", 60, 108);
    menhGia(c, r);

    /* ô ảnh */
    var ax = 58, ay = 150, aw = W - 116, ah = 392;
    c.save(); duongBo(c, ax, ay, aw, ah, 8); c.clip();
    if (anh) {
      var tl = Math.max(aw / anh.width, ah / anh.height);
      var nw = anh.width * tl, nh = anh.height * tl;
      c.drawImage(anh, ax + (aw - nw) / 2, ay + (ah - nh) / 2, nw, nh);
    } else {
      var g = c.createLinearGradient(ax, ay, ax + aw, ay + ah);
      g.addColorStop(0, "#2a3542"); g.addColorStop(1, "#45525f");
      c.fillStyle = g; c.fillRect(ax, ay, aw, ah);
      c.fillStyle = "rgba(244,239,227,.92)"; c.textAlign = "center";
      c.font = "800 54px 'Bricolage Grotesque','Be Vietnam Pro',sans-serif";
      c.fillText(r.loai || "Quán", ax + aw / 2, ay + ah / 2 + 6);
      c.font = "500 16px 'Be Vietnam Pro',sans-serif";
      c.fillStyle = "rgba(244,239,227,.6)";
      c.fillText("chưa có ảnh xác thực", ax + aw / 2, ay + ah / 2 + 38);
    }
    c.restore();
    c.strokeStyle = M.muc; c.globalAlpha = .5; c.lineWidth = 1.4;
    duongBo(c, ax, ay, aw, ah, 8); c.stroke(); c.globalAlpha = 1;

    dauBuuDien(c, W - 214, ay + ah - 124, opt.ngay || "01.01.26");

    /* ---- Nửa dưới dùng MỐC CỐ ĐỊNH, không chảy theo nhau ----
       Trước đây khối trên xếp theo dòng chảy còn khối dưới neo vào ô QR,
       nên tên quán dài hai dòng là hai bên đâm vào nhau, chữ đè chữ.
       Giờ mỗi khối có mốc riêng và bị cắt bớt nếu tràn.              */
    var Y_TEN = 600, Y_VACH = 762, Y_MON = 792, Y_SERI = 888;
    var QR_CANH = 186, qx = W - 60 - QR_CANH, qy = H - 60 - QR_CANH - 26;
    var RONG_TRAI = qx - 60 - 24;          /* chừa chỗ cho ô QR */

    c.textAlign = "left"; c.textBaseline = "alphabetic";
    c.font = "500 13px 'Be Vietnam Pro',sans-serif"; c.fillStyle = M.vang;
    chuDan(c, mon ? "MÓN ĐƯỢC CHỌN" : "QUÁN ĐƯỢC CHỌN", 60, Y_TEN, 2.2);

    var noi = [r.diaChi, r.khu].filter(Boolean).join(" · ") || "chưa ghi địa chỉ";
    var y = Y_TEN + 36;
    c.fillStyle = M.muc;

    if (mon) {
      /* Tên món thường dài hơn tên quán, nên cỡ chữ nhỏ hơn và địa chỉ
         được đẩy xuống ô cố định bên dưới — tránh tràn qua vạch ngăn. */
      c.font = "800 37px 'Bricolage Grotesque','Be Vietnam Pro',sans-serif";
      y += veChu(c, mon, 60, y, W - 120, 43, 2) * 43;
      c.font = "600 21px 'Be Vietnam Pro',sans-serif"; c.fillStyle = M.do;
      veChu(c, "tại " + r.ten, 60, y + 4, W - 120, 26, 1);
    } else {
      c.font = "800 44px 'Bricolage Grotesque','Be Vietnam Pro',sans-serif";
      y += veChu(c, r.ten, 60, y, W - 120, 50, 2) * 50;
      c.font = "400 16px 'Be Vietnam Pro',sans-serif"; c.fillStyle = M.mucNhat;
      var choCon = Math.floor((Y_VACH - 14 - (y + 6)) / 22);
      if (choCon >= 1) veChu(c, noi, 60, y + 6, W - 120, 22, Math.min(2, choCon));
    }

    /* vạch ngăn có hạt trám */
    c.strokeStyle = M.muc; c.globalAlpha = .28; c.lineWidth = 1;
    c.beginPath(); c.moveTo(60, Y_VACH); c.lineTo(W - 60, Y_VACH); c.stroke(); c.globalAlpha = 1;
    c.fillStyle = M.do;
    [0, 1, 2].forEach(function (i) {
      c.save(); c.translate(W / 2 + (i - 1) * 16, Y_VACH); c.rotate(Math.PI / 4);
      c.fillRect(-2.6, -2.6, 5.2, 5.2); c.restore();
    });

    /* món phải gọi — bề ngang bị chặn để không chui xuống dưới ô QR */
    c.font = "500 12px 'Be Vietnam Pro',sans-serif"; c.fillStyle = M.vang;
    chuDan(c, mon ? "ĐỊA CHỈ" : "MÓN PHẢI GỌI", 60, Y_MON, 2);
    c.font = "600 " + (mon ? 16 : 19) + "px 'Be Vietnam Pro',sans-serif"; c.fillStyle = M.muc;
    veChu(c, mon ? noi : (r.mon || "chưa ghi — lần tới nhớ ghi lại"),
          60, Y_MON + 27, RONG_TRAI, mon ? 21 : 23, 2);

    /* mã QR */
    var coQR = veQR(c, opt.link || "", qx, qy, QR_CANH);
    c.textAlign = "right"; c.fillStyle = M.mucNhat;
    c.font = "500 12px 'Be Vietnam Pro',sans-serif";
    if (coQR) c.fillText("quét để mở bản đồ", W - 60, qy + QR_CANH + 22);

    /* sê-ri và dấu ngày, cột trái dưới cùng */
    c.textAlign = "left";
    c.fillStyle = M.muc; c.font = "700 15px 'Be Vietnam Pro',sans-serif";
    c.fillText("No. " + opt.seri, 60, Y_SERI);
    c.fillStyle = M.mucNhat; c.font = "400 13px 'Be Vietnam Pro',sans-serif";
    c.fillText(opt.ngayDai || "", 60, Y_SERI + 24);
    var yc = Y_SERI + 48;
    if (r.canXacMinh) {
      c.fillStyle = M.vang; c.font = "600 12px 'Be Vietnam Pro',sans-serif";
      c.fillText("◆ chi nhánh chưa xác minh", 60, yc); yc += 22;
    }
    if ((r.tags || []).indexOf("Michelin") > -1) {
      c.fillStyle = M.do; c.font = "700 13px 'Be Vietnam Pro',sans-serif";
      c.fillText("★ MICHELIN GUIDE", 60, yc);
    }

    rangCua(c);
  }

  /* ================= dựng và gắn vào trang ================= */

  var oTem = null, canvasHienThi = null, quanHienTai = null, monHienTai = "";

  function soSeri(r) {
    var i = (window.items || []).findIndex(function (x) { return x.id === r.id; });
    return String((i < 0 ? 0 : i) + 1).padStart(4, "0");
  }
  function ngayNgan() {
    var d = new Date();
    return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getFullYear()).slice(2);
  }
  function ngayDai() {
    var d = new Date();
    return "Đóng dấu ngày " + String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
  }

  function taiAnh(r) {
    return new Promise(function (ok) {
      var p = window.restaurantPhotos && window.restaurantPhotos[r.id];
      if (!p || !p.files || !p.files[0]) return ok(null);
      var im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = function () { ok(null); };
      im.src = p.files[0];
    });
  }

  function khung() {
    if (oTem) return oTem;
    var neo = document.querySelector("#wheelResult");
    if (!neo) return null;
    oTem = document.createElement("div");
    oTem.className = "tem-khung";
    oTem.hidden = true;
    oTem.innerHTML =
      '<div class="tem-boc"><canvas class="tem-canvas" width="' + W + '" height="' + H + '" role="img"></canvas></div>' +
      '<div class="tem-nut">' +
        '<button type="button" class="btn tem-b" data-tem="hinh">Chép hình tem</button>' +
        '<button type="button" class="btn tem-b" data-tem="link">Chép link bản đồ</button>' +
        '<button type="button" class="btn tem-b" data-tem="tai">Tải tem về</button>' +
      '</div><p class="tem-bao" role="status"></p>';
    neo.parentNode.insertBefore(oTem, neo.nextSibling);
    canvasHienThi = $(".tem-canvas", oTem);
    oTem.addEventListener("click", bamNut);
    return oTem;
  }

  function bao(t) {
    var p = $(".tem-bao", oTem);
    if (p) { p.textContent = t; clearTimeout(p._h); p._h = setTimeout(function () { p.textContent = ""; }, 3200); }
  }

  /* Vẽ lại ở bội số cao rồi trả canvas — dùng cho chép và tải. */
  function temNetCao() {
    return taiAnh(quanHienTai).then(function (anh) {
      var cv = document.createElement("canvas");
      cv.width = W * 3; cv.height = H * 3;
      var c = cv.getContext("2d");
      c.scale(3, 3);
      veTem(c, quanHienTai, anh, thamSo());
      return cv;
    });
  }
  function thamSo() {
    return {
      mon: monHienTai,
      seri: soSeri(quanHienTai),
      ngay: ngayNgan(),
      ngayDai: ngayDai(),
      link: window.mapLink ? window.mapLink(quanHienTai) : ""
    };
  }

  function bamNut(e) {
    var b = e.target.closest("[data-tem]");
    if (!b || !quanHienTai) return;
    var viec = b.getAttribute("data-tem");

    if (viec === "link") {
      var u = window.mapLink ? window.mapLink(quanHienTai) : "";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(u).then(function () { bao("Đã chép link bản đồ."); },
          function () { chepTay(u); });
      } else chepTay(u);
      return;
    }

    b.disabled = true;
    temNetCao().then(function (cv) {
      /* Mở trang bằng file:// thì ảnh quán làm "nhiễm" canvas và trình duyệt
         chặn xuất. Trên bản web thật (cùng nguồn) thì không dính. */
      try { cv.getContext("2d").getImageData(0, 0, 1, 1); }
      catch (err) {
        bao("Trình duyệt chặn xuất ảnh ở chế độ mở file trực tiếp. Mở trang qua địa chỉ web rồi thử lại.");
        b.disabled = false; return;
      }
      if (viec === "tai") {
        cv.toBlob(function (bl) {
          var a = document.createElement("a");
          a.href = URL.createObjectURL(bl);
          a.download = "tem-" + quanHienTai.id + ".png";
          document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
          bao("Đã tải tem về máy.");
          b.disabled = false;
        }, "image/png");
        return;
      }
      /* chép hình */
      if (!(navigator.clipboard && window.ClipboardItem)) {
        bao("Trình duyệt không cho chép ảnh — đang tải về thay.");
        b.disabled = false;
        $("[data-tem='tai']", oTem).click();
        return;
      }
      cv.toBlob(function (bl) {
        navigator.clipboard.write([new ClipboardItem({ "image/png": bl })]).then(function () {
          bao("Đã chép hình tem — dán thẳng vào Zalo được.");
          b.disabled = false;
        }, function () {
          bao("Chép hình không được — đang tải về thay.");
          b.disabled = false;
          $("[data-tem='tai']", oTem).click();
        });
      }, "image/png");
    });
  }

  function chepTay(u) {
    var i = document.createElement("textarea");
    i.value = u; i.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(i); i.select();
    try { document.execCommand("copy"); bao("Đã chép link bản đồ."); }
    catch (e) { bao("Không chép được. Link: " + u); }
    i.remove();
  }

  /* ---------- hiện tem khi quay xong ---------- */
  function hienTem(r, mon) {
    if (!khung() || !r) return;
    quanHienTai = r; monHienTai = mon || "";
    var c = canvasHienThi.getContext("2d");
    canvasHienThi.setAttribute("aria-label",
      "Tem kết quả: " + (mon ? mon + " tại " + r.ten : r.ten) +
      (r.diaChi ? ", " + r.diaChi : "") + ".");
    Promise.resolve(document.fonts ? document.fonts.ready : null).then(function () {
      return taiAnh(r);
    }).then(function (anh) {
      veTem(c, r, anh, thamSo());
      oTem.hidden = false;
      oTem.classList.remove("tem-vao");
      void oTem.offsetWidth;
      oTem.classList.add("tem-vao");
    });
  }

  function timQuan(ten) {
    var ds = window.items || [];
    for (var i = 0; i < ds.length; i++) if (ds[i].ten.trim() === ten) return ds[i];
    for (var j = 0; j < ds.length; j++) if (ds[j].mon && ds[j].mon.trim() === ten) return ds[j];
    return null;
  }

  function theoDoi() {
    var o = document.querySelector("#wheelResult");
    if (!o || !window.MutationObserver) return;
    new MutationObserver(function () {
      var h = o.querySelector("h3");
      if (!h) { if (oTem) oTem.hidden = true; return; }
      var ten = h.textContent.trim();
      var w = window.wheelWinner;
      var r = (w && w.ten) ? w : timQuan(ten);
      if (!r) return;
      hienTem(r, (window.wheelMode === "dishes") ? ten : "");
    }).observe(o, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", theoDoi);
  else theoDoi();
})();
