# UIAPduino WebHID

[UIAPduino Pro Micro CH32V003 V1.4](https://www.uiap.jp/en/uiapduino/pro-micro/ch32v003/v1dot4) 向けの **WebHID I/O** サンプルです。

- **LED 出力**: pin 2 (PC0) の ON / OFF / 点滅
- **GPIO 入力**: pin 9 (PC7) の GND ショート（ボタン押下）検知
- **OLED 出力**: SSD1306 I2C OLED へ4行のASCIIテキストを表示

| 層 | 技術 |
|----|------|
| ファームウェア | [ch32fun](https://github.com/cnlohr/ch32fun) + [rv003usb](https://github.com/cnlohr/rv003usb)（C、Arduino IDE 不要） |
| Web UI | 静的 HTML / JS / CSS（ビルド不要） |
| 開発環境 | **WSL**（clone・編集・ビルド・Web 配信） |
| 書き込み・USB 操作 | **Windows Chrome**（Web Flasher・WebHID） |

tarosay 氏の Arduino ボードパッケージ（UIAP_HID）は **使用しません**。

---

## 必要なもの

- **UIAPduino Pro Micro CH32V003 V1.4**（工場出荷の rv003usb 系ブートローダー入り）
- **WSL2**（Ubuntu 等）— ビルドと git
- **Windows の Chrome または Edge** — ファーム書き込みと WebHID（WSL 内ブラウザでは USB に触れません）
- （ボタンテスト用）pin 9 と GND を接続するボタン、またはジャンパ線
- （OLED表示用・任意）SSD1306 128×64 I2C OLED

---

## クイックスタート

### 1. 取得とビルド（WSL）

```bash
git clone https://github.com/tanetakumi/uiapduino-webhid.git
cd uiapduino-webhid

chmod +x scripts/*.sh
./scripts/setup-wsl.sh       # external/ に ch32fun / rv003usb を clone、apt パッケージ
./scripts/build-firmware.sh  # → firmware/webhid/webhid.bin
```

`setup-wsl.sh` は `sudo` で次を入れます: `make`, `gcc-riscv64-unknown-elf`, `binutils-riscv64-unknown-elf`, `picolibc-riscv64-unknown-elf`, `python3`。

### 2. 書き込み（Windows Chrome）

1. UIAPduino を **書き込み待機モード** にする（デバイスマネージャーで `VID_1209&PID_B803`）
2. [UIAP Web Flasher](https://yuukiumeta-uiap.github.io/rv003usb-webflasher/example.html) を開く
3. **Choose File** → `firmware/webhid/webhid.bin`
4. **Flash! (pick rv003usb)**
5. USB を **抜き差し** → 通常モード（PID `D011`）

書き込み待機モードの入り方は [UIAPduino V1.4 公式マニュアル](https://www.uiap.jp/en/uiapduino/pro-micro/ch32v003/v1dot4) を参照してください。

### 3. Web UI テスト（WSL + Windows Chrome）

```bash
./scripts/serve-web.sh   # http://localhost:8080 で web/ を配信
```

Windows Chrome で http://localhost:8080 を開き、**UIAPduino に接続** → LED **ON** / **OFF**、pin 9 を GND にショートしてボタン表示を確認。OLED接続時は4行のテキスト送信も利用できます。

`web/` は静的サイトです。Python は `localhost` を立てるための便宜上の手段で、`npx serve web` や GitHub Pages（HTTPS）でも動作します。`file://` での直接開きは非推奨です。

### ボタン配線（pin 9）

```
pin 9 (PC7) ──┬── ボタン（またはテスト用ジャンパ）
              └── GND
```

- ファームは内部プルアップ → **未押下 = 開放（HIGH）、押下 = GND ショート（LOW）**
- pin 7–9 は基板左右で内部接続されているため、**片側の pin 9 のみ**に配線する

---

## 開発の流れ

```
WSL:     編集 → ./scripts/build-firmware.sh → .bin
Windows: Web Flasher で書込 → USB 抜き差し
WSL:     ./scripts/serve-web.sh
Windows: localhost:8080 で WebHID 操作
```

| 作業 | 環境 |
|------|------|
| clone / 編集 / git / `make` | WSL |
| Web UI 配信 | WSL（`serve-web.sh`） |
| ファーム書き込み | Windows Chrome + Web Flasher |
| WebHID テスト | Windows Chrome + USB |

---

## リポジトリ構成

```
.
├── firmware/webhid/         # ファーム（VID 1209 / PID D011）
├── web/                     # WebHID I/O UI（静的）
├── scripts/                 # setup-wsl.sh / build-firmware.sh / serve-web.sh
├── external/                # .gitignore — setup-wsl.sh で取得
├── LICENSE                  # 本リポジトリ MIT + サードパーティ表記
└── README.md
```

### リポジトリに含まれるもの

| 含む | 含まない（`.gitignore`） |
|------|--------------------------|
| `firmware/`, `web/`, `scripts/` | `external/ch32fun`, `external/rv003usb` |
| ドキュメント（本 README 等） | ビルド成果物 `*.bin`, `*.hex`, `*.elf` 等 |

clone 後は必ず `./scripts/setup-wsl.sh` を実行してください。

---

## ハードウェア

| 項目 | 値 |
|------|-----|
| ボード | UIAPduino Pro Micro CH32V003 V1.4 |
| MCU | WCH CH32V003F4（RISC-V, 48 MHz） |
| 接続 | USB Type-C |
| LED 出力 | Arduino pin **2** = **PC0**（基板中央のオレンジ LED3） |
| ボタン入力 | Arduino pin **9** = **PC7**（GND ショート、内部プルアップ） |
| USB D+ / D- | PD3 / PD4（`firmware/webhid/usb_config.h`） |
| I2C（OLED 等） | pin **3** = **PC1**（SDA）、pin **4** = **PC2**（SCL） |

### OLED 接続（SSD1306 128×64・任意）

SSD1306 I2C OLED（4ピン: GND / VDD / SCK / SDA）を使う場合の配線です。OLED モジュールの **SCK = SCL**（I2C クロック）です。

| OLED 端子 | UIAPduino 接続先 |
|-----------|------------------|
| GND | GND |
| VDD | **3.3V 出力ピン**（5V 端子は使わない） |
| SCK | pin **4**（SCL / PC2） |
| SDA | pin **3**（SDA / PC1） |

```
OLED GND ──→ UIAPduino GND
OLED VDD ──→ UIAPduino 3.3V
OLED SCK ──→ pin 4
OLED SDA ──→ pin 3
```

**電圧（推奨）:** [UIAPduino 公式](https://www.uiap.jp/en/uiapduino/pro-micro/ch32v003/v1dot4) のとおり、**Volt-Sel ジャンパを 3.3V** にし、OLED の VDD も基板 **3.3V 端子**から給電してください（SSD1306 の I2C 論理は最大 3.3V）。pin 3 / 4 は基板上で 3.3V プルアップ済みのため、通常は外部プルアップは不要です。

表示は Web UI の「OLED テキスト」から行います（ファーム ver `0x03` 以上）。OLED を接続しなくても LED と pin 9 ボタンは動作します。起動直後は画面はクリアされた状態です。

### USB 識別子

| モード | VID | PID | 説明 |
|--------|-----|-----|------|
| 本ファーム（実行時） | `0x1209` | `0xD011` | Web UI が接続する PID |
| 書き込み待機 | `0x1209` | `0xB803` | UIAP カスタムブートローダー |
| 旧 LED 専用ファーム | `0x1209` | `0xD010` | 非互換（本 Web UI では接続しない） |
| 工場出荷ファーム等 | `0x1209` | `0xD004` 等 | tarosay 等。本 repo の Web UI とは **非互換** |

VID `0x1209` は [pid.codes](https://pid.codes/) のテスト用レンジです。

---

## 通信プロトコル

USB 物理層は HID。**Feature Report**（Web → デバイス）と **Input Report**（デバイス → Web）です。

| 項目 | 値 |
|------|-----|
| usagePage | `0xFF00`（ベンダー定義） |
| usage | `0x01` |
| 製品名 | `UIAPduino WebHID` |
| Feature Report サイズ | **32 バイト**（Report ID なし） |
| Input Report サイズ | **8 バイト** |

### コマンド（Feature Report の先頭バイト）

| 値 | 名前 | 動作 |
|----|------|------|
| `0x00` | OFF | LED 消灯 |
| `0x01` | ON | LED 点灯 |
| `0x02` | TOGGLE | 反転 |
| `0x03` | BLINK | 点滅（byte1 = 周期 [×100ms]、0 なら 500ms） |
| `0x04` | BLINK_STOP | 点滅停止（ON/OFF 状態は維持） |
| `0x10` | OLED_CLEAR | OLEDの全128×64領域をクリア |
| `0x11` | OLED_LINE | byte1 = 行番号 `0`–`3`、byte2–17 = 最大16文字のASCII |

`OLED_LINE`は印字可能なASCII（`0x20`–`0x7E`）だけを表示し、それ以外を空白に置換します。NUL以降とbyte18–31は表示に使用しません。

### ステータス（Input Report）— プロトコル v3

| オフセット | 意味 |
|------------|------|
| 0 | LED 状態（`0` = OFF, `1` = ON） |
| 1 | プロトコルバージョン（現在 **`0x03`**） |
| 2 | ボタン状態（`0` = 開放, `1` = 押下） |
| 3 | イベントフラグ bit0 = 押下エッジ, bit1 = 解放エッジ |
| 4 | OLED状態（`0` = 未接続/初期化失敗、`1` = 表示可能） |
| 5..7 | 予約 |

プロトコルv3はv2のLED・ボタンコマンドと互換です。実行中にI2Cエラーが発生するとOLED状態は`0`になり、再検出にはUIAPduinoの再起動が必要です。

### WebHID 接続例

```javascript
const [dev] = await navigator.hid.requestDevice({
  filters: [{ vendorId: 0x1209, productId: 0xd011, usagePage: 0xff00, usage: 0x01 }],
});
await dev.open();

const data = new Uint8Array(32);
data[0] = 0x01; // ON
await dev.sendFeatureReport(0, data);
```

- **Chrome / Edge のみ**（Firefox / Safari 非対応）
- **HTTPS または `http://localhost`** が必要

---

## トラブルシュート

| 症状 | 対処 |
|------|------|
| `make` 失敗 | `./scripts/setup-wsl.sh` を再実行。`gcc-riscv64-unknown-elf` が入っているか確認 |
| Web Flasher にデバイスが出ない | 書き込み待機モード（PID `B803`）か確認。公式マニュアルの手順を再試行 |
| Web UI に PID `D011` が出ない | 書き込み後に USB 抜き差し。`B803` のままなら再書き込み |
| ON しても LED が点灯しない | 中央オレンジ LED（PC0）を確認。別 PID のファームが入っていないか確認 |
| ボタンが反応しない | pin 9–GND 配線を確認。ファーム ver `0x03` 以上か確認（Web ログに警告表示） |
| OLED欄が無効 | ファーム ver `0x03` 以上か、OLEDの電源・SDA/SCL・I2Cアドレスを確認 |
| OLEDが途中から無効になった | I2Cエラーを検出。配線を直してUIAPduinoをUSBから抜き差し |
| WSL 内ブラウザで接続できない | **Windows Chrome** を使う（USB はホスト OS 側のみ） |

---

## ライセンスと表記

### 本リポジトリ

[MIT License](LICENSE) — `firmware/webhid/` および `web/` のオリジナルコード。

### サードパーティソフトウェア

| コンポーネント | ライセンス | 備考 |
|----------------|-----------|------|
| [ch32fun](https://github.com/cnlohr/ch32fun) | MIT | ビルド時に `external/` へ clone |
| [rv003usb](https://github.com/cnlohr/rv003usb) | MIT | 同上。USB スタック本体 |
| [UIAP Web Flasher](https://yuukiumeta-uiap.github.io/rv003usb-webflasher/example.html) | 別リポジトリのライセンスに従う | 書き込みツール（本 repo には同梱しない） |

詳細な著作権表記は [LICENSE](LICENSE) の Third-Party Notices を参照してください。

### UIAPduino ハードウェア・公式ソフトウェアについて

本リポジトリは **UIAP 社の製品ではありません**。UIAPduino ボードを使った独立した学習用サンプルです。

[UIAP 公式サイト](https://www.uiap.jp/en/uiapduino/pro-micro/ch32v003/v1dot4) の利用方針（要約）:

- ボードを **物理的に利用・加工して製品に組み込む** 用途には、配布・販売・商用利用の制限はなく、連絡も不要です。
- ボードの **設計データやソフトウェアを複製・改変して利用する** 場合は、それぞれのライセンスに従う必要があります。

工場出荷の UIAPduino ブートローダーは [cnlohr/rv003usb](https://github.com/cnlohr/rv003usb) をベースに UIAP がカスタマイズしたものです。本プロジェクトはブートローダーを **再配布しません**。

### 参考プロジェクト（本 repo とは非依存）

| リンク | 説明 |
|--------|------|
| [tarosay/uiap-hid-web](https://github.com/tarosay/uiap-hid-web) | Arduino + WebHID の参考実装（PID `0xD004`） |
| [SadaleNet/rv003usb-webflasher](https://github.com/SadaleNet/rv003usb-webflasher) | Web Flasher のベース |
| [YuukiUmeta-UIAP/rv003usb](https://github.com/YuukiUmeta-UIAP/rv003usb) | UIAP 向け rv003usb フォーク |

---

## 参考リンク

- [UIAPduino Pro Micro CH32V003 V1.4（公式）](https://www.uiap.jp/en/uiapduino/pro-micro/ch32v003/v1dot4)
- [UIAP Web Flasher](https://yuukiumeta-uiap.github.io/rv003usb-webflasher/example.html)
- [ch32fun](https://github.com/cnlohr/ch32fun)
- [rv003usb](https://github.com/cnlohr/rv003usb)
- [pid.codes — 1209:B003](http://pid.codes/1209/B003/)
- [WebHID API（MDN）](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API)
