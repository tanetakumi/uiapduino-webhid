/**
 * webhid — WebHID I/O for UIAPduino (CH32V003)
 *
 * Stack: ch32fun + rv003usb (no Arduino / no tarosay packages)
 * Protocol: README.md
 */
#include "ch32fun.h"
#include <string.h>
#include "rv003usb.h"
#include "funconfig.h"
#include "oled_text.h"

#define HIGH         FUN_HIGH
#define LOW          FUN_LOW
#define OUTPUT       GPIO_CFGLR_OUT_10Mhz_PP
#define digitalWrite funDigitalWrite
#define pinMode      funPinMode
#define millis()     (funSysTick32() / DELAY_MS_TIME)

#define LED_PIN PC0          // UIAPduino built-in LED (pin 2)
#define FEATURE_LEN 32
#define FW_VERSION 0x03

#define CMD_OFF        0x00
#define CMD_ON         0x01
#define CMD_TOGGLE     0x02
#define CMD_BLINK      0x03
#define CMD_BLINK_STOP 0x04
#define CMD_OLED_CLEAR 0x10
#define CMD_OLED_LINE  0x11

#define BTN_EVT_PRESSED  0x01
#define BTN_EVT_RELEASED 0x02

static uint8_t feature_buf[FEATURE_LEN];
static volatile uint8_t feature_ready;
static volatile uint8_t led_state;
static volatile uint8_t blink_active;
static volatile uint8_t blink_period_100ms = 5;
static volatile uint32_t blink_next_ms;
static volatile uint8_t status_pending = 1;

static uint8_t btn_state;
static uint8_t btn_events;
static uint8_t btn_raw_stable;
static uint8_t btn_sample;
static uint32_t btn_debounce_ms;

static void led_apply(uint8_t on) {
	led_state = on ? 1 : 0;
	digitalWrite(LED_PIN, on ? HIGH : LOW);
	status_pending = 1;
}

static void handle_command(void) {
	const uint8_t cmd = feature_buf[0];
	switch (cmd) {
	case CMD_OFF:
		blink_active = 0;
		led_apply(0);
		break;
	case CMD_ON:
		blink_active = 0;
		led_apply(1);
		break;
	case CMD_TOGGLE:
		blink_active = 0;
		led_apply(!led_state);
		break;
	case CMD_BLINK:
		blink_period_100ms = feature_buf[1] ? feature_buf[1] : 5;
		blink_active = 1;
		blink_next_ms = millis() + (uint32_t)blink_period_100ms * 100u;
		break;
	case CMD_BLINK_STOP:
		blink_active = 0;
		break;
	case CMD_OLED_CLEAR:
		oled_text_clear();
		status_pending = 1;
		break;
	case CMD_OLED_LINE:
		if (feature_buf[1] < OLED_TEXT_ROWS) {
			uint8_t text[OLED_TEXT_COLS];
			memcpy(text, &feature_buf[2], sizeof(text));
			oled_text_set_line_bytes(feature_buf[1], text,
			                         sizeof(text));
			status_pending = 1;
		}
		break;
	default:
		break;
	}
}

static void poll_btn(void) {
	const uint8_t raw = !funDigitalRead(BTN_PIN);
	const uint32_t now = millis();

	if (raw != btn_sample) {
		btn_sample = raw;
		btn_debounce_ms = now;
	}

	if ((int32_t)(now - btn_debounce_ms) < BTN_DEBOUNCE_MS)
		return;

	if (raw == btn_raw_stable)
		return;

	btn_raw_stable = raw;
	btn_state = raw;
	if (raw)
		btn_events |= BTN_EVT_PRESSED;
	else
		btn_events |= BTN_EVT_RELEASED;
	status_pending = 1;
}

static void send_status(struct usb_endpoint *e, uint32_t sendtok) {
	uint8_t report[8] = {
		led_state,
		FW_VERSION,
		btn_state,
		btn_events,
		oled_text_is_ready(),
		0, 0, 0,
	};
	btn_events = 0;
	usb_send_data(report, sizeof(report), 0, sendtok);
}

int main(void) {
	SystemInit();
	funGpioInitC();
	pinMode(LED_PIN, GPIO_Speed_10MHz | GPIO_CNF_OUT_PP);
	pinMode(BTN_PIN, GPIO_Speed_In | GPIO_CNF_IN_PUPD);
	funDigitalWrite(BTN_PIN, 1);
	btn_sample = !funDigitalRead(BTN_PIN);
	btn_raw_stable = btn_sample;
	btn_state = btn_sample;
	btn_debounce_ms = millis();
	led_apply(0);
	Delay_Ms(10);
	oled_text_init();
	usb_setup();

	uint32_t last_status_ms = 0;
	while (1) {
		if (feature_ready) {
			feature_ready = 0;
			handle_command();
		}

		poll_btn();

		if (blink_active) {
			uint32_t now = millis();
			if ((int32_t)(now - blink_next_ms) >= 0) {
				led_apply(!led_state);
				blink_next_ms = now + (uint32_t)blink_period_100ms * 100u;
			}
		}

		uint32_t now = millis();
		if ((int32_t)(now - last_status_ms) >= 1000) {
			last_status_ms = now;
			status_pending = 1;
		}
	}
}

void usb_handle_user_in_request(struct usb_endpoint *e, uint8_t *scratchpad, int endp,
                                uint32_t sendtok, struct rv003usb_internal *ist) {
	if (endp) {
		if (status_pending) {
			status_pending = 0;
			send_status(e, sendtok);
		} else {
			usb_send_empty(sendtok);
		}
	} else {
		usb_send_empty(sendtok);
	}
}

void usb_handle_user_data(struct usb_endpoint *e, int current_endpoint, uint8_t *data,
                          int len, struct rv003usb_internal *ist) {
	int offset = e->count << 3;
	int torx = e->max_len - offset;
	if (torx > len) torx = len;
	if (torx <= 0) return;

	memcpy(feature_buf + offset, data, torx);
	e->count++;
	if ((e->count << 3) >= e->max_len) {
		feature_ready = 1;
	}
}

void usb_handle_hid_get_report_start(struct usb_endpoint *e, int reqLen, uint32_t lValueLSBIndexMSB) {
	if (reqLen > FEATURE_LEN) reqLen = FEATURE_LEN;
	e->opaque = feature_buf;
	e->max_len = reqLen;
}

void usb_handle_hid_set_report_start(struct usb_endpoint *e, int reqLen, uint32_t lValueLSBIndexMSB) {
	if (reqLen > FEATURE_LEN) reqLen = FEATURE_LEN;
	e->max_len = reqLen;
	e->count = 0;
}
