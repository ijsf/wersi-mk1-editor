import WebMidi from 'webmidi';

/**
 * Client
 *
 * Implements a Web MIDI API client.
 * Only handles a single Promise-based request at a time; new requests are queued up and handled accordingly.
 */
export default class Client {
  constructor() {
    // Deferred promise resolve and reject callbacks
    this.deferred = null;
    
    // List of queued requests
    this.queue = [];

    // Connected state
    this.connected = false;

    // WebMIDI API instances
    this.portIn = null;
    this.portOut = null;
  }
  
  _processQueue() {
    let request = this.queue.shift();
    this.deferred = request;
    if (request) {
      this._sysexSend(request.send);
    }
  }
  
  _shouldIgnoreAck() {
    if (this.deferred) {
      return this.deferred.ignoreAck;
    }
    else {
      // Unexpected, just ignore
    }
    return false;
  }
  
  _resolve(object) {
    // Call deferred callback
    if (this.deferred) {
      this.deferred.resolve(object);
      this.deferred = null;
    }
    else {
      // Unexpected, just ignore
    }
    // Handle next message in queue, if any
    this._processQueue();
  }
  
  _reject(object) {
    // Call deferred callback
    if (this.deferred) {
      this.deferred.reject(object);
      this.deferred = null;
    }
    else {
      console.error('Trying to resolve but no promise was deferred.');
    }
    // Handle next message in queue, if any
    this._processQueue();
  }

  // Returns whether the received SysEx message is valid and should be further processed
  isValid(message) {
    return true;
  }
  
  send(u8, ack, resend) {
    return new Promise((resolve, reject) => {
      if (this.portOut !== null) {
        const request = {
          ignoreAck: ack ? false : true,
          resolve: resolve,
          reject: reject,
          send: u8
        };
        // Check if we are currently processing another message, in which case the request will be queued
        if (this.deferred) {
          this.queue.push(request);
        }
        else {
          this.deferred = request;
          this._sysexSend(request.send);
        }
      }
      else {
        reject('Invalid port.');
      }
    });
  }

  _sysexSend(u8) {
    // Send raw SysEx
    this.portOut.send(0xF0, Array.from(u8.slice(1)));

    // ACK logic (no longer necessary with WebMIDI, so emulate here)
    if (!this._shouldIgnoreAck()) {
      // Use acknowledgement
      this._resolve((u8));
    }
  }

  setPorts(portIn, portOut) {
    // Communicate input port
    return new Promise((resolve, reject) => {
      if (!this.portIn && !this.portOut) {
        // Set API instances
        this.portIn = WebMidi.inputs[portIn];
        this.portOut = WebMidi.outputs[portOut];

        // Input: listen on all channels for sysex messages
        this.portIn.addListener('sysex', 'all', (event) => {
          let data = (event.data);
          if (this.isValid(data)) {
            this._resolve(data);
          }
        });
        resolve();
      }
      else {
        reject('Invalid ports');
      }
    });
  }

  isConnected() {
    return this.connected;
  }
  
  open() {
    return new Promise((resolve, reject) => {
      this.connected = false;

      // Enable WebMIDI with sysex support
      WebMidi.enable((error) => {
        if (error) {
          // Could not enable WebMIDI
          reject(error);
        }
        else {
          // WebMIDI enabled, resolve and pass inputs and outputs
          this.connected = true;
          resolve({ inports: WebMidi.inputs, outports: WebMidi.outputs });
        }
      }, true);
    });
  }

  close() {
    if (this.input && this.output) {
      // Remove input listener
      this.input.removeListener('sysex', 'all');
      this.connected = false;
    }
  }
}
