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
          icon="volume-up"
        />
        <Envelope
          title="Frequency envelope"
          icon="music"
        />
      </div>
    );
  }
}
