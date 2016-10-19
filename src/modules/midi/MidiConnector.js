export default class MidiConnector {
  constructor() {
    this.ws = null;
    this.connected = false;
  }

  _onMessage() {}
  _onError() {}
  
  isConnected() {
    return this.connected;
  }
  
  open(url) {
    return new Promise((resolve, reject) => {
      this.connected = false;
      this.ws = new WebSocket(url);
    
      // Handlers
      this.ws.onopen = (event) => {
        this.connected = true;
        resolve();
      };
      this.ws.onclose = (event) => {
        this.connected = false;
        this.ws = null;
      };
      this.ws.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
          this._onMessage(message);
        }
        catch (e) {
          console.error("Websocket error: failed to decode message.");
          console.error(e);
          console.error(event.data);
        }
      };
      this.ws.onerror = (event) => {
        this._onError();
      };
    });
  }
  
  close() {
    this.ws.close();
    this.connected = false;
    this.ws = null;
  }
  
  send(json) {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(json));
    }
    else {
      console.error("Websocket error: not connected while trying to send.");
    }
  }
}
