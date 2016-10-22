import Client from './Client';

/**
 * WersiClient
 *
 * Implements a Wersi MK1 compatible Websocket client for sysexd.
 */
export default class WersiClient extends Client {
  /**
   * Block types
   */
  static BLOCK_TYPE = {
    REQUEST: 'r',     // Request block, used to request other blocks of data
    SWITCH: 's',      // Controls the instrument's switches (buttons)
    TRANSFORM: 't',   // Transform buffer
    ICB: 'i',         // Instrument control block
    VCF: 'v',         // VCF block
    FREQ: 'f',        // Frequency envelope block
    AMPL: 'a',        // Amplitude envelope block
    FIXWAVE: 'q',     // FIXWAVE wavetable block
    RELWAVE: 'w'      // RELWAVE wavetable block
  };
  
  /**
   * Wersi addresses
   *
   * [0:5]  Identifier (64)
   * [6]    RAM
   * [7]    Cartridge (unused)
   *
   * RAM (CV / Control Voice) address range is therefore [64:127].
   *
   * ICB addresses are layed out as follows, according to the technical manual:
   *
   * Instrument 65 (DRAWBAR):      special drawbar instrument. We ignore this instrument.
   * Instrument 66 (CV 1):         ICB 66 VCF 65 AMPL 65 FREQ 65 FIXWAVE 65 (Voice 1), 87, 86, 86, 86 (Voice 2).
   * ...
   * Instrument 75 (CV 10):        ICB 75 VCF 74 AMPL 74 FREQ 74 FIXWAVE 74 (Voice 1), 96, 95, 95, 95 (Voice 2).
   * Instrument 76 (CV 1 BANK 2):  ICB 76 VCF 75 AMPL 75 FREQ 75 FIXWAVE 75 (Voice 1), 97, 96, 96, 96 (Voice 2).
   * ...
   * Instrument 85 (CV 10 BANK 2): ICB 85 VCF 84 AMPL 84 FREQ 84 FIXWAVE 84 (Voice 1), 106, 105, 105, 105 (Voice 2).
   *
   * ICB address range: [66:85] (20).
   * RAM address range: [86:127] (42).
   */
  static ADDRESS = {
    // Maximum number of CVs
    maxCVs: 20,
    
    // Unique ICB address (range [0:19], includes BANK 2) and voice layer id (range [0:2])
    CV(id, voiceLayer) {
      const address = (!voiceLayer) ? (66 + id) : (87 + id + (voiceLayer - 1) * WersiClient.ADDRESS.maxCVs);
      return (id >= 0 && id < WersiClient.ADDRESS.maxCVs && address >= 64 && address < 128) ? address : null;
    },
    
    // Unique RAM address for VCF/AMPL/FREQ/FIXWAVE (range [0:19], includes BANK 2) and voice layer id (range [0:2])
    RAM(id, voiceLayer) {
      const address = (voiceLayer == 0) ? (65 + id) : (86 + id + (voiceLayer - 1) * WersiClient.ADDRESS.maxCVs);
      return (id >= 0 && id < WersiClient.ADDRESS.maxCVs && address >= 64 && address < 128) ? address : null;
    },
    
    // Reverse ICB to CV id mapping
    id(icbAddress) {
      return icbAddress - 66;
    },
    
    // Reverse ICB to layer id mapping
    layer(icbAddress) {
      return (icbAddress >= 66 && icbAddress < 87) ? 0 : Math.floor((icbAddress - 87) / WersiClient.ADDRESS.maxCVs) + 1;
    }
  };
  
  /**
   * Wersi instruction explanation for envelopes
   *
   * Instructions (reverse engineered so far):
   *
   *     FVVVVVVV | 0x0: delay V or infinite if F (0 to 5*127 = 635 ms)
   * VVVVVVVVVVVV | 0x1: set V
   * VVVVVVVVVVVV | 0x5: add V
   */
  static ENVELOPE = {
    TIMESTEP: 5,            // single instruction time step (5 ms)
    TIMESTEP7: 5 * 127,     // max time step for 7-bit values
    TIMESTEP12: 5 * 4095,  // max time step for 12-bit values
    
    delay: function(v, f) {
      return [
        0x00,
        v
      ];
    },
    set: function(v) {
      return [
        ((v & 0xF) << 4) | 0x1,
        (v >> 4) & 0xFF
      ];
    },
    add: function(v) {
      return [
        ((v & 0xF) << 4) | 0x5,
        (v >> 4) & 0xFF
      ];
    }
  };
  
