/* ============================================================
   animations.js — phần chuyển động cần JavaScript
   ------------------------------------------------------------
   Viết phòng thủ: mọi thứ đều kiểm tra null trước khi chạm.
   Hỏng file này thì trang vẫn chạy y như cũ, chỉ mất hiệu ứng.
   Ai bật "giảm chuyển động" thì bỏ qua toàn bộ phần trang trí.
   ============================================================ */
(function () {
  "use strict";

  var goc = document.documentElement;
  var yen = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Bật mọi hiệu ứng xuất hiện. Không có JS thì trang vẫn hiện đủ. */
  goc.classList.add("anim-ready");
  if (yen) return;

  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

  /* --- 1. Thẻ quán xuất hiện so le: gán --i theo thứ tự --- */
  function danhSoThe() {
    $$(".quan").forEach(function (el, i) {
      el.style.setProperty("--i", i % 12); // cuộn xa thì thôi trễ, khỏi chờ lâu
    });
  }
  danhSoThe();
  var luoi = $("#grid");
  if (luoi && window.MutationObserver) {
    new MutationObserver(danhSoThe).observe(luoi, { childList: true });
  }

  /* --- 1b. Nhãn Michelin: cho nó ánh lên một vệt --- */
  function danhDauMichelin() {
    $$(".chip, .tags span").forEach(function (el) {
      if (/michelin/i.test(el.textContent)) el.classList.add("michelin");
    });
  }
  danhDauMichelin();
  if (luoi && window.MutationObserver) {
    new MutationObserver(danhDauMichelin).observe(luoi, { childList: true });
  }

  var hop = document.querySelector('dialog');
  if (hop && window.MutationObserver) {
    new MutationObserver(danhDauMichelin).observe(hop, { childList: true, subtree: true });
  }

  /* --- 2. Vạch tiến độ cuộn (dự phòng cho trình duyệt chưa có scroll timeline) --- */
  var vach = document.createElement("div");
  vach.id = "scrollProgress";
  document.body.appendChild(vach);
  var coTimeline = CSS && CSS.supports && CSS.supports("animation-timeline: scroll()");
  if (!coTimeline) {
    var dangCho = false;
    window.addEventListener("scroll", function () {
      if (dangCho) return;
      dangCho = true;
      requestAnimationFrame(function () {
        var h = document.body.scrollHeight - window.innerHeight;
        vach.style.transform = "scaleX(" + (h > 0 ? window.scrollY / h : 0) + ")";
        dangCho = false;
      });
    }, { passive: true });
  }

  /* --- 3. Thanh lọc dính: thu gọn lại khi rời khỏi đỉnh trang --- */
  var thanh = document.querySelector(".bar");
  if (thanh && window.IntersectionObserver) {
    var moc = document.createElement("div");
    moc.style.cssText = "position:absolute;top:0;height:1px;width:1px";
    document.body.insertBefore(moc, document.body.firstChild);
    new IntersectionObserver(function (e) {
      thanh.classList.toggle("stuck", !e[0].isIntersecting);
    }).observe(moc);
  }

  /* --- 4. Vòng quay: đánh dấu từng chặng để CSS bắt --- */
  var san = document.querySelector(".wheel-stage");
  var nutQuay = $("#spinButton");
  var oKetQua = $("#wheelResult");

  if (san && nutQuay) {
    nutQuay.addEventListener("click", function () {
      if (san.classList.contains("spinning")) return;
      san.classList.remove("settled");
      san.classList.add("starting");
      setTimeout(function () {
        san.classList.remove("starting");
        san.classList.add("spinning");
      }, 260);
    });
  }

  if (san && oKetQua && window.MutationObserver) {
    new MutationObserver(function () {
      if (!oKetQua.textContent.trim()) return;
      san.classList.remove("spinning", "starting");
      san.classList.add("settled");
      banGiay();
      setTimeout(function () { san.classList.remove("settled"); }, 1200);
    }).observe(oKetQua, { childList: true, subtree: true, characterData: true });
  }

  /* --- 4b. Tiết kiệm khung hình -------------------------------
     Hiệu ứng chạy ngoài tầm mắt vẫn ngốn CPU như thường. Thứ gì
     cuộn khỏi màn hình thì cho dừng, cuộn tới thì chạy lại; tab bị
     ẩn thì dừng tất. Mặc định không dừng gì, nên hỏng script là trang
     trở về y như cũ chứ không mất hiệu ứng.                        */
  if (window.IntersectionObserver) {
    var canhChung = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        e.target.classList.toggle("ngoai-man", !e.isIntersecting);
      });
    }, { rootMargin: "180px 0px" });

    function theoDoiTam() {
      $$("section, .quan, .wheel-stage, .categories, footer, header.top, .announcement")
        .forEach(function (el) {
          if (el.dataset.dangCanh) return;
          el.dataset.dangCanh = "1";
          canhChung.observe(el);
        });
    }
    theoDoiTam();
    if (luoi) new MutationObserver(theoDoiTam).observe(luoi, { childList: true });
  }

  document.addEventListener("visibilitychange", function () {
    goc.classList.toggle("tab-an", document.hidden);
  });

  /* --- 5. Bắn giấy màu khi chốt được quán --- */
  var mau = ["#b9112c", "#8c6116", "#1a6b4e", "#365e70", "#965025", "#74466c"];
  function banGiay() {
    var n = window.innerWidth < 560 ? 16 : 28;
    for (var i = 0; i < n; i++) {
      (function (i) {
        var m = document.createElement("span");
        m.className = "confetti";
        m.style.background = mau[i % mau.length];
        m.style.left = (8 + Math.random() * 84) + "vw";
        m.style.animationDelay = (Math.random() * 260) + "ms";
        m.style.animationDuration = (1500 + Math.random() * 700) + "ms";
        m.appendChild(document.createElement("i"));
        document.body.appendChild(m);
        setTimeout(function () { m.remove(); }, 2800);
      })(i);
    }
  }

  /* --- 6. Thẻ vừa trúng vòng quay thì nháy viền một nhịp --- */
  if (oKetQua && window.MutationObserver) {
    new MutationObserver(function () {
      var ten = oKetQua.querySelector("h3");
      if (!ten) return;
      var can = ten.textContent.trim();
      $$(".quan").forEach(function (el) {
        var t = el.querySelector(".ten");
        if (t && t.textContent.trim() === can) {
          el.classList.add("celebration");
          setTimeout(function () { el.classList.remove("celebration"); }, 2900);
        }
      });
    }).observe(oKetQua, { childList: true, subtree: true });
  }
})();
