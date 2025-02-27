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
    return this.populate(instrumentAddress);
  }
  
  populate(instrumentAddress) {
    return this.props.client.getICB(instrumentAddress).then((data) => {
      instrumentActions.update(instrumentAddress, 'icb', toImmutable(data));
      
      const { waveAddress, amplAddress, freqAddress, vcfAddress } = data;
      
      // Load data for this ICB
      this.props.client.getVCF(vcfAddress).then((data) => {
        instrumentActions.update(vcfAddress, 'vcf', toImmutable(data));
      });
      this.props.client.getFixWave(waveAddress).then((data) => {
        instrumentActions.update(waveAddress, 'wave', toImmutable(data));
      });
      this.props.client.getEnvelope('ampl', amplAddress).then((data) => {
        instrumentActions.update(amplAddress, 'ampl', toImmutable(data));
      });
      this.props.client.getEnvelope('freq', freqAddress).then((data) => {
        instrumentActions.update(amplAddress, 'freq', toImmutable(data));
      });
    });
  }
  
  _handlePrevInstrument() {
    const newInstrumentAddresses = this.state.instrumentAddresses.pop();
    const prevInstrumentAddress = newInstrumentAddresses.last();
    
    // Populate instrument
    return this.populate(prevInstrumentAddress).then(() => {
      // Update instrumentAddresses
      this.setState((state) => {
        return {
          instrumentAddresses: newInstrumentAddresses
        };
      }, () => {
        this._watch(prevInstrumentAddress, 'icb');
      });
    });
  }
  
  _handleNextInstrument(nextInstrumentAddress) {
    // Populate instrument
    return this.populate(nextInstrumentAddress).then(() => {
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
    return this.populate(instrumentAddress).then(() => {
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
    const instrumentAddress = icb ? instrumentAddresses.last() : null;
    const firstInstrumentAddress = icb ? instrumentAddresses.first() : null;
    
    if (icb) {
      console.log('ICB ' + JSON.stringify(icb.toJS()));
    }
    
    return (
      <div>
        <Grid>
          <Row>
            <Col xsHidden={true} smHidden={true} mdHidden={true} lg={2}>
              <hr/>
              <p>
                20 Control Voices (CV) are typically composed of up to 2 (voice) layers,
                each containing their own wavetables and envelopes.
              </p>
              <p>
                Velocity dynamics, tuning and output routing can also be configured for each voice.
              </p>
              <p>
                In double layer mode (default), only the first 10 CVs are available,
                but CVs can now contain up to 4 (voice) layers each.
              </p>
            </Col>
            <Col lg={10}>
              <InstrumentControl
                instrumentAddresses={instrumentAddresses}
                firstInstrumentAddress={firstInstrumentAddress}
                instrumentAddress={instrumentAddress}
                handleNextInstrument={this._handleNextInstrument.bind(this)}
                handlePrevInstrument={this._handlePrevInstrument.bind(this)}
                handleSetInstrument={this._handleSetInstrument.bind(this)}
                showError={this._showError.bind(this)}
                client={this.props.client}
              />
            </Col>
          </Row>
          <Row>
            <Col xsHidden={true} smHidden={true} mdHidden={true} lg={2}>
              <hr/>
              <p>
                A single Voltage Controlled Filter (VCF) is available for low-pass or band-pass filtering,
                noise and distortion effects.
              </p>
              <p>
                Each voice with VCF output is summed and fed into the VCF.
              </p>
              <p>
                Tracking allows the VCF to adjust its frequency based on the pitch of every played note.
              </p>
              <p>
                The VCF frequency is optionally modulated with a two-phase envelope,
                which can also be retriggered on each note.
              </p>
            </Col>
            <Col lg={10}>
              <FilterControl
                instrumentAddress={instrumentAddress}
                firstInstrumentAddress={firstInstrumentAddress}
                vcfAddress={icb ? icb.get('vcfAddress') : 0}
                showError={this._showError.bind(this)}
                client={this.props.client}
              />
            </Col>
          </Row>
          <Row>
            <Col xsHidden={true} smHidden={true} mdHidden={true} lg={2}>
              <hr/>
              <p>
                The sound of each voice layer is first defined by a wavetable, or periodic waveform that represents one period of the sound wave.
              </p>
              <p>
                Four wavetables are used, corresponding to four different octave ranges from bass (lowest), tenor, alto to soprano (highest).
              </p>
              <p>
                Wavetables can be (simultaneously) changed by dragging the points up or down.
              </p>
              <p>
                Sound can be further defined by formant synthesis on a limited key range between A#2 and F-5.
              </p>
              <p>
                When enabled, drag the formant sliders to shape the sound of each individual key or all keys at once.
              </p>
            </Col>
            <Col lg={10}>
              <WaveControl
                instrumentAddress={instrumentAddress}
                firstInstrumentAddress={firstInstrumentAddress}
                waveAddress={icb ? icb.get('waveAddress') : 0}
                showError={this._showError.bind(this)}
                client={this.props.client}
              />
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
              <EnvelopeControl
                instrumentAddress={instrumentAddress}
                firstInstrumentAddress={firstInstrumentAddress}
                amplAddress={icb ? icb.get('amplAddress') : 0}
                freqAddress={icb ? icb.get('freqAddress') : 0}
                showError={this._showError.bind(this)}
                client={this.props.client}
              />
            </Col>
          </Row>
        </Grid>
        <Notification
          isActive={error !== null}
          message={(error !== null) ? error : ''}
          onDismiss={() => this.setState({ error: null })}
          barStyle={{ fontSize: 16, zIndex: 9999, backgroundColor: '#e9322d', borderColor: '#e82924', opacity: 0.9 }}
        />
      </div>
    );
  }
}
