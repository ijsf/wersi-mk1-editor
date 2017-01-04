import React, { Component } from 'react';
import { Glyphicon, Overlay, OverlayTrigger, Tooltip, Panel, Button, Checkbox, Modal, Col, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';
import Loader from 'react-loader-advanced';

import reactor from 'modules/flux';
import { toImmutable } from 'nuclear-js';

import keydown from 'react-keydown';

import Wave from 'components/Wave';

import { Smooth } from '../vendor/smooth';

import { actions as instrumentActions, getters as instrumentGetters } from 'modules/instrument';

export default class WaveControl extends Component {
  constructor() {
    super();
    
    this.state = {
      loading: false,
      parallel: false
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
  
  componentWillUnmount() {
    this._unwatch();
  }
  
  componentWillMount() {
    this._watch(this.props.waveAddress, 'wave');
  }
  
  componentWillUpdate(nextProps, nextState) {
    // Check if instrument has changed
    if (this.props.waveAddress !== nextProps.waveAddress) {
      this._watch(nextProps.waveAddress, 'wave');
    }
  }

  // W hotkey saves
  @keydown('w')
  _handleSave() {
    // Send to SysEx
    this.setState({ loading: true }, () => {
      this.props.client.setFixWave(this.props.waveAddress, this.state.wave.toJS())
      .then(() => {
        // Refresh data in case the Wersi has made any changes
        return this.props.client.getFixWave(this.props.waveAddress);
      })
      .then((data) => {
        // Update store
        instrumentActions.update(this.props.waveAddress, 'wave', toImmutable(data));
        this.setState({ loading: false });
      
        // Reload instrument
        return this.props.client.reloadInstrument(this.props.firstInstrumentAddress);
      })
      ;
    });
  }
  
  _handleToggleParallel() {
    this.setState((state) => {
      return {
        parallel: !state.parallel
      };
    });
  }
  
  _handleWaveUpdate(waveData) {
    if (this.state.parallel) {
      // Decimation (clamped), borrowed from http://stackoverflow.com/posts/36295839/revisions
      let scaleDown = function(y, N) {
        let res = [];
        let M = y.length;
        let carry = 0;
        let m = 0;
        for(let n = 0; n < N; n++) {
          let sum = carry;
          while(m * N - n * M < M) {
            sum += y[m];
            m++;
          }
          carry = (m-(n+1)*M/N)*y[m-1]
          sum -= carry;
          res[n] = Math.min(Math.max(sum*N/M, 0), 255);
        }
        return res;
      }
      // Interpolation (clamped)
      let scaleUp = function(y, N) {
        let fn = Smooth(y);
        return Array.from({length: N}, (v, i) => Math.min(Math.max(fn(i / (N/y.length)), 0), 255));
      }
      
      let waveData64, waveData32, waveData16;
      if (waveData.size == 64) {
        // Bass, tenor. Downsample (decimate) to 32 and 16.
        waveData64 = waveData;
        waveData32 = toImmutable(scaleDown(waveData.toJS(), 32));
        waveData16 = toImmutable(scaleDown(waveData.toJS(), 16));
      }
      else if(waveData.size == 32) {
        // Alto. Upsample (interpolate) to 64, downsample (decimate) to 16.
        waveData64 = toImmutable(scaleUp(waveData.toJS(), 64));
        waveData32 = waveData;
        waveData16 = toImmutable(scaleDown(waveData.toJS(), 16));
      }
      else if(waveData.size == 16) {
        // Soprano. Upsample (interpolate) to 64, 32.
        waveData64 = toImmutable(scaleUp(waveData.toJS(), 64));
        waveData32 = toImmutable(scaleUp(waveData.toJS(), 32));
        waveData16 = waveData;
      }
      
      // Do a global update of all wave data
      let wave = reactor.evaluate(instrumentGetters.byId(this.props.waveAddress, 'wave'))
      .withMutations((state) => {
        state.set('bassData', waveData64);
        state.set('tenorData', waveData64);
        state.set('altoData', waveData32);
        state.set('sopranoData', waveData16);
      });
      instrumentActions.update(this.props.waveAddress, 'wave', wave);
    
      // Don't let the Wave component do any updates, since we already did it here
      return false;
    }
    else {
      // Do nothing here and let the Wave component update itself
      return true;
    }
  }

  render() {
    const { waveAddress } = this.props;
    
    let header = (
      <h3>Wavetable control ({this.props.waveAddress})</h3>
    );
    
    return (
      <Loader show={this.state.loading} message={(<h5>« Downloading... »</h5>)} contentBlur={2}>
        <Panel header={header} collapsible defaultExpanded>
          <div className="clearfix">
            <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="savetooltip">Save wavetables (hotkey W)</Tooltip>)}>
              <Button onClick={this._handleSave.bind(this)} className="pull-right" bsStyle="primary"><Glyphicon glyph="save"/></Button>
            </OverlayTrigger>
            <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="paralleltooltip">Change all wavetables simultaneously</Tooltip>)}>
              <Button onClick={this._handleToggleParallel.bind(this)} className="pull-right" active={this.state.parallel}><Glyphicon glyph="align-justify"/></Button>
            </OverlayTrigger>
          </div>
          <Wave ref={(r) => this._waveBass = r} client={this.props.client} waveSet='bassData' waveAddress={waveAddress} updateCallback={this._handleWaveUpdate.bind(this)} />
          <Wave ref={(r) => this._waveTenor = r} client={this.props.client} waveSet='tenorData' waveAddress={waveAddress} updateCallback={this._handleWaveUpdate.bind(this)} />
          <Wave ref={(r) => this._waveAlto = r} client={this.props.client} waveSet='altoData' waveAddress={waveAddress} updateCallback={this._handleWaveUpdate.bind(this)} />
          <Wave ref={(r) => this._waveSoprano = r} client={this.props.client} waveSet='sopranoData' waveAddress={waveAddress} updateCallback={this._handleWaveUpdate.bind(this)} />
        </Panel>
      </Loader>
    );
  }
}
