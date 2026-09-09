/* =========================================================
   宏文 G7 互联网 · 交互课堂 —— 共享引擎 common.js
   提供：小工具 / WebAudio 音效 / 彩带庆祝 / 轻提示 / 通用测验引擎
   零依赖纯原生；file:// 可直接打开，也可静态托管
   对外暴露：window.HW
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 小工具 ---------- */
  function el(id) { return document.getElementById(id); }
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function on(node, ev, fn) { if (node) node.addEventListener(ev, fn); }

  /* ---------- 音效（WebAudio 合成，无需音频文件） ---------- */
  var actx = null;
  function beep(type) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!actx) actx = new AC();
      if (actx.state === 'suspended') actx.resume();
      var t = actx.currentTime;
      var notes = { ok: [660, 880], no: [240, 170], win: [523, 659, 784, 1047], tap: [520, 520] };
      var seq = notes[type] || notes.tap;
      for (var i = 0; i < seq.length; i++) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = (type === 'no') ? 'sawtooth' : 'sine';
        o.connect(g); g.connect(actx.destination);
        var st = t + i * 0.11;
        o.frequency.setValueAtTime(seq[i], st);
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.09, st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.16);
        o.start(st); o.stop(st + 0.18);
      }
    } catch (e) { /* 音频不可用时静默 */ }
  }

  /* ---------- 彩带庆祝（纯 DOM，无库） ---------- */
  function confetti(count) {
    count = count || 90;
    var colors = ['#4F46E5', '#7C3AED', '#EC4899', '#F97316', '#10B981', '#FACC15', '#38BDF8'];
    var layer = document.createElement('div');
    layer.className = 'hw-confetti';
    document.body.appendChild(layer);
    for (var i = 0; i < count; i++) {
      var p = document.createElement('i');
      var s = rand(7, 13);
      p.style.background = colors[i % colors.length];
      p.style.left = rand(0, 100) + 'vw';
      p.style.width = s + 'px';
      p.style.height = (s * rand(0.5, 1.5)) + 'px';
      p.style.animationDelay = rand(0, 0.7) + 's';
      p.style.animationDuration = rand(1.9, 3.4) + 's';
      layer.appendChild(p);
    }
    setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 4200);
  }

  /* ---------- 轻提示 ---------- */
  function toast(msg, kind) {
    var t = document.createElement('div');
    t.className = 'hw-toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 16);
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, 2200);
  }

  /* ---------- 数字滚动（数据看板用） ---------- */
  function countUp(node, target, suffix, dur) {
    if (!node) return;
    suffix = suffix || '';
    dur = dur || 1200;
    var start = 0, t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = Math.round(start + (target - start) * eased);
      node.textContent = val.toLocaleString('zh-CN') + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- 选项键标签 ---------- */
  function keyLabel(i, type) {
    if (type === 'judge') return i === 0 ? '✓' : '✕';
    return String.fromCharCode(65 + i); // A B C D
  }

  /* =========================================================
     通用测验引擎
     questions: [
       { type:'single', q:'题干', options:['..','..'], answer:0, explain:'解析' },
       { type:'judge',  q:'题干', answer:0, explain:'解析' },        // 0=正确 1=错误
       { type:'blank',  q:'题干', answer:'答案', explain:'解析' }
     ]
     opts: { onFinish:function(score,total){}, perfectText:'..' }
     ========================================================= */
  function quiz(mount, questions, opts) {
    opts = opts || {};
    if (typeof mount === 'string') mount = el(mount);
    if (!mount || !questions || !questions.length) return;

    var score = 0, done = 0, total = questions.length;
    var html = '';
    questions.forEach(function (item, idx) {
      var type = item.type || 'single';
      html += '<div class="hw-q" data-idx="' + idx + '">';
      html += '<div class="hw-q-title"><span class="hw-q-no">' + (idx + 1) + '</span><span>' + item.q + '</span></div>';
      if (type === 'blank') {
        html += '<div class="hw-blank"><input type="text" placeholder="在这里输入你的答案…" /><button class="btn btn-primary hw-blank-go">提交</button></div>';
      } else {
        var options = item.options || (type === 'judge' ? ['正确', '错误'] : []);
        html += '<div class="hw-opts">';
        options.forEach(function (op, oi) {
          html += '<button class="hw-opt" data-oi="' + oi + '"><span class="hw-opt-key">' + keyLabel(oi, type) + '</span><span class="hw-opt-txt">' + op + '</span></button>';
        });
        html += '</div>';
      }
      html += '<div class="hw-fb"></div></div>';
    });
    html += '<div class="hw-quiz-result"></div>';
    mount.innerHTML = html;

    function reveal(qEl, item, correct, userLabel) {
      var fb = qEl.querySelector('.hw-fb');
      all('.hw-opt', qEl).forEach(function (b) { b.classList.add('locked'); });
      var inp = qEl.querySelector('input'); if (inp) inp.disabled = true;
      var go = qEl.querySelector('.hw-blank-go'); if (go) go.disabled = true;
      if (correct) {
        beep('ok');
        fb.innerHTML = '<span class="ok">✔ 答对啦！</span> ' + (item.explain || '');
      } else {
        beep('no');
        var rightLabel = (item.type === 'blank') ? item.answer : keyLabel(item.answer, item.type || 'single');
        fb.innerHTML = '<span class="no">✘ 再想想～</span> 正确答案：<b>' + rightLabel + '</b>。' + (item.explain || '');
      }
      fb.classList.add('show');
      done++;
      if (done === total) finish();
    }

    all('.hw-q', mount).forEach(function (qEl) {
      var idx = +qEl.getAttribute('data-idx');
      var item = questions[idx];
      var type = item.type || 'single';
      var answered = false;

      if (type === 'blank') {
        var input = qEl.querySelector('input');
        var go = qEl.querySelector('.hw-blank-go');
        var submit = function () {
          if (answered) return;
          var v = (input.value || '').replace(/\s/g, '').toLowerCase();
          var a = String(item.answer || '').replace(/\s/g, '').toLowerCase();
          if (!v) { toast('先写答案再提交哦～'); return; }
          answered = true;
          reveal(qEl, item, v === a, v);
        };
        on(go, 'click', submit);
        on(input, 'keydown', function (e) { if (e.key === 'Enter') submit(); });
      } else {
        all('.hw-opt', qEl).forEach(function (btn) {
          on(btn, 'click', function () {
            if (answered) return;
            answered = true;
            var oi = +btn.getAttribute('data-oi');
            var correct = (oi === item.answer);
            if (correct) { btn.classList.add('correct'); score++; }
            else {
              btn.classList.add('wrong');
              var right = qEl.querySelector('.hw-opt[data-oi="' + item.answer + '"]');
              if (right) right.classList.add('correct');
            }
            reveal(qEl, item, correct, oi);
          });
        });
      }
    });

    function finish() {
      var res = mount.querySelector('.hw-quiz-result');
      var pct = Math.round(score / total * 100);
      var perfect = opts.perfectText || '🎉 全对！太强了！';
      res.innerHTML = '<div class="hw-score">得分 <b>' + score + '</b> / ' + total + '　（' + pct + '%）</div>' +
        (pct === 100 ? '<div class="hw-perfect">' + perfect + '</div>' : '<div class="hw-again">错题看看解析，下次一定全对！💪</div>');
      res.classList.add('show');
      if (pct === 100) { confetti(130); beep('win'); }
      if (opts.onFinish) opts.onFinish(score, total);
    }
  }

  /* ---------- 对外暴露 ---------- */
  window.HW = {
    el: el, all: all, rand: rand, on: on,
    beep: beep, confetti: confetti, toast: toast,
    countUp: countUp, quiz: quiz, keyLabel: keyLabel
  };
})();
