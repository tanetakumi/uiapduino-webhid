# ファームウェアの書き込み

UIAPduino Pro Micro CH32V003 V1.4 向け `webhid` ファームウェアの書き込み手順です。WSL でのビルドは不要です。

## 前提

| 項目 | 内容 |
|------|------|
| ボード | [UIAPduino Pro Micro CH32V003 V1.4](https://www.uiap.jp/en/uiapduino/pro-micro/ch32v003/v1dot4) |
| ブラウザ | **Windows の Chrome または Edge**（Web Flasher 用） |
| 書き込み後の PID | `VID_1209` / `PID_D011`（通常モード） |
| 書き込み待機 PID | `VID_1209` / `PID_B803` |

## 1. ファームウェアをダウンロード

[GitHub Releases](https://github.com/tanetakumi/uiapduino-webhid/releases/latest) から **`webhid.bin`** をダウンロードします。

- 最新版は [Releases / latest](https://github.com/tanetakumi/uiapduino-webhid/releases/latest) から取得できます
- 現在の推奨版はプロトコル **v4**（Input Report の `ver=0x04`）

## 2. 書き込み待機モードに入れる

UIAPduino を **書き込み待機モード** にします。Windows のデバイスマネージャーで次のように表示されていることを確認してください。

- `USB\VID_1209&PID_B803`

入り方の詳細は [UIAPduino V1.4 公式マニュアル](https://www.uiap.jp/en/uiapduino/pro-micro/ch32v003/v1dot4) を参照してください。

## 3. Web Flasher で書き込む

1. Windows Chrome で [UIAP Web Flasher](https://yuukiumeta-uiap.github.io/rv003usb-webflasher/example.html) を開く
2. **Choose File** → 手順 1 でダウンロードした `webhid.bin` を選択
3. **Flash! (pick rv003usb)** をクリック
4. 完了後、USB を **抜き差し** する

## 4. 書き込みの確認

通常モードではデバイスマネージャーに `VID_1209&PID_D011` と表示されます。

Web UI で動作確認する場合:

```bash
# WSL でリポジトリを clone 済みなら
./scripts/serve-web.sh   # http://localhost:8080
```

Windows Chrome で http://localhost:8080 を開き、**UIAPduino に接続** します。ログに `ver=0x04` が表示されれば v4 ファームが入っています。

## トラブルシュート

| 症状 | 対処 |
|------|------|
| Web Flasher にデバイスが出ない | 書き込み待機モード（PID `B803`）か確認 |
| 書き込み後も PID `B803` のまま | 再書き込み、USB ケーブル・ポートを変更 |
| Web UI に PID `D011` が出ない | USB 抜き差し後に再接続 |
| LED / ボタンは動くが OLED が無効 | 配線・3.3V 給電を確認。Web UI の **OLEDを再検出**（v4）または USB 抜き差し |

その他はリポジトリの [README.md](../README.md) のトラブルシュートを参照してください。

## 開発者向け: ソースからビルドする

WSL でファームを自分でビルドする場合:

```bash
git clone https://github.com/tanetakumi/uiapduino-webhid.git
cd uiapduino-webhid
chmod +x scripts/*.sh
./scripts/setup-wsl.sh
./scripts/build-firmware.sh   # → firmware/webhid/webhid.bin
```

生成された `firmware/webhid/webhid.bin` を上記手順 3 と同様に Web Flasher で書き込みます。