  constructor() {
    super();
    
    // Determine block lengths (in bytes)
    this.blockLength = {};
    this.blockLength[WersiClient.BLOCK_TYPE.ICB] = 16;
    this.blockLength[WersiClient.BLOCK_TYPE.VCF] = 10;
    this.blockLength[WersiClient.BLOCK_TYPE.FREQ] = 32;
    this.blockLength[WersiClient.BLOCK_TYPE.AMPL] = 44;
    this.blockLength[WersiClient.BLOCK_TYPE.FIXWAVE] = 212;
    this.blockLength[WersiClient.BLOCK_TYPE.RELWAVE] = 177;
    
    // Determine device id (Wersi MK1/EX20)
    this.deviceId = 0x01;
  }
  
  // u8 to hex string (debug)
  _utohex(input) {
    var h = '[';
    for (var i = 0; i < input.length; i++) {
      let c = input[i].toString(16);
      h += "0x" + (c.length === 1 ? "0" : "") + c.toUpperCase() + ((i < input.length - 1) ? " " : "");
    }
    return h + ']';
  }
  
  // u8 to sysex nibble
  _uton(id, input) {
    return [
      (id << 5) | 0x10 | (input & 0xF),
      (id << 5) | (input >> 4) & 0xF
    ];
  }
  
  // SysEx nibble to u8
  _ntou(id, lo, hi) {
    if ((lo & 0xF0) != ((id << 5) | 0x10) || (hi & 0xF0) != (id << 5)) {
      throw "Invalid data";
    }
    return (lo & 0x0F) | ((hi & 0x0F) << 4);
  }
  
  // Validate SysEx header
  _isSysExHeaderValid(sysex) {
    return (sysex[0] == 0xF0 && sysex[1] == 0x25 && sysex[2] == this.deviceId);
  }
  
  // Message object to binary SysEx message
  _toSysEx(message) {
    let sysexHeader = new Uint8Array(
      // MIDI SysEx header
      [
        0xF0,           // SysEx identifier
        0x25,           // Wersi manufacturer identifier
        this.deviceId   // Wersi device identifier
      ]
      // Wersi specific content
      .concat(this._uton(3, message.type|0))
      .concat(this._uton(2, message.address|0))
      .concat(this._uton(1, message.length|0))
    );
    let sysexData = new Uint8Array(message.data.length * 2);
    for(let i = 0; i < message.data.length; ++i) {
      let nibble = this._uton(0, message.data[i]);
      sysexData[i * 2 + 0] = nibble[0];
      sysexData[i * 2 + 1] = nibble[1];
    }
    
    // Construct entire message
    let sysex = new Uint8Array(sysexHeader.length + sysexData.length + 1);
    sysex.set(sysexHeader, 0);
    sysex.set(sysexData, sysexHeader.length);
    
    // Prepend MIDI SysEx footer
    sysex[sysexHeader.length + sysexData.length] = 0xF7;
    
    // Debug
    console.log("SysEx send: " + this._utohex(sysex));
    
    return sysex;
  }
  
  // Binary SysEx message to message object
  _fromSysEx(sysex) {
    let message = {};
    
    // Validate MIDI SysEx header
    if (!this._isSysExHeaderValid(sysex)) {
      throw "Invalid SysEx message: " + this._utohex(sysex);
    }
    
    // Parse Wersi specific content
    let i = 3;
    message.type = this._ntou(3, sysex[i++], sysex[i++]);
    message.address = this._ntou(2, sysex[i++], sysex[i++]);
    message.length = this._ntou(1, sysex[i++], sysex[i++]);
    
    // Calculate expected (byte non-nibble) length
    const expectedLength = (sysex.length - i - 1) / 2;
    if (expectedLength != message.length) {
      throw "Invalid SysEx length (type " + String.fromCharCode(message.type) +
      ", address " + message.address +
      ", length got " + message.length + ", expected " + expectedLength + "): " + this._utohex(sysex);
    }
    
    // Decode nibbles
    message.data = new Uint8Array(message.length);
    for(let j = 0; j < message.length; ++j) {
      message.data[j] = this._ntou(0, sysex[i++], sysex[i++]);
    }
    
    return message;
  }
  
  _getBlockLength(type) {
    return this.blockLength[type];
  }
  
  _requestBlock(typeRequested, address) {
    return this.send(
      this._toSysEx({
        type: WersiClient.BLOCK_TYPE.REQUEST.charCodeAt(0),
        address: address,
        length: 1,
        data: new Uint8Array([typeRequested.charCodeAt(0)])
      }), false, true)
      .then((data) => {
        return this._fromSysEx(data);
      });
  }
  
