import React, { Component } from 'react';
import { Panel, Button, Checkbox, Modal, Col, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';

import reactMixin from 'react-mixin';
import reactor from 'modules/flux';
import { toImmutable } from 'nuclear-js';

import Wave from 'components/Wave';

import { actions as instrumentActions, getters as instrumentGetters } from 'modules/instrument';

class WaveControl extends Component {
  constructor() {
    super();
    
    this.state = {
    };
  }
  
  getDataBindings() {
    return {
      wave: instrumentGetters.byId(this.props.waveAddress, 'wave')
    };
  }
  
  _handleSave() {
    // Send to SysEx
    this.props.client.setFixWave(this.props.waveAddress, this.state.wave.toJS())
    .then(() => {
      // Refresh data in case the Wersi has made any changes
      return this.props.client.getFixWave(this.props.waveAddress);
    })
    .then((data) => {
      // Update store
      instrumentActions.update(this.props.waveAddress, 'wave', toImmutable(data));
      
      // Reload instrument
      return this.props.client.reloadInstrument(this.props.instrumentAddress);
    })
    ;
  }

  render() {
    const { waveAddress } = this.props;
    
    let header = (
      <h3>Wavetable control</h3>
    );
    
    return (
      <Panel header={header} collapsible defaultExpanded>
        <div className="clearfix">
          <Button onClick={this._handleSave.bind(this)} className="pull-right" bsStyle="primary">
            Save
          </Button>
        </div>
        <Wave client={this.props.client} waveSet='bassData' waveAddress={waveAddress} />
        <Wave client={this.props.client} waveSet='tenorData' waveAddress={waveAddress} />
        <Wave client={this.props.client} waveSet='altoData' waveAddress={waveAddress} />
        <Wave client={this.props.client} waveSet='sopranoData' waveAddress={waveAddress} />
      </Panel>
    );
  }
}

reactMixin.onClass(WaveControl, reactor.ReactMixin);
export default WaveControl;
