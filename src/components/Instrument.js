import React, { Component } from 'react';
import { Grid, Row, Col } from 'react-bootstrap';
import ReactTooltip from 'react-tooltip'
import { Notification } from 'react-notification';

import InstrumentControl from 'components/InstrumentControl';
import FilterControl from 'components/FilterControl';
import EnvelopeControl from 'components/EnvelopeControl';
import WaveControl from 'components/WaveControl';
import WersiClient from 'modules/midi/WersiClient';

import reactor from 'modules/flux';
import { toImmutable } from 'nuclear-js';

import { actions as instrumentActions, getters as instrumentGetters } from 'modules/instrument';

export default class Instrument extends Component {
  constructor() {
    super();
    
    this.state = {
      instrumentAddresses: toImmutable([]),
      error: null
    };
  }
  
  _watch(id, type) {
    const getter = instrumentGetters.byId(id, type);
    
    // Unwatch if possible
    this._unwatch();
    
    // Add observer
    this._unwatchFn = reactor.observe(getter, (v) => {
      this.setState((state) => {
        state[type] = v;
        return state;
      });
    });
    // Get initial data
    this.setState((state) => {
      state[type] = reactor.evaluate(getter);
      return state;
    });
  }
  _unwatch() {
    // Remove observer if it exists
    if (this._unwatchFn) {
      this._unwatchFn();
    }
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
    }, () => {
      const instrumentAddress = this.state.instrumentAddresses.last();
      this._watch(instrumentAddress, 'icb');
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
      }, () => {
        const instrumentAddress = this.state.instrumentAddresses.last();
        this._watch(instrumentAddress, 'icb');
      });
    });
  }
  
  _handleSetInstrument(instrumentAddress) {
    // Populate new instrument
    this.populate(instrumentAddress, () => {
      // Push given instrument
      this.setState((state) => {
        return {
          instrumentAddresses: toImmutable([ instrumentAddress ])
        };
      }, () => {
        this._watch(instrumentAddress, 'icb');
      });
    });
  }
  
  _showError(error) {
    this.setState({ error: error });
  }
  
  componentWillUnmount() {
    this._unwatch();
  }
  
  componentWillMount() {
    this.setState((state) => {
      // First instrument address is always the original instrumentAddress from the props
      return {
        instrumentAddresses: toImmutable([ this.props.instrumentAddress ])
      };
    }, () => {
      this._watch(this.props.instrumentAddress, 'icb');
    });
  }
  
  render() {
    const { icb, instrumentAddresses, error } = this.state;

    // Get instrument address
    const instrumentAddress = instrumentAddresses.last();
    const firstInstrumentAddress = instrumentAddresses.first();
    
    // Only construct everything once we have the ICB
    // (these components have data bindings dependent on properties set here, which cannot be changed after mounting)
    let instrumentControl = null, filterControl = null, waveControl = null, envelopeControl = null;
    if (icb) {
      instrumentControl = (<InstrumentControl
        instrumentAddresses={instrumentAddresses}
        firstInstrumentAddress={firstInstrumentAddress}
        instrumentAddress={instrumentAddress}
        handleNextInstrument={this._handleNextInstrument.bind(this)}
        handlePrevInstrument={this._handlePrevInstrument.bind(this)}
        handleSetInstrument={this._handleSetInstrument.bind(this)}
        showError={this._showError.bind(this)}
        client={this.props.client}
      />);
      filterControl = (<FilterControl
        instrumentAddress={instrumentAddress}
        firstInstrumentAddress={firstInstrumentAddress}
        vcfAddress={icb ? icb.get('vcfAddress') : 0}
        showError={this._showError.bind(this)}
        client={this.props.client}
      />);
      waveControl = (<WaveControl
        instrumentAddress={instrumentAddress}
        firstInstrumentAddress={firstInstrumentAddress}
        waveAddress={icb ? icb.get('waveAddress') : 0}
        showError={this._showError.bind(this)}
        client={this.props.client}
      />);
      envelopeControl = (<EnvelopeControl
        instrumentAddress={instrumentAddress}
        firstInstrumentAddress={firstInstrumentAddress}
        amplAddress={icb ? icb.get('amplAddress') : 0}
        freqAddress={icb ? icb.get('freqAddress') : 0}
        showError={this._showError.bind(this)}
        client={this.props.client}
      />);
      console.log('ACHTUNG ' + JSON.stringify(icb.toJS()));
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
                The sound of a voice is defined by means of a wavetable, representing one period of the sound wave.
                Each voice contains four wavetables which are used for different octave ranges: bass (lowest pitch, first wavetable to the right), tenor, alto, soprano (highest pitch, last wavetable).
              </p>
              <p>
                The sound can be shaped by dragging the points of each of the wavetables up or down.
              </p>
              <p>
                By layering multiple voices (see above) you will also be able to play multiple wavetables in parallel.
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
        <Notification
          isActive={error !== null}
          message={(error !== null) ? error : ""}
          onDismiss={() => this.setState({ error: null })}
          barStyle={{ fontSize: 16, zIndex: 9999, backgroundColor: '#e9322d', borderColor: '#e82924', opacity: 0.9 }}
        />
      </div>
    );
  }
}
