/* =========================================================
    sound.js：効果音
    Web Audio API を使って、音声ファイルなしでプログラムから音を作ります
    ※ config.js の SOUND_ENABLED / SOUND_VOLUME を使うので、config.js の後に読み込みます
   ========================================================= */

let audioCtx = null;    // 音を作るための「スタジオ」のようなもの
let masterGain = null;  // 全体の音量つまみ
let noiseBuffer = null; // カラカラ音の元になる「ザッ」というノイズ

// 音の準備（くじスタートを押したときに main.js から呼ばれる）
function initSound() {
  if (!SOUND_ENABLED) return;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // 古いブラウザなど、対応していない場合は音なしで動かす
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = SOUND_VOLUME;
    masterGain.connect(audioCtx.destination); // destination = スピーカー
  }
  // ブラウザが音を一時停止させている場合は再開する
  if (audioCtx.state === "suspended") audioCtx.resume();
}

// 音を鳴らせる状態かどうか
function canPlay() {
  return SOUND_ENABLED && audioCtx !== null;
}

/* ---------- 部品：音を1つ鳴らす関数 ---------- */

// 「ピー」のような単音を鳴らす
//   freq: 音の高さ(Hz) / start: 鳴らし始める時刻 / duration: 長さ(秒)
//   type: 音色（sine=やわらかい, triangle=木琴っぽい, square=ファミコンっぽい, sawtooth=ラッパっぽい）
//   volume: 音量 / freqEnd: 指定すると、鳴っている間に音の高さが変わる
function playTone(freq, start, duration, type = "sine", volume = 0.3, freqEnd = null) {
  const osc = audioCtx.createOscillator(); // 発振器（音の元）
  const gain = audioCtx.createGain();      // この音だけの音量つまみ
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);

  // 音量の変化：一瞬で大きくして、だんだん小さくする（プツッというノイズを防ぐ）
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain).connect(masterGain);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// カラカラ音の「カチッ」1回分を鳴らす
function playClick(start, volume) {
  // ノイズは最初の1回だけ作って使い回す
  if (!noiseBuffer) {
    const length = Math.floor(audioCtx.sampleRate * 0.05); // 0.05秒分
    noiseBuffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length); // ランダムな波をだんだん小さく
    }
  }
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuffer;
  // フィルターで高い音だけ残すと、玉がぶつかる「カチッ」っぽくなる
  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2500 + Math.random() * 1500; // 毎回少し音の高さを変えて自然に
  filter.Q.value = 3;
  const gain = audioCtx.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(masterGain);
  src.start(start);
}

/* ---------- 演出ごとの効果音 ---------- */

// ガラポンが回っている間の「カラカラ…」
//   回転がゆっくりになるにつれて、カチッの間隔を広げる
function playRattle(durationMs, isTame) {
  if (!canPlay()) return;
  const now = audioCtx.currentTime;
  const duration = durationMs / 1000;
  let t = 0;
  while (t < duration) {
    const progress = t / duration; // 0（回り始め）→ 1（止まる）
    let interval = 0.04 + progress * progress * 0.25;
    // 溜めのときは後半ぐっと間隔を広げて「カラ…カラ……」とじらす
    if (isTame && progress > 0.6) interval = 0.2 + (progress - 0.6) * 0.9;
    playClick(now + t, 0.6 * (1 - progress * 0.5));
    t += interval * (0.7 + Math.random() * 0.6); // 間隔を少しバラつかせる
  }
}

// 溜め演出中の、だんだん高くなる「ウゥゥ…」という緊張感の音
function playTameRise(durationMs) {
  if (!canPlay()) return;
  const now = audioCtx.currentTime;
  playTone(180, now, durationMs / 1000, "sawtooth", 0.05, 520);
  playTone(90, now, durationMs / 1000, "sine", 0.12, 260);
}

// 玉が転がり出たときの「コロン」
function playDrop() {
  if (!canPlay()) return;
  const now = audioCtx.currentTime;
  playTone(900, now, 0.12, "triangle", 0.4, 450);
  playTone(700, now + 0.16, 0.1, "triangle", 0.25, 380);
}

// 結果表示のときの音（賞ごとに変える）
function playResult(prizeId) {
  if (!canPlay()) return;
  const now = audioCtx.currentTime;

  if (prizeId === "A") {
    // ファンファーレ「パッ・パ・パ・パー！」＋和音
    playTone(523, now,        0.12, "square", 0.12);
    playTone(523, now + 0.14, 0.08, "square", 0.12);
    playTone(523, now + 0.24, 0.08, "square", 0.12);
    playTone(784, now + 0.34, 0.45, "square", 0.14);
    [523, 659, 784, 1047].forEach(f => {       // ド・ミ・ソ・ド の和音
      playTone(f, now + 0.85, 1.4, "sawtooth", 0.06);
    });
  } else if (prizeId === "B") {
    // キラキラ（高い音が上がっていく）
    [1319, 1568, 1976, 2637].forEach((f, i) => {
      playTone(f, now + i * 0.08, 0.4, "sine", 0.2);
    });
  } else if (prizeId === "C" || prizeId === "D") {
    // ピンポン
    playTone(880, now, 0.3, "sine", 0.3);
    playTone(698, now + 0.25, 0.5, "sine", 0.3);
  } else {
    // ハズレ：控えめに下がる音
    playTone(392, now, 0.25, "triangle", 0.25, 330);
    playTone(330, now + 0.28, 0.5, "triangle", 0.25, 220);
  }
}
