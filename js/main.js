/* =========================================================
   main.js：くじの処理・演出・管理画面
   ※ config.js の PRIZES などを使うので、config.js の後に読み込みます
   ========================================================= */

// よく使う「要素を探す」処理を短く書くための関数
const $ = (selector) => document.querySelector(selector);

/* ---------- データの保存と読み込み ---------- */

// 最初の状態（1日目・全部の玉が満タン）を作る
function createDefaultState() {
  const settings = {};   // 1日の個数
  const remaining = {};  // 現在の残り
  PRIZES.forEach(p => {
    settings[p.id] = p.count;
    remaining[p.id] = p.count;
  });
  return { day: 1, settings, remaining, history: [] };
}

// localStorage から前回の状態を読み込む（なければ最初の状態）
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const saved = JSON.parse(raw);
    const state = createDefaultState();
    PRIZES.forEach(p => {
      if (saved.settings && Number.isInteger(saved.settings[p.id])) state.settings[p.id] = saved.settings[p.id];
      if (saved.remaining && Number.isInteger(saved.remaining[p.id])) state.remaining[p.id] = saved.remaining[p.id];
    });
    state.day = saved.day || 1;
    state.history = Array.isArray(saved.history) ? saved.history : [];
    return state;
  } catch (e) {
    console.warn("読み込みに失敗したので初期状態で始めます", e);
    return createDefaultState();
  }
}

// 今の状態を localStorage に保存する
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("保存に失敗しました", e);
  }
}

let state = loadState();
let isDrawing = false;      // 抽選中かどうか（連打防止用）
let resultShownAt = 0;      // 結果を表示した時刻（すぐ閉じてしまうのを防ぐ）

/* ---------- くじを引く処理（箱方式） ---------- */

// 箱に残っている玉の合計
function totalRemaining() {
  return PRIZES.reduce((sum, p) => sum + state.remaining[p.id], 0);
}

// 残っている玉の中から1個をランダムに選ぶ
function drawPrize() {
  const total = totalRemaining();
  if (total <= 0) return null;
  // 0 ～ (total-1) の数をランダムに選ぶ
  let r = Math.floor(Math.random() * total);
  // 例：A=2, B=5 なら 0～1 がA賞、2～6 がB賞… のように割り当てる
  for (const p of PRIZES) {
    const n = state.remaining[p.id];
    if (r < n) return p;
    r -= n;
  }
  return null;
}

// 玉の見た目（光沢っぽいグラデーション）
function ballStyle(color) {
  return `radial-gradient(circle at 35% 30%, #ffffff 0%, ${color} 50%, ${color} 100%)`;
}

/* ---------- 画面の表示を更新 ---------- */

function renderRemaining() {
  const box = $("#remaining");
  box.innerHTML = "";
  PRIZES.forEach(p => {
    const n = state.remaining[p.id];
    // showRemaining が true で、まだ残っている賞だけ表示（0個になったら消える）
    if (p.showRemaining && n > 0) {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.style.setProperty("--c", p.color);
      chip.innerHTML = `<span class="dot"></span>${p.name} あと<b>${n}</b>個`;
      box.appendChild(chip);
    }
  });

  $("#dayLabel").textContent = `${state.day}日目`;

  const btn = $("#startBtn");
  if (totalRemaining() <= 0) {
    btn.disabled = true;
    btn.textContent = "本日の抽選は終了しました";
  } else if (!isDrawing) {
    btn.disabled = false;
    btn.textContent = "くじスタート";
  }
}

/* ---------- 抽選の流れ ---------- */

