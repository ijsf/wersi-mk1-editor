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
      wave: instrumentGetters.byId(this.props.instrumentId, 'wave')
    };
  }
  
  _handleSave() {
    // Send to SysEx
    this.props.client.setFixWave(this.props.instrumentId, this.state.wave.toJS())
    .then(() => {
      // Refresh data in case the Wersi has made any changes
      return this.props.client.getFixWave(this.props.instrumentId);
    })
    .then((wave) => {
      // Update store
      instrumentActions.update(65, 'wave', toImmutable(wave));
      
      // Reload instrument
      return this.props.client.reloadInstrument(this.props.instrumentId);
    })
    ;
  }

  render() {
    const { instrumentId } = this.props;
    
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
        <Wave client={this.props.client} waveSet='bassData' instrumentId={instrumentId} />
        <Wave client={this.props.client} waveSet='tenorData' instrumentId={instrumentId} />
        <Wave client={this.props.client} waveSet='altoData' instrumentId={instrumentId} />
        <Wave client={this.props.client} waveSet='sopranoData' instrumentId={instrumentId} />
      </Panel>
    );
  }
}

reactMixin.onClass(WaveControl, reactor.ReactMixin);
export default WaveControl;
