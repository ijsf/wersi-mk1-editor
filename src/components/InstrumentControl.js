import React, { Component } from 'react';
import { Panel, Button, ButtonGroup, ButtonToolbar, Checkbox, Modal, Col, Row, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';

import reactMixin from 'react-mixin';
import reactor from 'modules/flux';
import { toImmutable } from 'nuclear-js';

import { actions as instrumentActions, getters as instrumentGetters } from 'modules/instrument';

class InstrumentControl extends Component {
  constructor() {
    super();
  }
  
  getDataBindings() {
    return {
      icb: instrumentGetters.byId(this.props.instrumentAddress, 'icb')
    };
  }
  
  _handleSave() {
  }
  
  render() {
    const { icb } = this.state;
    
    let header = (
      <h3>Instrument control</h3>
    );
    
    let form = (
      <Form horizontal>
        <FormGroup controlId="name">
          <Col sm={2} componentClass={ControlLabel}>Name</Col>
          <Col sm={3}>
            <FormControl value={icb.get('name')} type="text" placeholder="Instrument name" maxLength={6} />
          </Col>
        </FormGroup>
        <FormGroup controlId="dynamics">
          <Col sm={2} componentClass={ControlLabel}>Dynamics</Col>
          <Col sm={10}>
          </Col>
        </FormGroup>
        <FormGroup controlId="tuning">
          <Col sm={2} componentClass={ControlLabel}>Tuning</Col>
          <Col sm={3}>
            <InputGroup>
              <InputGroup.Addon>Transpose</InputGroup.Addon>
              <FormControl componentClass="select">
                {Array.from({length: 25}, (v, k) => {
                  const val = -12 + k;
                  return (<option value={val} key={"transpose-" + k}>{val > 0 ? "+" : ""}{val}</option>);
                })}
              </FormControl>
            </InputGroup>
          </Col>
          <Col sm={3}>
            <InputGroup>
              <InputGroup.Addon>Detune</InputGroup.Addon>
              <FormControl componentClass="select">
                {Array.from({length: 25}, (v, k) => {
                  const val = -12 + k;
                  return (<option value={val} key={"detune-" + k}>{val > 0 ? "+" : ""}{val}</option>);
                })}
              </FormControl>
            </InputGroup>
          </Col>
        </FormGroup>
        <FormGroup controlId="outputRouting">
          <Col sm={2} componentClass={ControlLabel}>Output</Col>
          <Col sm={3}>
            <ButtonToolbar>
              <Button active={icb.get('routeLeft')}>Left</Button>
              <Button active={icb.get('routeRight')}>Right</Button>
              <Button active={icb.get('routeBright')}>Bright</Button>
            </ButtonToolbar>
          </Col>
          <Col sm={3}>
            <ButtonToolbar>
              <Button active={icb.get('routeVCF')}>VCF</Button>
              <Button active={icb.get('routeWV')}>WersiVoice</Button>
            </ButtonToolbar>
          </Col>
        </FormGroup>
        <Row>
          <Col sm={2} componentClass={ControlLabel}>WersiVoice</Col>
          <Col sm={3}>
            <InputGroup>
              <InputGroup.Addon>Mode</InputGroup.Addon>
                <FormControl componentClass="select" value={icb.get('wvMode')}>
                {Array.from(["Rotor Slow", "Rotor Fast", "Flanger", "Strings", "Chorus"], (v, k) => {
                  return (<option value={k} key={"mode-" + k}>{v}</option>);
                })}
              </FormControl>
            </InputGroup>
          </Col>
          <Col sm={5}>
            <ButtonToolbar>
              <Button active={icb.get('wvFeedbackStereoFlat')}>Flat</Button>
              <Button active={icb.get('wvFeedbackDeep')}>Deep</Button>
            </ButtonToolbar>
          </Col>
        </Row>
      </Form>
    );
    
    return (
      <Panel header={header} collapsible defaultExpanded>
        <div>
          <Button onClick={this._handleSave.bind(this)} className="pull-right" bsStyle="primary">
            Save
          </Button>
        </div>
        {form}
      </Panel>
    );
  }
}

reactMixin.onClass(InstrumentControl, reactor.ReactMixin);
export default InstrumentControl;
