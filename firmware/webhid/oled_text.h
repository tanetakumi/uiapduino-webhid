#ifndef OLED_TEXT_H
#define OLED_TEXT_H

#include <stdint.h>
#include <string.h>

/*
 * Keep OLED traffic bounded when the display is missing.  PC1/PC2 are the
 * CH32V003 hardware-I2C pins used by UIAPduino pins 3/4.
 */
#define SSD1306_I2C_CLKRATE 100000
#define SSD1306_I2C_PRERATE 2000000
#define TIMEOUT_MAX 5000

/* ssd1306_i2c.h reports errors through printf; this firmware has no console. */
#define printf(...) ((void)0)
#include "ssd1306_i2c.h"
#undef printf

#include "font_8x8.h"

#define OLED_TEXT_COLS       16
#define OLED_TEXT_ROWS       4
#define OLED_TEXT_PAGE_COUNT 8
#define OLED_TEXT_CHUNK      32

static volatile uint8_t oled_text_addr;

/* SSD1306 128x64, internal charge pump, horizontal addressing mode. */
static const uint8_t oled_text_init_packet[] = {
	0x00,
	0xae,
	0xd5, 0x80,
	0xa8, 0x3f,
	0xd3, 0x00,
	0x40,
	0x8d, 0x14,
	0x20, 0x00,
	0xa1,
	0xc8,
	0xda, 0x12,
	0x81, 0x8f,
	0xd9, 0xf1,
	0xdb, 0x40,
	0xa4,
	0xa6,
};

static uint8_t oled_text_send_raw(const uint8_t *data, int len) {
	if (!oled_text_addr)
		return 1;
	if (ssd1306_i2c_send(oled_text_addr, data, len)) {
		oled_text_addr = 0;
		return 1;
	}
	return 0;
}

static uint8_t oled_text_probe(uint8_t addr) {
	const uint8_t probe[] = { 0x00, 0xae };
	return ssd1306_i2c_send(addr, probe, sizeof(probe));
}

static uint8_t oled_text_set_window(uint8_t first_page, uint8_t last_page) {
	const uint8_t commands[] = {
		0x00,
		0x21, 0x00, 0x7f,
		0x22, first_page, last_page,
	};
	return oled_text_send_raw(commands, sizeof(commands));
}

static uint8_t oled_text_send_data(const uint8_t *data) {
	uint8_t packet[OLED_TEXT_CHUNK + 1];
	packet[0] = 0x40;
	memcpy(&packet[1], data, OLED_TEXT_CHUNK);
	return oled_text_send_raw(packet, sizeof(packet));
}

static uint8_t oled_text_glyph_column(uint8_t c, uint8_t column) {
	uint8_t result = 0;
	const uint16_t base = (uint16_t)c << 3;

	for (uint8_t row = 0; row < 8; row++) {
		if (fontdata[base + row] & (0x80u >> column))
			result |= 1u << row;
	}
	return result;
}

static void oled_text_clear(void);

static uint8_t oled_text_init(void) {
	const uint8_t display_on[] = { 0x00, 0xaf };

	oled_text_addr = 0;
	ssd1306_i2c_init();

	if (!oled_text_probe(0x3c)) {
		oled_text_addr = 0x3c;
	} else {
		ssd1306_i2c_setup();
		if (!oled_text_probe(0x3d))
			oled_text_addr = 0x3d;
	}

	if (!oled_text_addr)
		return 1;

	if (oled_text_send_raw(oled_text_init_packet,
	                       sizeof(oled_text_init_packet)))
		return 1;

	/* Keep the panel off until all display RAM has been cleared. */
	oled_text_clear();
	if (!oled_text_addr)
		return 1;
	return oled_text_send_raw(display_on, sizeof(display_on));
}

static uint8_t oled_text_is_ready(void) {
	return oled_text_addr != 0;
}

/* Clear all eight pages so the unused lower half is guaranteed to be dark. */
static void oled_text_clear(void) {
	static const uint8_t blank[OLED_TEXT_CHUNK] = { 0 };

	if (!oled_text_addr || oled_text_set_window(0, OLED_TEXT_PAGE_COUNT - 1))
		return;

	for (uint8_t i = 0;
	     i < (128 / OLED_TEXT_CHUNK) * OLED_TEXT_PAGE_COUNT;
	     i++) {
		if (oled_text_send_data(blank))
			return;
	}
}

static void oled_text_set_line_bytes(uint8_t row, const uint8_t *buf,
	                                  uint8_t len) {
	uint8_t chunk[OLED_TEXT_CHUNK];
	uint8_t nul_seen = 0;

	if (!oled_text_addr || row >= OLED_TEXT_ROWS)
		return;
	if (len > OLED_TEXT_COLS)
		len = OLED_TEXT_COLS;
	if (oled_text_set_window(row, row))
		return;

	for (uint8_t block = 0; block < 4; block++) {
		for (uint8_t glyph = 0; glyph < 4; glyph++) {
			const uint8_t index = block * 4 + glyph;
			uint8_t c = ' ';

			if (!nul_seen && index < len) {
				c = buf[index];
				if (!c) {
					nul_seen = 1;
					c = ' ';
				} else if (c < 0x20 || c > 0x7e) {
					c = ' ';
				}
			}

			for (uint8_t column = 0; column < 8; column++)
				chunk[glyph * 8 + column] =
					oled_text_glyph_column(c, column);
		}

		if (oled_text_send_data(chunk))
			return;
	}
}

#endif
