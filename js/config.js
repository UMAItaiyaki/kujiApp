/* =========================================================
   config.js ★ 設定エリア ★
   ※ main.js より先に読み込む必要があります
   賞の名前・玉の色・1日の個数・メッセージはここを書き換えればOKです
   ========================================================= */
const PRIZES = [
  // id: 内部で使う名前 / name: 画面に出る名前 / color: 玉の色
  // count: 1日の個数 / showRemaining: 「あと○個」を表示するか / message: 結果のひとこと
  { id: "A", name: "A賞",   color: "#e9b949", count: 2,  showRemaining: true,  message: "大当たり！！おめでとうございます！" },
  { id: "B", name: "B賞",   color: "#c8102e", count: 5,  showRemaining: true,  message: "当たり！おめでとうございます！" },
  { id: "C", name: "C賞",   color: "#2e6fd8", count: 10, showRemaining: false, message: "当たり！おめでとうございます！" },
  { id: "D", name: "D賞",   color: "#2e9e5b", count: 30, showRemaining: false, message: "当たり！ありがとうございます！" },
  { id: "X", name: "ハズレ", color: "#ffffff", count: 0,  showRemaining: false, message: "残念…！また挑戦してね" },
];
const ADMIN_PASSWORD = "1234";          // 管理画面のパスワード（"" にするとパスワードなし）
const SPIN_MS = 2400;                   // ガラポンが回る時間（ミリ秒）
const DROP_MS = 1000;                   // 玉が転がる時間（ミリ秒）
const STORAGE_KEY = "fukubiki-state-v1"; // 保存データの名前

/* ========================================================= */
