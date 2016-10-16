import React, { Component } from 'react';
import Envelope from 'components/Envelope';

export default class EnvelopeControl extends Component {
  constructor() {
    super();
  }
  
  componentWillMount() {
  }
  
  render() {
    return (
      <div>
        <Envelope
          title="Amplitude envelope"
          type="ampl"
          icon="volume-up"
          instrumentId={this.props.amplAddress}
          client={this.props.client}
        />
        <Envelope
          title="Frequency envelope"
          type="freq"
          icon="music"
          instrumentId={this.props.freqAddress}
          client={this.props.client}
        />
      </div>
    );
  }
}
