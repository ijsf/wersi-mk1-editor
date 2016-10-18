import React, { Component } from 'react';
import { Panel, Button, ButtonGroup, ButtonToolbar, Checkbox, Modal, Col, Row, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';

import reactMixin from 'react-mixin';
import reactor from 'modules/flux';
import { toImmutable } from 'nuclear-js';

import { actions as instrumentActions, getters as instrumentGetters } from 'modules/instrument';

class FilterControl extends Component {
  constructor() {
    super();
    
    this.state = {
      t1Time: null,
      t1Offset: null,
      t1Intensity: null,
      t2Time: null,
      t2Offset: null,
      t2Intensity: null,
      frequency: null,
      q: null
    };
  }
  
  getDataBindings() {
    return {
      vcf: instrumentGetters.byId(this.props.vcfAddress, 'vcf')
    };
  }
  
  _handleSave() {
    // Send to SysEx
    this.props.client.setVCF(this.props.vcfAddress, this.state.vcf)
    .then(() => {
      // Refresh data in case the Wersi has made any changes
      return this.props.client.getVCF(this.props.vcfAddress);
    })
    .then((data) => {
      // Update store
      instrumentActions.update(this.props.vcfAddress, 'vcf', toImmutable(data));
      
      // Reload instrument
      return this.props.client.reloadInstrument(this.props.instrumentAddress);
    })
    ;
  }
  
  render() {
    const { vcf } = this.state;
    
    let header = (
      <h3>Filter control</h3>
    );
    
    let form = null;
    if (vcf) {
      // Default values
      const t1Time = (this.state.t1Time !== null) ? this.state.t1Time : vcf.get('t1Time');
      const t2Time = (this.state.t2Time !== null) ? this.state.t2Time : vcf.get('t2Time');
      const t1Offset = (this.state.t1Offset !== null) ? this.state.t1Offset : vcf.get('t1Offset');
      const t2Offset = (this.state.t2Offset !== null) ? this.state.t2Offset : vcf.get('t2Offset');
      const frequency = (this.state.frequency !== null) ? this.state.frequency : vcf.get('frequency');
      const q = (this.state.q !== null) ? this.state.q : vcf.get('q');
    
      // End frequency calculation
      let t1Intensity = this.state.t1Intensity, t2Intensity = this.state.t2Intensity;
      if (t1Intensity === null) {
        t1Intensity = vcf.get('t1Offset') + vcf.get('t1Intensity');
      }
      if (t2Intensity === null) {
        t2Intensity = vcf.get('t2Offset') + vcf.get('t2Intensity');
      }
      
      // End frequency bounds
      t1Intensity = Math.min(Math.max(t1Intensity, 0), 127);
      t2Intensity = Math.min(Math.max(t2Intensity, 0), 127);
    
      // Text change handler
      let handleTextDone = (min, max, type, event, evaluator) => {
        let value = Number(event.target.value);
        if (value < min || isNaN(value) || !isFinite(value)) {
          value = min;
        }
        if (value > max) {
          value = max;
        }
        this.setState((state) => {
          state[type] = value;
          return state;
        });
        instrumentActions.update(
          this.props.vcfAddress, 'vcf',
          this.state.vcf.set(type, evaluator ? evaluator(value) : value)
        );
      };
      // Button toggle handler
      let handleButtonToggle = (type) => {
        instrumentActions.update(
          this.props.vcfAddress, 'vcf',
          this.state.vcf.set(type, !this.state.vcf.get(type))
        );
      };
      // Regular input set handler
      let handleInputSet = (type, value) => {
        instrumentActions.update(
          this.props.vcfAddress, 'vcf',
          this.state.vcf.set(type, value)
        );
      };

      // Form components
      form = (
        <Form horizontal>
          <FormGroup>
            <Col sm={2} componentClass={ControlLabel}>Type</Col>
            <Col sm={3}>
              <ButtonGroup>
                <Button active={vcf.get('lowPass')} onClick={() => handleInputSet('lowPass', true)}>Low pass</Button>
                <Button active={!vcf.get('lowPass')} onClick={() => handleInputSet('lowPass', false)}>Band pass</Button>
              </ButtonGroup>
            </Col>
            <Col sm={3}>
              <ButtonGroup>
                <Button active={vcf.get('fourPole')} onClick={() => handleInputSet('fourPole', true)}>4-pole</Button>
                <Button active={!vcf.get('fourPole')} onClick={() => handleInputSet('fourPole', false)}>2-pole</Button>
              </ButtonGroup>
            </Col>
            <Col sm={3}>
              <ButtonToolbar>
                <Button active={vcf.get('retrigger')} onClick={() => handleButtonToggle('retrigger')}>Retrigger</Button>
                <Button active={vcf.get('tracking')} onClick={() => handleButtonToggle('tracking')}>Tracking</Button>
              </ButtonToolbar>
            </Col>
          </FormGroup>
          <FormGroup>
            <Col sm={2} componentClass={ControlLabel}>Parameters</Col>
            <Col sm={3}>
              <InputGroup>
                <InputGroup.Addon>Freq</InputGroup.Addon>
                <FormControl type="text" value={frequency}
                onChange={(event) => this.setState({ frequency: event.target.value })}
                onBlur={(event) => handleTextDone(0, 255, "frequency", event)}
                />
              </InputGroup>
            </Col>
            <Col sm={3}>
              <InputGroup>
                <InputGroup.Addon>Q</InputGroup.Addon>
                <FormControl type="text" value={q}
                onChange={(event) => this.setState({ q: event.target.value })}
                onBlur={(event) => handleTextDone(0, 255, "q", event)}
                />
              </InputGroup>
            </Col>
            <Col sm={4}>
              <InputGroup>
                <InputGroup.Addon>Envelope</InputGroup.Addon>
                  <FormControl componentClass="select"
                    value={vcf.get('envType')}
                    onChange={(event) => handleInputSet('envType', event.target.value)}>
                  {Array.from(["T1", "T1 → T2", "T1 → Rel → T2", "T1/T2 Rotor"], (v, k) => {
                    return (<option value={k} key={"mode-" + k}>{v}</option>);
                  })}
                </FormControl>
              </InputGroup>
            </Col>
          </FormGroup>
          <FormGroup>
            <Col sm={2} componentClass={ControlLabel}>Envelope</Col>
            <Col sm={3}>
                <InputGroup>
                  <InputGroup.Addon style={{ width: "12ch" }}>T1 Time</InputGroup.Addon>
                  <FormControl type="text" value={t1Time}
                  onChange={(event) => this.setState({ t1Time: event.target.value })}
                  onBlur={(event) => handleTextDone(0, 255, "t1Time", event)}
                  />
                </InputGroup>
              <InputGroup>
                <InputGroup.Addon style={{ width: "12ch" }}>T1 Freq 1</InputGroup.Addon>
                <FormControl type="text" value={t1Offset}
                onChange={(event) => this.setState({ t1Offset: event.target.value })}
                onBlur={(event) => handleTextDone(0, 127, "t1Offset", event)}
                />
              </InputGroup>
              <InputGroup>
                <InputGroup.Addon style={{ width: "12ch" }}>T1 Freq 2</InputGroup.Addon>
                <FormControl type="text" value={t1Intensity}
                onChange={(event) => this.setState({ t1Intensity: event.target.value })}
                onBlur={(event) => handleTextDone(0, 127, "t1Intensity", event, (v) => v - t1Offset)}
                />
              </InputGroup>
            </Col>
            <Col sm={3}>
              <InputGroup>
                <InputGroup.Addon style={{ width: "12ch" }}>T2 Time</InputGroup.Addon>
                <FormControl type="text" value={t2Time}
                onChange={(event) => this.setState({ t2Time: event.target.value })}
                onBlur={(event) => handleTextDone(0, 255, "t2Time", event)}
                />
              </InputGroup>
              <InputGroup>
                <InputGroup.Addon style={{ width: "12ch" }}>T2 Freq 1</InputGroup.Addon>
                <FormControl type="text" value={t2Offset}
                onChange={(event) => this.setState({ t2Offset: event.target.value })}
                onBlur={(event) => handleTextDone(0, 127, "t2Offset", event)}
                />
              </InputGroup>
              <InputGroup>
                <InputGroup.Addon style={{ width: "12ch" }}>T2 Freq 2</InputGroup.Addon>
                <FormControl type="text" value={t2Intensity}
                onChange={(event) => this.setState({ t2Intensity: event.target.value })}
                onBlur={(event) => handleTextDone(0, 127, "t2Intensity", event, (v) => v - t2Offset)}
                />
              </InputGroup>
            </Col>
          </FormGroup>
          <FormGroup>
            <Col sm={2} componentClass={ControlLabel}>Effects</Col>
            <Col sm={3}>
              <InputGroup>
                <InputGroup.Addon>Noise</InputGroup.Addon>
                  <FormControl componentClass="select"
                    value={vcf.get('noise') ? (vcf.get('noiseType') + 1) : 0}
                    onChange={(event) => {
                      const value = event.target.value;
                      instrumentActions.update(
                        this.props.vcfAddress, 'vcf',
                        this.state.vcf.set('noise', value > 0).set('noiseType', (value > 0) ? (value - 1) : 0)
                      );
                    }}>
                  {Array.from(["None", "Wind", "Click", "Flute"], (v, k) => {
                    return (<option value={k} key={"noise-" + k}>{v}</option>);
                  })}
                </FormControl>
              </InputGroup>
            </Col>
            <Col sm={3}>
              <ButtonToolbar>
                <Button active={vcf.get('distortion')} onClick={() => handleButtonToggle('distortion')}>Distortion</Button>
              </ButtonToolbar>
            </Col>
          </FormGroup>
          <FormGroup>
            <Col sm={2} componentClass={ControlLabel}>Output</Col>
            <Col sm={8}>
              <ButtonToolbar>
                <span className="btn btn-link">VCF</span>
                <span className="btn btn-link">⤑</span>
                <Button active={vcf.get('routeLeft')} onClick={() => handleButtonToggle('routeLeft')}>Left</Button>
                <Button active={vcf.get('routeRight')} onClick={() => handleButtonToggle('routeRight')}>Right</Button>
                <Button active={vcf.get('routeWV')} onClick={() => handleButtonToggle('routeWV')}>WersiVoice</Button>
              </ButtonToolbar>
            </Col>
          </FormGroup>
        </Form>
      );
    }
    
    return (
      <Panel header={header} collapsible defaultExpanded>
        <ButtonToolbar>
          <Button onClick={this._handleSave.bind(this)} className="pull-right" bsStyle="primary">Save</Button>
        </ButtonToolbar>
        {form}
      </Panel>
    );
  }
}

reactMixin.onClass(FilterControl, reactor.ReactMixin);
export default FilterControl;