  // Returns whether the received SysEx message is valid and should be further processed
  isValid(sysex) {
    // Validate MIDI SysEx header
    if (!this._isSysExHeaderValid(sysex)) {
      throw "Invalid SysEx message: " + this._utohex(sysex);
    }
    
    // Parse Wersi specific content
    let i = 3;
    const messageType = String.fromCharCode(this._ntou(3, sysex[i++], sysex[i++]));
    
    // Ignore everything but the types we expect from any previously sent messages
    if (  messageType === WersiClient.BLOCK_TYPE.ICB
      ||  messageType === WersiClient.BLOCK_TYPE.VCF
      ||  messageType === WersiClient.BLOCK_TYPE.FREQ
      ||  messageType === WersiClient.BLOCK_TYPE.AMPL
      ||  messageType === WersiClient.BLOCK_TYPE.FIXWAVE
      ||  messageType === WersiClient.BLOCK_TYPE.RELWAVE
    ) {
      return true;
    }
    else {
      console.log("Ignoring SysEx message with type " + messageType);
    }
    return false;
  }
  
  getVCF(address) {
    return this._requestBlock(WersiClient.BLOCK_TYPE.VCF, address)
    .then((message) => {
      console.log("SysEx VCF receive: " + this._utohex(message.data));

      const blockLength = this._getBlockLength(WersiClient.BLOCK_TYPE.VCF);
      if (message.length != blockLength) {
        throw "Invalid message length for VCF (got " + message.length + ", expected " + blockLength + ")";
      }
      
      // Decode data
      let dv = new DataView(message.data.buffer);
      return {
        routeLeft:    (message.data[0] & 0x01) ? true : false,  // left output routing
        routeRight:   (message.data[0] & 0x02) ? true : false,  // right output routing
        lowPass:      (message.data[0] & 0x04) ? true : false,  // low-pass (1) or band-pass (0)
        fourPoles:    (message.data[0] & 0x08) ? true : false,  // 4-pole 24 dB/oct (1) or 2-pole 12 dB/oct
        routeWV:      (message.data[0] & 0x10) ? true : false,  // WersiVoice output routing
        noise:        (message.data[0] & 0x20) ? true : false,
        distortion:   (message.data[0] & 0x40) ? true : false,
        
        frequency:    (message.data[1]),
        q:            (message.data[2]),
        
        noiseType:    (message.data[3] & 0x0C) >> 2,            // noise type: wind (0), click (1), flute (2)
        retrigger:    (message.data[3] & 0x10) ? true : false,  // retrigger VCF on note
        envType:      (message.data[3] & 0x60) >> 5,            // envelope: T1 (0), T1->T2 (1), T1->Release->T2 (2), Rotor (3)
        tracking:     (message.data[3] & 0x80) ? true : false,  // note tracking, frequency tracks note frequency
        
        t1Time:       (message.data[4]),
        t2Time:       (message.data[5]),
        t1Intensity:  dv.getInt8(6),
        t1Offset:     (message.data[7]),
        t2Intensity:  dv.getInt8(8),
        t2Offset:     (message.data[9])
      };
    });
  }
  
  setVCF(address, data) {
    // Encode data
    let dataEncoded = new Uint8Array(this._getBlockLength(WersiClient.BLOCK_TYPE.VCF));
    let dv = new DataView(dataEncoded.buffer);
    dv.setUint8(0,
        (data.get('routeLeft')      ? 0x01 : 0)
      | (data.get('routeRight')     ? 0x02 : 0) 
      | (data.get('lowPass')        ? 0x04 : 0)
      | (data.get('fourPoles')      ? 0x08 : 0)
      | (data.get('routeWV')        ? 0x10 : 0)
      | (data.get('noise')          ? 0x20 : 0)
      | (data.get('distortion')     ? 0x40 : 0)
    );
    dv.setUint8(1, data.get('frequency'));
    dv.setUint8(2, data.get('q'));
    dv.setUint8(3, 
        ((data.get('noiseType') & 0x03) << 2)
      | (data.get('retrigger') ? 0x10 : 0)
      | ((data.get('envType') & 0x03) << 5)
      | (data.get('tracking') ? 0x80 : 0)
    );
    dv.setUint8(4, data.get('t1Time'));
    dv.setUint8(5, data.get('t2Time'));
    dv.setInt8(6, data.get('t1Intensity'));
    dv.setUint8(7, data.get('t1Offset'));
    dv.setInt8(8, data.get('t2Intensity'));
    dv.setUint8(9, data.get('t2Offset'));
    
    return this.send(
      this._toSysEx({
        type: WersiClient.BLOCK_TYPE.VCF.charCodeAt(0),
        address: address,
        length: dataEncoded.length,
        data: dataEncoded
      }), true)
      .then((status) => {
        return status;
      });
  }
  
