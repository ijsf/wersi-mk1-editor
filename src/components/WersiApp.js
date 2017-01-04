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
        <div className="page-header">
          <h1 style={{float: 'left'}}>
            MK1 editor
            <sub>{this.props.version}</sub>
          </h1>
          <h1 style={{float: 'right'}}>
            wer.si
          </h1>
          <hr style={{border: 0, clear: 'both'}}/>
        </div>
        {midiConfig}
        <Instrument
          instrumentAddress={WersiClient.ADDRESS.CV(0)}
          client={this.client}
          ref={(ref) => {
            this.instrument = ref;
          }}
        />
        <footer className="page-footer">
          <p>
            This software is no way affiliated with, authorized, maintained, sponsored or endorsed with Wersi nor any of its affiliates or subsidiaries.
          </p>
          <p>
            Available as open source software under the <a href="https://raw.githubusercontent.com/ijsf/wersi-mk1-editor/master/LICENSE">AGPLv3</a> license @ <a href="http://wer.si">wer.si</a>.
          </p>
        </footer>
      </div>
    );
  }
}