function startDraw() {
  if (isDrawing) return;                 // 抽選中なら何もしない
  if (!$("#adminOverlay").hidden) return; // 管理画面を開いているときも何もしない

  const prize = drawPrize();
  if (!prize) { renderRemaining(); return; }

  isDrawing = true;
  initSound(); // 音の準備（ブラウザのルールで、ボタンを押したタイミングで行う必要がある）

  // ★ 演出の前に結果を確定して保存する
  //   （演出中にページを再読み込みされても、引き直しができないようにするため）
  state.remaining[prize.id]--;
  state.history.push({ day: state.day, prize: prize.id, time: new Date().toISOString() });
  saveState();

  const btn = $("#startBtn");
  btn.disabled = true;
  btn.textContent = "抽選中…";

  // 溜め演出をするかどうか：A賞なら必ず、それ以外は GASE_RATE の確率で（ガセ演出）
  const isTame = prize.id === "A" || Math.random() < GASE_RATE;
  const spinMs = isTame ? TAME_SPIN_MS : SPIN_MS;

  // ガラポンを回す（クラスを付け直すとアニメーションが最初から再生される）
  const drum = $("#drum");
  drum.classList.remove("spin", "spin-tame");
  drum.getBoundingClientRect(); // ブラウザに一度描画させるおまじない
  drum.style.animationDuration = spinMs + "ms"; // 回転時間を config.js の値に合わせる
  drum.classList.add(isTame ? "spin-tame" : "spin");
  playRattle(spinMs, isTame); // カラカラ音

  // 溜めのときは、回転の途中から画面を暗くして「……！？」を出す
  if (isTame) {
    const tameStart = spinMs * 0.35;
    setTimeout(() => {
      $("#tame").classList.add("on");
      playTameRise(spinMs - tameStart); // 緊張感を高める音
    }, tameStart);
  }

  // 玉の色をセット
  const ball = $("#ball");
  ball.classList.remove("drop");
  ball.style.background = ballStyle(prize.color);

  // 回り終わったら玉が転がる → そのあと結果表示
  setTimeout(() => {
    ball.classList.add("drop");
    playDrop(); // コロン
  }, spinMs);
  setTimeout(() => showResult(prize), spinMs + DROP_MS + 200);
}

function showResult(prize) {
  const card = $("#resultCard");
  card.className = "result-card rank-" + prize.id;
  $("#resultBall").style.background = ballStyle(prize.color);
  $("#resultName").textContent = prize.name;
  $("#resultMsg").textContent = prize.message;
  $("#resultOverlay").hidden = false;
  $("#tame").classList.remove("on"); // 溜めの暗い画面を消す
  resultShownAt = Date.now();
  playResult(prize.id); // 賞ごとの効果音

  // 賞ごとの演出
  if (prize.id === "A") {
    flash();
    confettiBurst(260);
    setTimeout(() => confettiBurst(200), 700);
    setTimeout(() => confettiBurst(160), 1500);
  } else if (prize.id === "B") {
    confettiBurst(90);
  }
}

function closeResult() {
  if ($("#resultOverlay").hidden) return;
  if (Date.now() - resultShownAt < 800) return; // 表示直後の誤操作で閉じないように
  $("#resultOverlay").hidden = true;
  $("#ball").classList.remove("drop");
  isDrawing = false;
  renderRemaining(); // 結果を見せたあとで残り数を更新（先にネタバレしないように）
}

/* ---------- A賞の演出：フラッシュ ---------- */
function flash() {
  const el = $("#flash");
  el.classList.remove("on");
  el.getBoundingClientRect();
  el.classList.add("on");
}

/* ---------- A賞・B賞の演出：紙吹雪（ライブラリを使わず自作） ---------- */
const canvas = $("#confetti");
const ctx = canvas.getContext("2d");
let pieces = [];
let confettiRunning = false;
const CONFETTI_COLORS = ["#e9b949", "#c8102e", "#2e6fd8", "#2e9e5b", "#ffffff", "#ff8fab"];

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function confettiBurst(count) {
  for (let i = 0; i < count; i++) {
    pieces.push({
      x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.4,
      y: innerHeight * 0.5,
      vx: (Math.random() - 0.5) * 18,        // 横方向の速さ
      vy: -Math.random() * 18 - 8,           // 上方向の速さ（マイナスが上）
      w: 6 + Math.random() * 6,
      h: 10 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,       // 回転の速さ
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    });
  }
  if (!confettiRunning) {
    confettiRunning = true;
    requestAnimationFrame(tick);
  }
}

// 1コマごとに紙吹雪を動かして描く
function tick() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  pieces.forEach(p => {
    p.vy = Math.min(p.vy + 0.35, 4);  // 重力（落ちる速さに上限をつけてヒラヒラさせる）
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
    ctx.restore();
  });
  pieces = pieces.filter(p => p.y < innerHeight + 40); // 画面外に出たものは消す
  if (pieces.length > 0) {
    requestAnimationFrame(tick);
  } else {
    confettiRunning = false;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
  }
}

/* ---------- 管理画面 ---------- */

function openAdmin() {
  if (isDrawing) return; // 抽選中は開けない
  $("#adminOverlay").hidden = false;
  $("#adminMsg").textContent = "";
  if (ADMIN_PASSWORD === "") {
    showAdminBox();
  } else {
    $("#loginBox").hidden = false;
    $("#adminBox").hidden = true;
    $("#pwInput").value = "";
    $("#pwMsg").textContent = "";
    $("#pwInput").focus();
  }
}

