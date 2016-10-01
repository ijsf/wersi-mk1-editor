import React, { Component, PropTypes } from 'react';
import { Panel, Button, Checkbox, Modal, Col, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';

import EnvelopeModule from 'components/envelope/EnvelopeModule';
import EnvelopeModuleConstAbs from 'components/envelope/EnvelopeModuleConstAbs';
import EnvelopeModuleConstRel from 'components/envelope/EnvelopeModuleConstRel';
import EnvelopeModuleDynExpDown from 'components/envelope/EnvelopeModuleDynExpDown';
import EnvelopeModuleDynExpUp from 'components/envelope/EnvelopeModuleDynExpUp';
import EnvelopeModuleDynLinDown from 'components/envelope/EnvelopeModuleDynLinDown';
import EnvelopeModuleDynLinUp from 'components/envelope/EnvelopeModuleDynLinUp';
import EnvelopeModuleDynRemain from 'components/envelope/EnvelopeModuleDynRemain';
import EnvelopeModuleExpDown from 'components/envelope/EnvelopeModuleExpDown';
import EnvelopeModuleExpUp from 'components/envelope/EnvelopeModuleExpUp';
import EnvelopeModuleKeyWeight from 'components/envelope/EnvelopeModuleKeyWeight';
import EnvelopeModuleLinDown from 'components/envelope/EnvelopeModuleLinDown';
import EnvelopeModuleLinUp from 'components/envelope/EnvelopeModuleLinUp';
import EnvelopeModuleNoise from 'components/envelope/EnvelopeModuleNoise';
import EnvelopeModuleRepeat from 'components/envelope/EnvelopeModuleRepeat';
import EnvelopeModuleStepAbs from 'components/envelope/EnvelopeModuleStepAbs';
import EnvelopeModuleStepRel from 'components/envelope/EnvelopeModuleStepRel';
import EnvelopeModuleVibrato1 from 'components/envelope/EnvelopeModuleVibrato1';
import EnvelopeModuleVibrato2 from 'components/envelope/EnvelopeModuleVibrato2';

export default class EnvelopeDialog extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      show: false
    };
  }
  
  componentWillMount() {
  }
  
  shouldComponentUpdate(nextProps, nextState) {
    if (this.state.show !== nextProps.show) {
      nextState.show = nextProps.show;
    }
    return true;
  }
  
  _handleAdd() {
  }
  
  _handleCancel() {
    this.setState({ show: false });
  }
  
  render() {
    return (
      <Modal show={this.state.show}>
        <Modal.Header>
          <Modal.Title>Click a module to add to your envelope</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div>
            <EnvelopeModuleVibrato2 />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button bsStyle="default" onClick={this._handleCancel.bind(this)}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    );
  }
}
