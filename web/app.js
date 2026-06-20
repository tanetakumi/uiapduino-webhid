/**
 * UIAPduino WebHID I/O client
 * Protocol: README.md (Communication protocol)
 */
'use strict';

export const VID = 0x1209;
export const PID = 0xd011;
export const FEATURE_SIZE = 32;
export const PROTO_VER = 0x03;
export const BTN_MIN_VER = 0x02;
export const OLED_MIN_VER = 0x03;

export const CMD = {
  OFF: 0x00,
  ON: 0x01,
  TOGGLE: 0x02,
  BLINK: 0x03,
  BLINK_STOP: 0x04,
  OLED_CLEAR: 0x10,
  OLED_LINE: 0x11,
};

export const BTN_EVT = {
  PRESSED: 0x01,
  RELEASED: 0x02,
};

let device = null;
let lastLedState = -1;
let lastBtnState = -1;
let lastOledReady = null;
let firmwareVersion = 0;
let warnedOldButtonFirmware = false;
let warnedOldOledFirmware = false;

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

function setOledControls(enabled) {
  for (const control of [...oledInputs, ...btnOledSend, btnOledClear]) {
    control.disabled = !enabled;
  }
}

function setOledUi(ready, text) {
  oledStatusDot.classList.toggle('ready', ready);
  oledStatusText.textContent = text;
  setOledControls(Boolean(device) && ready);
}

function setControls(connected) {
  btnConnect.disabled = connected;
  btnDisconnect.disabled = !connected;
  for (const b of [btnOn, btnOff, btnToggle, btnBlink, btnBlinkStop, blinkMs]) {
    b.disabled = !connected;
  }
  if (!connected) setOledControls(false);
}

function setConnected(dev) {
  device = dev;
  lastLedState = -1;
  lastBtnState = -1;
  lastOledReady = null;
  firmwareVersion = 0;
  warnedOldButtonFirmware = false;
  warnedOldOledFirmware = false;
  dot.classList.add('connected');
  statusText.textContent = `接続: ${dev.productName || 'UIAPduino'}`;
  setControls(true);
  setOledUi(false, '状態確認中');
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
  setOledUi(false, '未接続');
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
  if (!device || firmwareVersion < OLED_MIN_VER || !lastOledReady) return;

  const text = sanitizeAscii(oledInputs[row].value);
  oledInputs[row].value = text;

  const data = buildReport(CMD.OLED_LINE, row);
  for (let i = 0; i < text.length; i++) {
    data[2 + i] = text.charCodeAt(i);
  }
  await device.sendFeatureReport(0, data);
  addLog('tx', `OLED line=${row} text="${text}"`);
}

function hex(arr) {
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join(' ');
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
    if (ver < OLED_MIN_VER) {
      setOledUi(false, '非対応ファームウェア');
    } else if (oledReady) {
      setOledUi(true, '表示可能');
      addLog('rx', 'OLED ready');
    } else {
      setOledUi(false, 'OLED未接続 / I2Cエラー');
      addLog('rx', 'OLED unavailable');
    }
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
btnOledClear.addEventListener('click', () => sendCmd(CMD.OLED_CLEAR));

addLog('sys', '準備完了 — localhost で開いてください');
