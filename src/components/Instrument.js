import React, { Component } from 'react';
import { Grid, Row, Col } from 'react-bootstrap';
import ReactTooltip from 'react-tooltip'

import InstrumentControl from 'components/InstrumentControl';
import FilterControl from 'components/FilterControl';
import EnvelopeControl from 'components/EnvelopeControl';
import WaveControl from 'components/WaveControl';
import WersiClient from 'modules/midi/WersiClient';

import reactMixin from 'react-mixin';
import reactor from 'modules/flux';
import { toImmutable } from 'nuclear-js';

import { actions as instrumentActions, getters as instrumentGetters } from 'modules/instrument';

class Instrument extends Component {
  constructor() {
    super();
  }
  
  getDataBindings() {
    return {
      icb: instrumentGetters.byId(this.props.instrumentAddress, 'icb')
    };
  }
  
  populate() {
    //
    // Although the Wersi supports a very flexible ICB with block pointers,
    // we simply use a very naive 1-to-1 RAM address mapping for all instruments,
    // as described in the Wersi manual.
    //
    // Instrument 65 is the inaccessible drawbar instrument, and thus ignored.
    //
    // Instrument 66 uses VCF 65, AMPL 65, FREQ 65, FIXWAVE 65 for 1st voice and 87, 86, 86, 86 for 2nd voice.
    // Instrument 67 uses VCF 66, AMPL 66, FREQ 66, FIXWAVE 66 for 1st voice and 88, 87, 87, 87 for 2nd voice.
    // etc.
    //
    // This leaves everything in RAM and unique to each instrument,
    // just the way we want it.
    //
    
    this.props.client.getICB(this.props.instrumentAddress).then((data) => {
      instrumentActions.update(this.props.instrumentAddress, 'icb', toImmutable(data));
      console.log(JSON.stringify(data));
      
      const { waveAddress, amplAddress, freqAddress, vcfAddress } = data;
      
      // Load data for this ICB
      this.props.client.getVCF(vcfAddress).then((data) => {
        instrumentActions.update(vcfAddress, 'vcf', toImmutable(data));
      });
      this.props.client.getFixWave(waveAddress).then((data) => {
        instrumentActions.update(waveAddress, 'wave', toImmutable(data));
      });
      this.props.client.getAmpl(amplAddress).then((data) => {
        instrumentActions.update(amplAddress, 'ampl', toImmutable(data));
      });
    });
  }
  
  render() {
    const { instrumentAddress } = this.props;
    const { icb } = this.state;
    
    // Only construct everything once we have the ICB
    // (these components have data bindings dependent on properties set here, which cannot be changed after mounting)
    let instrumentControl = null, filterControl = null, waveControl = null, envelopeControl = null;
    if (icb) {
      instrumentControl = (<InstrumentControl
        instrumentAddress={this.props.instrumentAddress}
        client={this.props.client}
      />);
      filterControl = (<FilterControl
        instrumentAddress={this.props.instrumentAddress}
        vcfAddress={icb ? icb.get('vcfAddress') : 0}
        client={this.props.client}
      />);
      waveControl = (<WaveControl
        instrumentAddress={this.props.instrumentAddress}
        waveAddress={icb ? icb.get('waveAddress') : 0}
        client={this.props.client}
      />);
      envelopeControl = (<EnvelopeControl
        instrumentAddress={this.props.instrumentAddress}
        amplAddress={icb ? icb.get('amplAddress') : 0}
        freqAddress={icb ? icb.get('freqAddress') : 0}
        client={this.props.client}
      />);
    }
    
    return (
      <div>
        <Grid>
          <Row>
            <Col xsHidden={true} smHidden={true} mdHidden={true} lg={2}>
              <p>
                Description
              </p>
            </Col>
            <Col lg={10}>
              {instrumentControl}
            </Col>
          </Row>
          <Row>
            <Col xsHidden={true} smHidden={true} mdHidden={true} lg={2}>
              <p>
                Description
              </p>
            </Col>
            <Col lg={10}>
              {filterControl}
            </Col>
          </Row>
          <Row>
            <Col xsHidden={true} smHidden={true} mdHidden={true} lg={2}>
              <p>
                Description
              </p>
            </Col>
            <Col lg={10}>
              {waveControl}
            </Col>
          </Row>
          <Row>
            <Col xsHidden={true} smHidden={true} mdHidden={true} lg={2}>
              <hr/>
              <p>
                Envelopes of a voice are configured by chaining one or more modules after one another.
              </p>
              <p>
                The amplitude and frequency envelopes respectively modulate the amplitude and frequency or pitch over time.
              </p>
              <p>
                You can drag any of the modules, or add any new modules by using the add button.
              </p>
            </Col>
            <Col lg={10}>
              {envelopeControl}
            </Col>
          </Row>
        </Grid>
      </div>
    );
  }
}

reactMixin.onClass(Instrument, reactor.ReactMixin);
export default Instrument;
