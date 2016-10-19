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
    
    this.state = {
      instrumentAddresses: toImmutable([])
    };
  }
  
  getDataBindings() {
    return {
      icb: instrumentGetters.byId(this.props.instrumentAddress, 'icb')
    };
  }
  
  ready() {
    const instrumentAddress = this.state.instrumentAddresses.last();
    this.populate(instrumentAddress);
  }
  
  populate(instrumentAddress, callback) {
    this.props.client.getICB(instrumentAddress).then((data) => {
      instrumentActions.update(instrumentAddress, 'icb', toImmutable(data));
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
      
      // Call callback if possible
      if (callback) {
        callback();
      }
    });
  }
  
  _handlePrevInstrument() {
    // Pop last instrument
    this.setState((state) => {
      return {
        instrumentAddresses: state.instrumentAddresses.pop()
      };
    });
  }
  
  _handleNextInstrument(nextInstrumentAddress) {
    // Populate new instrument
    this.populate(nextInstrumentAddress, () => {
      // Push given instrument
      this.setState((state) => {
        return {
          instrumentAddresses: state.instrumentAddresses.push(nextInstrumentAddress)
        };
      });
    });
  }
  
  _handleNewInstrument(newInstrumentAddress) {
  }
  
  componentWillMount() {
    this.setState((state) => {
      // First instrument address is always the original instrumentAddress from the props
      return {
        instrumentAddresses: toImmutable([ this.props.instrumentAddress ])
      };
    });
  }
  
  render() {
    const { icb, instrumentAddresses } = this.state;

    // Get instrument address
    const instrumentAddress = instrumentAddresses.last();
    
    // Only construct everything once we have the ICB
    // (these components have data bindings dependent on properties set here, which cannot be changed after mounting)
    let instrumentControl = null, filterControl = null, waveControl = null, envelopeControl = null;
    if (icb) {
      instrumentControl = (<InstrumentControl
        instrumentAddresses={instrumentAddresses}
        instrumentAddress={instrumentAddress}
        handleNextInstrument={this._handleNextInstrument.bind(this)}
        handlePrevInstrument={this._handlePrevInstrument.bind(this)}
        handleNewInstrument={this._handleNewInstrument.bind(this)}
        client={this.props.client}
      />);
      filterControl = (<FilterControl
        instrumentAddress={instrumentAddress}
        vcfAddress={icb ? icb.get('vcfAddress') : 0}
        client={this.props.client}
      />);
      waveControl = (<WaveControl
        instrumentAddress={instrumentAddress}
        waveAddress={icb ? icb.get('waveAddress') : 0}
        client={this.props.client}
      />);
      envelopeControl = (<EnvelopeControl
        instrumentAddress={instrumentAddress}
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
