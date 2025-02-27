# wersi-mk1-editor

_Jan 7th, 2025_: This editor is currently unmaintained and has been for several years. Its dependencies and frameworks are outdated, but you should still be able to get it to run, and you may have some luck in getting it to work with your hardware. Still, this editor is currently unsupported by its author, but code contributions are very welcome.

This repository is currently considered to be *alpha*. This means that setting up the editor will likely require some technical skill, and bugs will be present. Any help is greatly appreciated!

The goal behind this editor is to unlock the Wersi MK1's full sound synthesis potential, by creating a modern and user friendly interface to manipulate its sound synthesis. As such, a large effort has gone into reverse engineering the internal hardware, as well as its MIDI SysEx interface.

The editor itself has been built upon the React framework, using well structured ES2015 class-based design, for maintainability and to help future development. A minimal NodeJS server is provided that compiles the ES2015 code into a HTML web application, which is then locally accessible through a browser.

For browser compatibility, we recommend the latest version of Chrome or Chromium-based browsers. Compatibility beyond these browsers has not been tested as of yet.

## TL;DR

The editor fully works in a modern standalone browser and doesn't require any other software to function by using the new Web MIDI API. Go to [https://ijsf.github.io/wersi-mk1-editor/](https://ijsf.github.io/wersi-mk1-editor/) for the latest version.

If the editor doesn't work, make sure you use a browser that supports the latest Web MIDI API: [http://caniuse.com/#feat=midi](http://caniuse.com/#feat=midi).

## Local development

If you want to run the editor locally, e.g. for developing purposes, make sure the following is installed:

* [NodeJS](https://nodejs.org/en/) v8 or higher.
* [yarn](https://yarnpkg.com/lang/en/docs/install/) or similar NodeJS package manager.
* Chrome (or Chromium based) browser.

### To install on Windows (WSL2) or Linux

```
npm install --global yarn
yarn install
```

### To install on OSX

Make sure [Homebrew](https://brew.sh/) is installed. Then execute the following commands:

```
brew install nodejs
brew install yarn
yarn install
```

### Hardware

The following hardware is required for the editor:

* One fully functioning MIDI hardware interface.
* One Wersi MK1 or EX-20 synthesizer, with the appropriate firmware installed (see below).
* One AT29C256 EEPROM chip (and compatible EEPROM programmer, e.g. TL866), if no patched firmware has been installed before (see below).

A large effort has gone into reverse engineering the internal hardware, as well the MIDI SysEx interface of the Wersi MK1 synthesizer. Since this hardware was designed so long ago, there are a number of gotcha's and things you should know before using the editor.

### Firmware update

A number of known critical bugs exist in the original Wersi firmware that prevent the editor from working properly.

Fortunately, these have been fixed and as such, a patched firmware for your device should be available from [github.com/ijsf/wersi-mk1-ex20-re](https://github.com/ijsf/wersi-mk1-ex20-re/tree/master/firmwares).

Before continuing, boot up your synthesizer and check which firmware version (e.g. V1.21) it displays. If this version is *not* in the above list of firmwares, we would very much like to know! However, you should be able to use one of the other available firmwares without any problems.

To update the firmware:

1. Identify whether your synthesizer has a `AF20` or `AF21` board. There are multiple ways to do this:
	* If your synthesizer lists V1.21 when powering on, you likely have a `AF21` board.
	* Open up the synthesizer and search for (white) markings on the filter board (rightmost bottom green board on MK1).
	* Skip identification and just try different firmwares.
2. Identify the IC3 ("`PROGR. ROM`"), a 27256 DIP28 IC, typically on the leftmost side for MK1 synthesizers.
3. Download the most recent patched firmware from [github.com/ijsf/wersi-mk1-ex20-re](https://github.com/ijsf/wersi-mk1-ex20-re/tree/master/firmwares), depending on whether your synthesizer is equipped with the `AF20` or `AF21` board.
4. Program a compatible EEPROM chip (e.g. AT29C256) with the patched firmware, and swap with the original IC3.
5. Boot your synthesizer and confirm it still functions properly.

The editor automatically identifies devices with patched and unpatched firmwares, and should tell you whether your device has the appropriate firmware installed.

### Battery replacement

Like a lot of vintage hardware, the Wersi MK1 / EX-20 synthesizers come with a battery that perishes over time and will spill corrosive chemicals onto the board it is connected to.

It is recommended to open up your synthesizer, identify this battery (typically a Varta 2.4 V, 60 mAH, Ni/Cu) and remove or replace it as soon as possible to prevent any damage to your synthesizer.

The 2.4 V rechargeable battery is used as a power supply to 3 (SRM2064) SRAM devices whenever the main power supply is cut off, and is recharged when the main power supply is enabled. The low voltage enables the data retention mode in these devices, requires at least 2.0V and up to 5.0V and will use ~2 uA of power per chip. 

### Enabling MIDI SysEx

Each time the synthesizer is powered up, it is recommended to check whether the MIDI SysEx receive and send functionality has been enabled, as this is necessary for the editor to function properly.

To make sure SysEx functionality is enabled on your synthesizer:

1. Press H followed by F to enter the MIDI settings.
2. Press C. Ensure 8 (SysEx) is lit, then ensure 1 (Stop) is not lit, and press 1 twice.
3. Press B. Ensure 8 (SysEx) is lit, then ensure 1 (Stop) is not lit, and press 1 twice.
4. Press H to exit the MIDI settings.

Pressing 1 twice is likely necessary, as it explicitly stops and restarts the MIDI logic. This seems to be a minor bug in the original firmware.

## Launch the editor

To start the editor, open a new terminal, go to this directory and type:

    yarn start

Make sure you click Allow for any firewall questions on OSX. You should be able to access the editor at http://localhost:3000.

