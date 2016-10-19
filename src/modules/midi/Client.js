import MidiConnector from './MidiConnector';

/**
 * Client
 *
 * Implements a Websocket client for sysexd.
 * Only handles a single Promise-based request at a time; new requests are queued up and handled accordingly.
 */
export default class Client extends MidiConnector {
  constructor() {
    super();
    
    // Set variables
    this.portOut = null;
    
    // Deferred promise resolve and reject callbacks
    this.deferred = null;
    
    // List of queued requests
    this.queue = [];
  }
  
  _processQueue() {
    let request = this.queue.shift();
    this.deferred = request;
    if (request) {
      super.send(request.send);
    }
  }
  
  _process(request) {
    // Check if we are currently processing another message, in which case the request will be queued
    if (this.deferred) {
      this.queue.push(request);
    }
    else {
      this.deferred = request;
      super.send(request.send);
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
      console.error("Trying to resolve but no promise was deferred.");
    }
    // Handle next message in queue, if any
    this._processQueue();
  }

  _onMessage(object) {
    // Handle error types
    if (object.type == "midierrorin") {
      console.error("Midi in error: " + object.data);
      this._reject(object);
    }
    else if (object.type == "midierrorout") {
      console.error("Midi out error: " + object.data);
      this._reject(object);
    }
    else if (object.type == "send") {
      if (this._shouldIgnoreAck()) {
        // Ignore acknowledgement unless failure, in which case we will reject our send promise
        // We assume that the actual data will come in later through midimessage.
        if (!object.data) {
          this._reject({ type: "send" });
        }
      }
      else {
        // Use acknowledgement
        this._resolve(object.data);
      }
    }
    else if (object.type == "midimessage") {
      let u8 = new Uint8Array(atob(object.data).split("").map((c) => { return c.charCodeAt(0); }));
      if (this.isValid(u8)) {
        this._resolve(u8);
      }
    }
    else {
      this._resolve(object.data);
    }
  }
  
  // Returns whether the received SysEx message is valid and should be further processed
  isValid(message) {
    return true;
  }
  
  _onError() {
    console.error("Websocket error");
    this._reject({ type: "websocket" });
  }
  
  setPorts(portIn, portOut) {
    // Set output port immediately
    this.portOut = portOut;
    
    // Communicate input port
    return new Promise((resolve, reject) => {
      this._process({
        ignoreAck: false,
        resolve: resolve,
        reject: reject,
        send: {
          token: this.token,
          type: 'inport',
          port: portIn
        }
      });
    });
  }
  
  query() {
    return new Promise((resolve, reject) => {
      this._process({
        ignoreAck: false,
        resolve: resolve,
        reject: reject,
        send: {
          token: this.token,
          type: 'query'
        }
      });
    });
  }
  
  send(u8, ack, resend) {
    return new Promise((resolve, reject) => {
      if (this.portOut !== null) {
        this._process({
          ignoreAck: ack ? false : true,
          resolve: resolve,
          reject: reject,
          send: {
            token: this.token,
            type: 'send',
            port: this.portOut,
            resend: resend ? true : false,
            data: btoa(String.fromCharCode.apply(null, u8))
          }
        });
      }
      else {
        reject("Invalid port.");
      }
    });
  }
  
  open(url, token) {
    return new Promise((resolve, reject) => {
      this.token = token;
      if (!this.deferred && !this.isConnected()) {
        this.deferred = { resolve: resolve, reject: reject };
        resolve(super.open(url).then(() => {
          this.deferred = null;
        }));
      }
      else {
        reject("Already connected");
      }
    });
  }
}
