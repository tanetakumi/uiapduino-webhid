/**
 * UIAPduino WebHID I/O client
 * Protocol: README.md (Communication protocol)
 */
'use strict';

export const VID = 0x1209;
export const PID = 0xd011;
export const FEATURE_SIZE = 32;
export const PROTO_VER = 0x02;

export const CMD = {
  OFF: 0x00,
  ON: 0x01,
  TOGGLE: 0x02,
  BLINK: 0x03,
  BLINK_STOP: 0x04,
};

export const BTN_EVT = {
  PRESSED: 0x01,
  RELEASED: 0x02,
};

let device = null;
let lastLedState = -1;
let lastBtnState = -1;

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

const btnConnect = $('btn-connect');
const btnDisconnect = $('btn-disconnect');
const btnOn = $('btn-on');
const btnOff = $('btn-off');
const btnToggle = $('btn-toggle');
const btnBlink = $('btn-blink');
const btnBlinkStop = $('btn-blink-stop');
const blinkMs = $('blink-ms');

function addLog(kind, msg) {
  const t = new Date().toTimeString().slice(0, 8);
  const row = document.createElement('div');
  row.className = 'log-entry';
  row.innerHTML = `<span class="${kind}">[${kind.toUpperCase()}]</span> ${t} ${msg}`;
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

function setControls(connected) {
  btnConnect.disabled = connected;
  btnDisconnect.disabled = !connected;
  for (const b of [btnOn, btnOff, btnToggle, btnBlink, btnBlinkStop, blinkMs]) {
    b.disabled = !connected;
  }
}

function setConnected(dev) {
  device = dev;
  lastLedState = -1;
  lastBtnState = -1;
  dot.classList.add('connected');
  statusText.textContent = `接続: ${dev.productName || 'UIAPduino'}`;
  setControls(true);
  addLog('sys', `接続 PID=${dev.productId?.toString(16)}`);
}

function setDisconnected() {
  device = null;
  lastLedState = -1;
  lastBtnState = -1;
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

function hex(arr) {
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

function onInputReport(e) {
  const { data } = e;
  const buf = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const ver = buf[1] ?? 0;

  if (ver < PROTO_VER) {
    addLog('sys', `警告: ファーム ver=0x${ver.toString(16)} — pin 9 入力には ver 0x02 以上が必要`);
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

addLog('sys', '準備完了 — localhost で開いてください');
