#ifndef _USB_CONFIG_H
#define _USB_CONFIG_H

#define ENDPOINTS 2
#define RV003USB_HANDLE_USER_DATA  1
#define RV003USB_HID_FEATURES      1

#define USB_PORT D
#define USB_PIN_DP 3
#define USB_PIN_DM 4

#define RV003USB_OPTIMIZE_FLASH    1
#define RV003USB_EVENT_DEBUGGING   0
#define RV003USB_HANDLE_IN_REQUEST 1
#define RV003USB_OTHER_CONTROL     0

#ifndef __ASSEMBLER__

#include <tinyusb_hid.h>

#ifdef INSTANCE_DESCRIPTORS

static const uint8_t device_descriptor[] = {
	18, 1,
	0x10, 0x01,
	0x00, 0x00, 0x00,
	0x08,
	0x09, 0x12,  // VID 0x1209
	0x11, 0xd0,  // PID 0xD011 — this project
	0x01, 0x00,
	1, 2, 3, 1,
};

static const uint8_t webhid_hid_desc[] = {
	0x06, 0x00, 0xFF,
	HID_USAGE(0x01),
	HID_COLLECTION(HID_COLLECTION_APPLICATION),
		HID_REPORT_SIZE(8),
		HID_REPORT_COUNT(8),
		HID_USAGE(0x02),
		HID_INPUT(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),
		HID_REPORT_SIZE(8),
		HID_REPORT_COUNT(32),
		HID_USAGE(0x03),
		HID_FEATURE(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),
	HID_COLLECTION_END,
};

static const uint8_t config_descriptor[] = {
	9, 2,
	0x29, 0x00,
	0x01, 0x01, 0x00, 0x80, 0x64,
	9, 4, 0, 0, 1, 0x03, 0x00, 0x00, 0,
	9, 0x21, 0x10, 0x01, 0x00, 0x01, 0x22, sizeof(webhid_hid_desc), 0x00,
	7, 0x05, 0x81, 0x03, 0x08, 0x00, 10,
};

#define STR_MANUFACTURER u"UIAPduino"
#define STR_PRODUCT      u"UIAPduino WebHID"
#define STR_SERIAL       u"WEBHID0001"

struct usb_string_descriptor_struct {
	uint8_t bLength;
	uint8_t bDescriptorType;
	uint16_t wString[];
};

const static struct usb_string_descriptor_struct string0 __attribute__((section(".rodata"))) = {
	4, 3, {0x0409}
};
const static struct usb_string_descriptor_struct string1 __attribute__((section(".rodata"))) = {
	sizeof(STR_MANUFACTURER), 3, STR_MANUFACTURER
};
const static struct usb_string_descriptor_struct string2 __attribute__((section(".rodata"))) = {
	sizeof(STR_PRODUCT), 3, STR_PRODUCT
};
const static struct usb_string_descriptor_struct string3 __attribute__((section(".rodata"))) = {
	sizeof(STR_SERIAL), 3, STR_SERIAL
};

const static struct descriptor_list_struct {
	uint32_t lIndexValue;
	const uint8_t *addr;
	uint8_t length;
} descriptor_list[] = {
	{0x00000100, device_descriptor, sizeof(device_descriptor)},
	{0x00000200, config_descriptor, sizeof(config_descriptor)},
	{0x00002200, webhid_hid_desc, sizeof(webhid_hid_desc)},
	{0x00000300, (const uint8_t *)&string0, 4},
	{0x04090301, (const uint8_t *)&string1, sizeof(STR_MANUFACTURER)},
	{0x04090302, (const uint8_t *)&string2, sizeof(STR_PRODUCT)},
	{0x04090303, (const uint8_t *)&string3, sizeof(STR_SERIAL)}
};
#define DESCRIPTOR_LIST_ENTRIES ((sizeof(descriptor_list)) / (sizeof(struct descriptor_list_struct)))

#endif // INSTANCE_DESCRIPTORS
#endif // __ASSEMBLER__

#endif
