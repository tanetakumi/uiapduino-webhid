/**
 * UIAPduino WebHID I/O client
 * Protocol: README.md (Communication protocol)
 */
'use strict';

export const VID = 0x1209;
export const PID = 0xd011;
export const FEATURE_SIZE = 32;
export const PROTO_VER = 0x04;
export const BTN_MIN_VER = 0x02;
export const OLED_MIN_VER = 0x03;
export const OLED_REINIT_MIN_VER = 0x04;

export const CMD = {
  OFF: 0x00,
  ON: 0x01,
  TOGGLE: 0x02,
  BLINK: 0x03,
  BLINK_STOP: 0x04,
  OLED_CLEAR: 0x10,
  OLED_LINE: 0x11,
  OLED_REINIT: 0x12,
};

export const BTN_EVT = {
  PRESSED: 0x01,
  RELEASED: 0x02,
};

const STORAGE_LINES = 'uiapduino-oled-lines';
const STORAGE_AUTO_RESYNC = 'uiapduino-oled-auto-resync';

let device = null;
let lastLedState = -1;
let lastBtnState = -1;
let lastOledReady = null;
let firmwareVersion = 0;
let oledSynced = true;
let resyncInFlight = false;
let warnedOldButtonFirmware = false;
let warnedOldOledFirmware = false;
let warnedOldReinitFirmware = false;

const MAX_LOG_LINES = 80;

const $ = (id) => document.getElementById(id);
const dot = $('status-dot');
const statusText = $('status-text');
const logEl = $('log');
const ledVisual = $('led-visual');
const ledLabel = $('led-label');
const btnVisual = $('btn-visual');
const btnLabel = $('btn-label');
const btnChanged = $('btn-changed');
const oledStatusDot = $('oled-status-dot');
const oledStatusText = $('oled-status-text');

const btnConnect = $('btn-connect');
const btnDisconnect = $('btn-disconnect');
const btnOn = $('btn-on');
const btnOff = $('btn-off');
const btnToggle = $('btn-toggle');
const btnBlink = $('btn-blink');
const btnBlinkStop = $('btn-blink-stop');
const blinkMs = $('blink-ms');
const btnOledClear = $('btn-oled-clear');
const btnOledResendAll = $('btn-oled-resend-all');
const btnOledReinit = $('btn-oled-reinit');
const oledAutoResync = $('oled-auto-resync');
const oledInputs = [0, 1, 2, 3].map((row) => $(`oled-line-${row}`));
const btnOledSend = [...document.querySelectorAll('.btn-oled-send')];

function addLog(kind, msg) {
  const t = new Date().toTimeString().slice(0, 8);
  const row = document.createElement('div');
  const badge = document.createElement('span');
  row.className = 'log-entry';
  badge.className = kind;
  badge.textContent = `[${kind.toUpperCase()}]`;
  row.append(badge, ` ${t} ${msg}`);
  logEl.appendChild(row);
  while (logEl.children.length > MAX_LOG_LINES) {
    logEl.removeChild(logEl.firstChild);
  }
  logEl.scrollTop = logEl.scrollHeight;
}

function setLedUi(on) {
  ledVisual.classList.toggle('on', on);
  ledVisual.classList.toggle('off', !on);
  ledLabel.textContent = on ? 'ON' : 'OFF';
}

function setBtnUi(pressed) {
  btnVisual.classList.toggle('pressed', pressed);
  btnVisual.classList.toggle('open', !pressed);
  btnLabel.textContent = pressed ? '押下' : '開放';
  btnChanged.textContent = `最終変化: ${new Date().toLocaleTimeString()}`;
}

function saveOledDraft() {
  try {
    localStorage.setItem(STORAGE_LINES, JSON.stringify(oledInputs.map((el) => el.value)));
  } catch {
    /* ignore quota / private mode */
  }
}

function loadOledDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_LINES);
    if (!raw) return;
    const lines = JSON.parse(raw);
    if (!Array.isArray(lines)) return;
    for (let row = 0; row < oledInputs.length; row++) {
      if (typeof lines[row] === 'string') {
        oledInputs[row].value = lines[row].slice(0, 16);
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
}

function markOledUnsynced() {
  if (!oledSynced) return;
  oledSynced = false;
  refreshOledStatusLabel();
}

function setOledSendControls(enabled) {
  for (const button of btnOledSend) {
    button.disabled = !enabled;
  }
  btnOledClear.disabled = !enabled;
  btnOledResendAll.disabled = !enabled;
}

function setOledReinitControl(enabled) {
  btnOledReinit.disabled = !enabled;
}

function refreshOledStatusLabel() {
  oledStatusDot.classList.remove('ready', 'unsynced');

  if (!device) {
    oledStatusText.textContent = '未接続';
    setOledSendControls(false);
    setOledReinitControl(false);
    return;
  }

  if (firmwareVersion > 0 && firmwareVersion < OLED_MIN_VER) {
    oledStatusText.textContent = '非対応ファームウェア';
    setOledSendControls(false);
    setOledReinitControl(false);
    return;
  }

  if (lastOledReady === null) {
    oledStatusText.textContent = '状態確認中';
    setOledSendControls(false);
    setOledReinitControl(false);
    return;
  }

  if (!lastOledReady) {
    oledStatusText.textContent = 'OLED未接続 / I2Cエラー';
    setOledSendControls(false);
    const canReinit = firmwareVersion >= OLED_REINIT_MIN_VER;
    setOledReinitControl(canReinit);
    return;
  }

  oledStatusDot.classList.add('ready');
  if (!oledSynced) {
    oledStatusDot.classList.add('unsynced');
    oledStatusText.textContent = '表示可能（未同期）';
  } else {
    oledStatusText.textContent = '表示可能';
  }
  setOledSendControls(true);
  setOledReinitControl(false);
}

function setControls(connected) {
  btnConnect.disabled = connected;
  btnDisconnect.disabled = !connected;
  for (const b of [btnOn, btnOff, btnToggle, btnBlink, btnBlinkStop, blinkMs]) {
    b.disabled = !connected;
  }
  refreshOledStatusLabel();
}

function setConnected(dev) {
  device = dev;
  lastLedState = -1;
  lastBtnState = -1;
  lastOledReady = null;
  firmwareVersion = 0;
  oledSynced = false;
  warnedOldButtonFirmware = false;
  warnedOldOledFirmware = false;
  warnedOldReinitFirmware = false;
  dot.classList.add('connected');
  statusText.textContent = `接続: ${dev.productName || 'UIAPduino'}`;
  setControls(true);
  addLog('sys', `接続 PID=${dev.productId?.toString(16)}`);
}

function setDisconnected() {
  device = null;
  lastLedState = -1;
  lastBtnState = -1;
  lastOledReady = null;
  firmwareVersion = 0;
  dot.classList.remove('connected');
  statusText.textContent = '未接続';
  setControls(false);
  setLedUi(false);
  setBtnUi(false);
  btnChanged.textContent = '—';
  addLog('sys', '切断');
}

function buildReport(cmd, arg1 = 0) {
  const data = new Uint8Array(FEATURE_SIZE);
  data[0] = cmd;
  data[1] = arg1;
  return data;
}

async function sendCmd(cmd, arg1 = 0) {
  if (!device) return;
  const data = buildReport(cmd, arg1);
  await device.sendFeatureReport(0, data);
  addLog('tx', `cmd=0x${cmd.toString(16).padStart(2, '0')} arg=${arg1} ${hex(data.slice(0, 4))}…`);
}

function sanitizeAscii(text) {
  return [...text]
    .slice(0, 16)
    .map((c) => {
      const code = c.charCodeAt(0);
      return code >= 0x20 && code <= 0x7e ? c : ' ';
    })
    .join('');
}

async function sendOledLine(row) {
  if (!device || firmwareVersion < OLED_MIN_VER || !lastOledReady) return false;

  const text = sanitizeAscii(oledInputs[row].value);
  oledInputs[row].value = text;
  saveOledDraft();

  const data = buildReport(CMD.OLED_LINE, row);
  for (let i = 0; i < text.length; i++) {
    data[2 + i] = text.charCodeAt(i);
  }
  await device.sendFeatureReport(0, data);
  addLog('tx', `OLED line=${row} text="${text}"`);
  return true;
}

async function sendAllOledLines({ reason = '全行を再送信' } = {}) {
  if (!device || firmwareVersion < OLED_MIN_VER || !lastOledReady || resyncInFlight) {
    return false;
  }

  resyncInFlight = true;
  try {
    for (let row = 0; row < oledInputs.length; row++) {
      const ok = await sendOledLine(row);
      if (!ok) return false;
    }
    oledSynced = true;
    refreshOledStatusLabel();
    addLog('sys', `OLED ${reason}`);
    return true;
  } finally {
    resyncInFlight = false;
  }
}

async function requestOledReinit() {
  if (!device || firmwareVersion < OLED_REINIT_MIN_VER) return;

  lastOledReady = null;
  refreshOledStatusLabel();
  oledStatusText.textContent = '再検出中…';
  setOledReinitControl(false);

  await sendCmd(CMD.OLED_REINIT);
  addLog('sys', 'OLED 再検出を要求');
}

function hex(arr) {
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

async function onOledReadyChanged(oledReady, ver) {
  if (ver < OLED_MIN_VER) {
    refreshOledStatusLabel();
    return;
  }

  if (oledReady) {
    addLog('rx', 'OLED ready');
    if (oledAutoResync.checked) {
      await sendAllOledLines({ reason: '再接続時に自動再送信' });
    } else {
      oledSynced = false;
      refreshOledStatusLabel();
    }
    return;
  }

  addLog('rx', 'OLED unavailable');
  if (ver < OLED_REINIT_MIN_VER && !warnedOldReinitFirmware) {
    warnedOldReinitFirmware = true;
    addLog('sys', 'ヒント: OLED再検出にはファーム ver 0x04 以上が必要（再ビルド・書き込み）');
  }
  refreshOledStatusLabel();
}

function onInputReport(e) {
  const { data } = e;
  const buf = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const ver = buf[1] ?? 0;
  firmwareVersion = ver;

  if (ver < BTN_MIN_VER && !warnedOldButtonFirmware) {
    warnedOldButtonFirmware = true;
    addLog('sys', `警告: ファーム ver=0x${ver.toString(16)} — pin 9 入力には ver 0x02 以上が必要`);
  }
  if (ver < OLED_MIN_VER && !warnedOldOledFirmware) {
    warnedOldOledFirmware = true;
    addLog('sys', `警告: OLEDにはファーム ver 0x${OLED_MIN_VER.toString(16)} 以上が必要`);
  }

  const ledState = buf[0] & 1;
  if (ledState !== lastLedState) {
    lastLedState = ledState;
    setLedUi(ledState === 1);
    addLog('rx', `LED ${ledState ? 'ON' : 'OFF'} ver=0x${ver.toString(16)}`);
  }

  const btnState = buf[2] & 1;
  const events = buf[3] ?? 0;

  if (events & BTN_EVT.PRESSED) {
    addLog('rx', 'pin9 PRESSED');
  }
  if (events & BTN_EVT.RELEASED) {
    addLog('rx', 'pin9 RELEASED');
  }

  if (btnState !== lastBtnState) {
    lastBtnState = btnState;
    setBtnUi(btnState === 1);
    if (!events) {
      addLog('rx', `pin9 ${btnState ? '押下' : '開放'}`);
    }
  }

  const oledReady = ver >= OLED_MIN_VER && (buf[4] & 1) === 1;
  if (oledReady !== lastOledReady) {
    lastOledReady = oledReady;
    void onOledReadyChanged(oledReady, ver);
  }
}

async function connect() {
  try {
    const list = await navigator.hid.requestDevice({
      filters: [{ vendorId: VID, productId: PID, usagePage: 0xff00, usage: 0x01 }],
    });
    if (!list.length) {
      addLog('sys', 'デバイス未選択');
      return;
    }
    const dev = list[0];
    if (dev.opened) await dev.close();
    await dev.open();
    dev.addEventListener('inputreport', onInputReport);
    setConnected(dev);
  } catch (err) {
    addLog('sys', `接続失敗: ${err.message}`);
  }
}

async function disconnect() {
  if (!device) return;
  device.removeEventListener('inputreport', onInputReport);
  await device.close();
  setDisconnected();
}

if (!navigator.hid) {
  $('browser-warn').hidden = false;
  btnConnect.disabled = true;
} else {
  navigator.hid.addEventListener('disconnect', (e) => {
    if (device && e.device === device) setDisconnected();
  });
}

oledAutoResync.checked = localStorage.getItem(STORAGE_AUTO_RESYNC) !== 'false';
oledAutoResync.addEventListener('change', () => {
  localStorage.setItem(STORAGE_AUTO_RESYNC, oledAutoResync.checked ? 'true' : 'false');
});

for (const input of oledInputs) {
  input.addEventListener('input', () => {
    saveOledDraft();
    markOledUnsynced();
  });
}

loadOledDraft();

btnConnect.addEventListener('click', () => connect());
btnDisconnect.addEventListener('click', () => disconnect());
btnOn.addEventListener('click', () => sendCmd(CMD.ON));
btnOff.addEventListener('click', () => sendCmd(CMD.OFF));
btnToggle.addEventListener('click', () => sendCmd(CMD.TOGGLE));
btnBlink.addEventListener('click', () => {
  const n = Math.min(50, Math.max(1, parseInt(blinkMs.value, 10) || 5));
  sendCmd(CMD.BLINK, n);
});
btnBlinkStop.addEventListener('click', () => sendCmd(CMD.BLINK_STOP));
for (const button of btnOledSend) {
  button.addEventListener('click', () => {
    sendOledLine(Number(button.dataset.row));
  });
}
btnOledClear.addEventListener('click', async () => {
  await sendCmd(CMD.OLED_CLEAR);
  for (const input of oledInputs) {
    input.value = '';
  }
  saveOledDraft();
  oledSynced = true;
  refreshOledStatusLabel();
});
btnOledResendAll.addEventListener('click', () => sendAllOledLines());
btnOledReinit.addEventListener('click', () => requestOledReinit());

addLog('sys', '準備完了 — localhost で開いてください');