function login() {
  if ($("#pwInput").value === ADMIN_PASSWORD) {
    showAdminBox();
  } else {
    $("#pwMsg").textContent = "パスワードが違います。";
  }
}

function showAdminBox() {
  $("#loginBox").hidden = true;
  $("#adminBox").hidden = false;
  renderAdmin();
}

function closeAdmin() {
  $("#adminOverlay").hidden = true;
}

// 管理画面の表を作る
function renderAdmin() {
  const todayCount = state.history.filter(h => h.day === state.day).length;
  $("#adminInfo").textContent =
    `現在 ${state.day}日目 ／ 本日の抽選回数 ${todayCount}回 ／ 箱の残り合計 ${totalRemaining()}個`;
  $("#nextDayBtn").textContent = `${state.day + 1}日目を開始（リセット）`;

  const rows = $("#adminRows");
  rows.innerHTML = "";
  PRIZES.forEach(p => {
    const won = state.history.filter(h => h.day === state.day && h.prize === p.id).length;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.name}</td>
      <td><input type="number" min="0" step="1" data-kind="settings" data-id="${p.id}" value="${state.settings[p.id]}"></td>
      <td><input type="number" min="0" step="1" data-kind="remaining" data-id="${p.id}" value="${state.remaining[p.id]}"></td>
      <td>${won}</td>`;
    rows.appendChild(tr);
  });
}

function showAdminMsg(text, ok) {
  const el = $("#adminMsg");
  el.textContent = text;
  el.className = "msg " + (ok ? "ok" : "err");
}

// 「変更を保存」
function saveAdmin() {
  const inputs = document.querySelectorAll("#adminRows input");
  const next = { settings: {}, remaining: {} };
  for (const input of inputs) {
    const value = Number(input.value);
    if (input.value === "" || !Number.isInteger(value) || value < 0) {
      showAdminMsg("個数は0以上の整数で入力してください。", false);
      input.focus();
      return;
    }
    next[input.dataset.kind][input.dataset.id] = value;
  }
  if (!confirm("この内容で保存しますか？")) return;
  state.settings = next.settings;
  state.remaining = next.remaining;
  saveState();
  renderAdmin();
  renderRemaining();
  showAdminMsg("保存しました。", true);
}

// 「次の日へリセット」
function nextDay() {
  const nextDayNum = state.day + 1;
  if (!confirm(`${nextDayNum}日目を開始します。\n残り数を「1日の個数」に戻します。よろしいですか？\n（入力中の変更がある場合は、先に「変更を保存」を押してください）`)) return;
  state.day = nextDayNum;
  state.remaining = { ...state.settings };
  saveState();
  renderAdmin();
  renderRemaining();
  showAdminMsg(`${nextDayNum}日目を開始しました。`, true);
}

// 「全データ初期化」
function initAll() {
  if (!confirm("すべてのデータ（日数・残り数・抽選履歴）を消して、最初の状態に戻します。\n本当によろしいですか？")) return;
  state = createDefaultState();
  saveState();
  renderAdmin();
  renderRemaining();
  showAdminMsg("初期化しました。", true);
}

/* ---------- ボタンやキーボードの操作を登録 ---------- */

$("#startBtn").addEventListener("click", () => {
  $("#startBtn").blur(); // フォーカスを外す（スペースキーでの二重反応を防ぐ）
  startDraw();
});
$("#resultOverlay").addEventListener("click", closeResult);
$("#adminBtn").addEventListener("click", openAdmin);
$("#loginBtn").addEventListener("click", login);
$("#pwInput").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
$("#saveBtn").addEventListener("click", saveAdmin);
$("#nextDayBtn").addEventListener("click", nextDay);
$("#initBtn").addEventListener("click", initAll);
document.querySelectorAll(".closeAdmin").forEach(b => b.addEventListener("click", closeAdmin));

document.addEventListener("keydown", e => {
  if (!$("#adminOverlay").hidden) {
    if (e.key === "Escape") closeAdmin();
    return; // 管理画面を開いているときはくじ操作をしない
  }
  if (e.code === "Space" || e.key === "Enter") {
    e.preventDefault();
    if (!$("#resultOverlay").hidden) closeResult();
    else startDraw();
  }
});

// 最初の表示
renderRemaining();
