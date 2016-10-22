import React, { Component } from 'react';
import { Grid, Row, Col, PageHeader } from 'react-bootstrap';
import ReactTooltip from 'react-tooltip'

import Instrument from 'components/Instrument';
import WersiClient from 'modules/midi/WersiClient';
import MidiConfig from 'components/MidiConfig';

export default class WersiApp extends Component {
  constructor() {
    super();
    
    // Instrument reference
    this.instrument = null;
    
    // Create Wersi device client
    this.client = new WersiClient();
  }
  
  componentWillMount() {
  }
  
  render() {
    let midiConfig = (<MidiConfig
      client={this.client}
      url={"ws://localhost:9002"}
      token={"5UOfQAtnjnNIaZUWzpX2LLBkHNxrXALECEpj0ssklTM7ptYCuSOVQNn0qemO8Zat"}
      populateCallback={() => {
        if (this.instrument) {
          this.instrument.ready();
        }
      }}
    />);
    
    return (
      <div>
        <PageHeader>
          Wersi MK1/EX20 editor
        </PageHeader>
        {midiConfig}
        <Instrument
          instrumentAddress={WersiClient.ADDRESS.CV(0)}
          client={this.client}
          ref={(ref) => {
            this.instrument = ref;
          }}
          />
      </div>
    );
  }
}
