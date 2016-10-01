import React, { Component } from 'react';
import { Grid, Row, Col } from 'react-bootstrap';
import ReactTooltip from 'react-tooltip'

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
    
    let midiConfig = null; /*(<MidiConfig
      client={this.client}
      url={"ws://localhost:9002"}
      token={"5UOfQAtnjnNIaZUWzpX2LLBkHNxrXALECEpj0ssklTM7ptYCuSOVQNn0qemO8Zat"}
    />);*/
    
    // Tooltip support
    let tooltip = (<ReactTooltip />);
    
    return (
      <div>
        {midiConfig}
        {tooltip}
        <Grid>
          <Row>
            <Col xsHidden={true} smHidden={true} mdHidden={true} lg={2}>
              <p>
                Description
              </p>
            </Col>
            <Col lg={10}>
              <InstrumentControl
                instrumentId={instrumentId}
                client={this.client}
              />
            </Col>
          </Row>
          <Row>
            <Col xsHidden={true} smHidden={true} mdHidden={true} lg={2}>
              <p>
                Description
              </p>
            </Col>
            <Col lg={10}>
              <WaveControl
                instrumentId={instrumentId}
                client={this.client}
              />
            </Col>
          </Row>
          <Row>
            <Col xsHidden={true} smHidden={true} mdHidden={true} lg={2}>
              <p>
                Description
              </p>
            </Col>
            <Col lg={10}>
              <EnvelopeControl
                instrumentId={instrumentId}
                client={this.client}
              />
            </Col>
          </Row>
        </Grid>
      </div>
    );
  }
}
