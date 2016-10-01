import React, { Component } from 'react';
import { Panel, Button, Checkbox, Modal, Col, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';

export default class InstrumentControl extends Component {
  constructor() {
    super();
  }
  
  componentWillMount() {
  }
  
  _handleSave() {
  }
  
  render() {
    let header = (
      <h3>Instrument control</h3>
    );
    
    let form = (
      <Form horizontal>
        <FormGroup>
          <Col sm={2} componentClass={ControlLabel}>Name</Col>
          <Col sm={3}>
            <FormControl type="text" placeholder="Instrument name" maxLength={6} />
          </Col>
        </FormGroup>
        <FormGroup>
          <Col sm={2} componentClass={ControlLabel}>Dynamics</Col>
          <Col sm={10}>
          </Col>
        </FormGroup>
        <FormGroup>
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
        <FormGroup>
          <Col sm={2} componentClass={ControlLabel}>Output routing</Col>
          <Col sm={2}>
            <Checkbox inline>Left</Checkbox>
          </Col>
          <Col sm={2}>
            <Checkbox inline>Right</Checkbox>
          </Col>
          <Col sm={2}>
            <Checkbox inline>VCF</Checkbox>
          </Col>
          <Col sm={2}>
            <Checkbox inline>WersiVoice</Checkbox>
          </Col>
          <Col sm={2}>
            <Checkbox inline>Bright</Checkbox>
          </Col>
        </FormGroup>
        <FormGroup>
          <Col sm={2} componentClass={ControlLabel}>WersiVoice</Col>
          <Col sm={10}>
          </Col>
        </FormGroup>
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
