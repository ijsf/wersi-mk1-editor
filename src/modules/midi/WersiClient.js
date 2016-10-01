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
  
  constructor() {
    super();
    
    // Determine block lengths (in bytes)
    this.blockLength = {};
    this.blockLength[WersiClient.BLOCK_TYPE.ICF] = 16;
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
    let message = {}, i = 0;
    
    // Validate MIDI SysEx header
    if (sysex[i++] != 0xF0 || sysex[i++] != 0x25 || sysex[i++] != this.deviceId) {
      throw "Invalid SysEx message: " + this._utohex(sysex);
    }
    
    // Parse Wersi specific content
    message.type = this._ntou(3, sysex[i++], sysex[i++]);
    message.address = this._ntou(2, sysex[i++], sysex[i++]);
    message.length = this._ntou(1, sysex[i++], sysex[i++]);
    
    // Calculate expected (byte non-nibble) length
    const expectedLength = (sysex.length - i - 1) / 2;
    if (expectedLength != message.length) {
      throw "Invalid SysEx length (got " + message.length + ", expected " + expectedLength + "): " + this._utohex(sysex);
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
  
  getFixWave(address) {
    return this._requestBlock(WersiClient.BLOCK_TYPE.FIXWAVE, address)
    .then((message) => {
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
    // Check if address actually refers to a RAM voice
    address -= 65;
    if (address < 0 || address >= 10) {
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
