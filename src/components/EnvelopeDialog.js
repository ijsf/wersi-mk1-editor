import React, { Component, PropTypes } from 'react';
import { Panel, Button, Checkbox, Modal, Col, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';

import EnvelopeModule from 'components/envelope/EnvelopeModule';
import EnvelopeModuleEmpty from 'components/envelope/EnvelopeModuleEmpty';
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
    };
  }
  
  componentWillMount() {
  }
  
  _handleAdd(data, props) {
    // Call save
    this.props.save(data, props);
    
    // Trigger addedModule callback
    this.props.addedModule();
  }
  
  render() {
    const { moduleWidth, moduleHeight, moduleMargin } = this.props;
    
    let moduleProps = {
      width: moduleWidth,
      height: 75,
      graphHeight: 45,
      margin: moduleMargin,
      save: this._handleAdd.bind(this)
    };
    
    return (
      <Modal show={this.props.show}>
        <Modal.Header>
          <Modal.Title>Click a module to add to your envelope</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div>
            <EnvelopeModuleEmpty {...moduleProps}/>
            <EnvelopeModuleLinUp {...moduleProps}/>
            <EnvelopeModuleExpUp {...moduleProps}/>
            <EnvelopeModuleLinDown {...moduleProps}/>
            <EnvelopeModuleStepRel {...moduleProps}/>
            <EnvelopeModuleConstAbs {...moduleProps}/>
            <EnvelopeModuleConstRel {...moduleProps}/>
            <EnvelopeModuleVibrato1 {...moduleProps}/>
            <EnvelopeModuleVibrato2 {...moduleProps}/>
            <EnvelopeModuleRepeat {...moduleProps}/>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button bsStyle="default" onClick={this.props.cancel}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    );
  }
}
