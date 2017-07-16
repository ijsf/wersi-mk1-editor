import React, { Component } from 'react';
import Envelope from 'components/Envelope';

import keydown from 'react-keydown';

export default class EnvelopeControl extends Component {
  constructor() {
    super();
    
    // References
    this._envelopeAmpl = null;
    this._envelopeFreq = null;

    // Use global modules variable to allow simple communication between modules
    window.envelopeModules = {};
  }
  
  componentWillMount() {
  }
  
  // A will save amplitude envelope
  @keydown('a')
  hotKeyAmpl() {
    if (this._envelopeAmpl) {
      // NOTE: this is a hacky anti-pattern!
      this._envelopeAmpl.getDecoratedComponentInstance().getDecoratedComponentInstance()._handleSave();
    }
  }
  
  // F will save frequency envelope
  @keydown('f')
  hotKeyFreq() {
    // NOTE: this is a hacky anti-pattern!
    this._envelopeFreq.getDecoratedComponentInstance().getDecoratedComponentInstance()._handleSave();
  }
  
  render() {
    return (
      <div>
        <Envelope
          title="Amplitude envelope"
          type="ampl"
          moduleSlots={7}
          firstInstrumentAddress={this.props.firstInstrumentAddress}
          instrumentAddress={this.props.instrumentAddress}
          envAddress={this.props.amplAddress}
          client={this.props.client}
          ref={(ref) => this._envelopeAmpl = ref}
          hotKeySave="A"
        />
        <Envelope
          title="Frequency envelope"
          type="freq"
          moduleSlots={5}
          firstInstrumentAddress={this.props.firstInstrumentAddress}
          instrumentAddress={this.props.instrumentAddress}
          envAddress={this.props.freqAddress}
          client={this.props.client}
          ref={(ref) => this._envelopeFreq = ref}
          hotKeySave="F"
        />
      </div>
    );
  }
}