  getICB(address) {
    return this._requestBlock(WersiClient.BLOCK_TYPE.ICB, address)
    .then((message) => {
      console.log("SysEx ICB receive: " + this._utohex(message.data));

      const blockLength = this._getBlockLength(WersiClient.BLOCK_TYPE.ICB);
      if (message.length != blockLength) {
        throw "Invalid message length for ICB (got " + message.length + ", expected " + blockLength + ")";
      }
      
      // Decode data
      let dv = new DataView(message.data.buffer);
      return {
        nextInstrumentAddress: message.data[0], // Next ICB pointer, for layered sounds (0 for none)
      
        vcfAddress: message.data[1],
        amplAddress: message.data[2],
        freqAddress: message.data[3],
        waveAddress: message.data[4],
      
        dynamics: message.data[5] & 0x03,
        voiceSelectLower: (message.data[5] & 0x04) ? true : false,
        voiceSelectUpper: (message.data[5] & 0x08) ? true : false,
      
        // Unknown
        a1: (message.data[5] & 0x10) ? true : false,
        a2: (message.data[5] & 0x20) ? true : false,
        a3: (message.data[5] & 0x40) ? true : false,
        a4: (message.data[5] & 0x80) ? true : false,
      
        routeLeft:    (message.data[6] & 0x01) ? true : false,
        routeRight:   (message.data[6] & 0x02) ? true : false,
        routeBright:  (message.data[6] & 0x04) ? true : false,
        routeVCF:     (message.data[6] & 0x08) ? true : false,
        routeWV:      (message.data[6] & 0x10) ? true : false,

        // Unknown
        b1: (message.data[6] & 0x20) ? true : false,
        b2: (message.data[6] & 0x40) ? true : false,
        b3: (message.data[6] & 0x80) ? true : false,
      
        transpose: dv.getInt8(7),
        detune: dv.getInt8(8),
      
        wvMode:   message.data[9] & 0x07, // RotorSlow, RotorFast, Flanger, Strings, Chorus
        wvLeft:   (message.data[9] & 0x08) ? true : false,
        wvRight:  (message.data[9] & 0x10) ? true : false,
      
        // Unknown
        c1: (message.data[9] & 0x20) ? true : false,
      
        wvFeedbackStereoFlat: (message.data[9] & 0x40) ? true : false,
        wvFeedbackDeep: (message.data[9] & 0x80) ? true : false,
      
        name: new TextDecoder("utf-8").decode(message.data.slice(10, 17))
      };
    });
  }
  
  setICB(address, data) {
    // Encode data
    let dataEncoded = new Uint8Array(this._getBlockLength(WersiClient.BLOCK_TYPE.ICB));
    let dv = new DataView(dataEncoded.buffer);
    dv.setUint8(0, data.get('nextInstrumentAddress'));
    
    dv.setUint8(1, data.get('vcfAddress'));
    dv.setUint8(2, data.get('amplAddress'));
    dv.setUint8(3, data.get('freqAddress'));
    dv.setUint8(4, data.get('waveAddress'));
    
    dv.setUint8(5,
        (data.get('dynamics') & 0x03)
      | (data.get('voiceSelectLower') ? 0x04 : 0)
      | (data.get('voiceSelectUpper') ? 0x08 : 0)
    );
    dv.setUint8(6,
        (data.get('routeLeft') ? 0x01 : 0)
      | (data.get('routeRight') ? 0x02 : 0)
      | (data.get('routeBright') ? 0x04 : 0)
      | (data.get('routeVCF') ? 0x08 : 0)
      | (data.get('routeWV') ? 0x10 : 0)
    );
    dv.setInt8(7, data.get('transpose'));
    dv.setInt8(8, data.get('detune'));
    dv.setUint8(9,
        (data.get('wvMode') & 0x07)
      | (data.get('wvLeft') ? 0x08 : 0)
      | (data.get('wvRight') ? 0x10 : 0)
      | (data.get('wvFeedbackStereoFlat') ? 0x40 : 0)
      | (data.get('wvFeedbackDeep') ? 0x80 : 0)
    );
    dataEncoded.set(new TextEncoder("utf-8").encode(data.get('name')), 10);
    
    return this.send(
      this._toSysEx({
        type: WersiClient.BLOCK_TYPE.ICB.charCodeAt(0),
        address: address,
        length: dataEncoded.length,
        data: dataEncoded
      }), true)
      .then((status) => {
        return status;
      });
  }

