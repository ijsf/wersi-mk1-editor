import React, { Component } from 'react';
import { Panel, Button, Checkbox, Modal, Col, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';
import Loader from 'react-loader-advanced';

import reactor from 'modules/flux';
import { toImmutable } from 'nuclear-js';

import Wave from 'components/Wave';

import { actions as instrumentActions, getters as instrumentGetters } from 'modules/instrument';

export default class WaveControl extends Component {
  constructor() {
    super();
    
    this.state = {
      loading: false
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

  render() {
    const { waveAddress } = this.props;
    
    let header = (
      <h3>Wavetable control ({this.props.waveAddress})</h3>
    );
    
    return (
      <Loader show={this.state.loading} message={(<h5>« Downloading... »</h5>)} contentBlur={2}>
        <Panel header={header} collapsible defaultExpanded>
          <div className="clearfix">
            <Button onClick={this._handleSave.bind(this)} className="pull-right" bsStyle="primary">
              Send
            </Button>
          </div>
          <Wave client={this.props.client} waveSet='bassData' waveAddress={waveAddress} />
          <Wave client={this.props.client} waveSet='tenorData' waveAddress={waveAddress} />
          <Wave client={this.props.client} waveSet='altoData' waveAddress={waveAddress} />
          <Wave client={this.props.client} waveSet='sopranoData' waveAddress={waveAddress} />
        </Panel>
      </Loader>
    );
  }
}

