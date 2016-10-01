import React, { Component } from 'react';
import MidiConfig from 'components/MidiConfig';
import InstrumentControl from 'components/InstrumentControl';
import EnvelopeControl from 'components/EnvelopeControl';
import WaveControl from 'components/WaveControl';
import WersiClient from 'modules/midi/WersiClient';

export default class WersiApp extends Component {
  constructor() {
    super();
    
    this.state = {
      instrumentId: 65
    };
    
    // Create Wersi device client
    this.client = new WersiClient();
  }
  
  componentWillMount() {
  }
  
  render() {
    const { instrumentId } = this.state;
    
    let midiConfig = (<MidiConfig
      client={this.client}
      url={"ws://localhost:9002"}
      token={"5UOfQAtnjnNIaZUWzpX2LLBkHNxrXALECEpj0ssklTM7ptYCuSOVQNn0qemO8Zat"}
    />);
    
    return (
      <div>
        {midiConfig}
        <InstrumentControl
          instrumentId={instrumentId}
          client={this.client}
        />
        <WaveControl
          instrumentId={instrumentId}
          client={this.client}
        />
        <EnvelopeControl
          instrumentId={instrumentId}
          client={this.client}
        />
      </div>
    );
  }
}