  getAmpl(address) {
    return this._requestBlock(WersiClient.BLOCK_TYPE.AMPL, address)
    .then((message) => {
      console.log("SysEx AMPL receive: " + this._utohex(message.data));

      // Verify AMPL length
      const blockLength = this._getBlockLength(WersiClient.BLOCK_TYPE.AMPL);
      if (message.length != blockLength) {
        throw "Invalid message length for AMPL (got " + message.length + ", expected " + blockLength + ")";
      }
      
      return message.data;
    });
  }
  
  setAmpl(address, data) {
    return this.send(
      this._toSysEx({
        type: WersiClient.BLOCK_TYPE.AMPL.charCodeAt(0),
        address: address,
        length: data.length,
        data: data
      }), true)
      .then((status) => {
        return status;
      });
  }
    
  getFixWave(address) {
    return this._requestBlock(WersiClient.BLOCK_TYPE.FIXWAVE, address)
    .then((message) => {
      console.log("SysEx FIXWAVE receive");

      // Verify FIXWAVE length
      const blockLength = this._getBlockLength(WersiClient.BLOCK_TYPE.FIXWAVE);
      if (message.length != blockLength) {
        throw "Invalid message length for FIXWAVE (got " + message.length + ", expected " + blockLength + ")";
      }
      
      // Decode FIXWAVE
      let wave = {};
      {
        let i = 1;
        let dv = new DataView(message.data.buffer);
        
        // Wave level
        wave.level = (message.data[0] & 0x7F) | 0;
        
        // Whether the wave uses fixed formants
        wave.fixedFormant = (message.data[0] & 0x80) ? true : false;
        
        // Split wave data
        wave.bassData =     Array.from({ length: 64 }).map(() => { return dv.getUint8(i++); });
        wave.tenorData =    Array.from({ length: 64 }).map(() => { return dv.getUint8(i++); });
        wave.altoData =     Array.from({ length: 32 }).map(() => { return dv.getUint8(i++); });
        wave.sopranoData =  Array.from({ length: 16 }).map(() => { return dv.getUint8(i++); });
        
        // Fixed formant data
        wave.fixedFormantData = Array.from({ length: 35 }).map(() => { return dv.getUint8(i++); });
      }
      return wave;
    });
  }
  
  setFixWave(address, wave) {
    // Encode FIXWAVE
    let data = new Uint8Array(this._getBlockLength(WersiClient.BLOCK_TYPE.FIXWAVE));
    let dv = new DataView(data.buffer);
    {
      let i = 1;
      
      data[0] = wave.level & 0x7F;
      
      if (wave.fixedFormant) {
        data[0] |= 0x80;
      }
      
      for(let j = 0; j < 64; ++j) {
        dv.setUint8(i++, wave.bassData[j]);
      }
      for(let j = 0; j < 64; ++j) {
        dv.setUint8(i++, wave.tenorData[j]);
      }
      for(let j = 0; j < 32; ++j) {
        dv.setUint8(i++, wave.altoData[j]);
      }
      for(let j = 0; j < 16; ++j) {
        dv.setUint8(i++, wave.sopranoData[j]);
      }
      for(let j = 0; j < 35; ++j) {
        dv.setUint8(i++, wave.fixedFormantData[j]);
      }
    }
    
    return this.send(
      this._toSysEx({
        type: WersiClient.BLOCK_TYPE.FIXWAVE.charCodeAt(0),
        address: address,
        length: data.length,
        data: data
      }), true)
      .then((status) => {
        return status;
      });
  }
  
  reloadInstrument(address) {
    console.log('ACHTUNG reload ' + address);
    // Check if address actually refers to a RAM voice
    address -= 66;
    if (address < 0 || address >= 20) {
      throw "Address " + address + " not in RAM voice range.";
    }
    
    // Reload an instrument by forcing the instrument switch of that particular address to toggle
    return this.send(
      this._toSysEx({
        type: WersiClient.BLOCK_TYPE.SWITCH.charCodeAt(0),
        address: 0,
        length: 1,
        data: new Uint8Array([38 + address])
      }), true)
      .then((status) => {
        return status;
      });
  }
}
