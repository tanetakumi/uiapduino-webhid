# webhid — UIAPduino WebHID I/O firmware

TARGET := webhid

CH32FUN  ?= ../../external/ch32fun/ch32fun
RV003USB ?= ../../external/rv003usb

ADDITIONAL_C_FILES += $(RV003USB)/rv003usb/rv003usb.S $(RV003USB)/rv003usb/rv003usb.c
EXTRA_CFLAGS += -I$(RV003USB)/lib -I$(RV003USB)/rv003usb

TARGET_MCU ?= CH32V003

PICOLIBC_INC := /usr/lib/picolibc/riscv64-unknown-elf/include
ifneq ($(wildcard $(PICOLIBC_INC)/stdio.h),)
	NEWLIB := $(PICOLIBC_INC)
endif

include $(CH32FUN)/ch32fun.mk

flash: cv_flash
clean: cv_clean

.PHONY: flash clean
