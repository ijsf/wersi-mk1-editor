import React, { Component } from 'react';
import { Panel, Button, ButtonGroup, ButtonToolbar, Glyphicon, Checkbox, Modal, Col, Row, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';
import Dropzone from 'react-dropzone';

import reactor from 'modules/flux';
import { toImmutable } from 'nuclear-js';

import WersiClient from 'modules/midi/WersiClient';

import { actions as instrumentActions, getters as instrumentGetters } from 'modules/instrument';

export default class InstrumentControl extends Component {
  constructor() {
    super();
    
    this.state = {
      name: null
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
    this._watch(this.props.instrumentAddress, 'icb');
  }
  
  componentWillUpdate(nextProps, nextState) {
    // Check if instrument has changed
    if (this.props.instrumentAddress !== nextProps.instrumentAddress) {
      this._watch(nextProps.instrumentAddress, 'icb');
    }
  }
  
  _handleImport() {
    // Show import modal
    this.setState({ import: "Import your instrument below." });
  }
  
  _handleExport() {
    // Export entire instrument store to JSON
    const icb = this.state.icb;
    const vcf = reactor.evaluate(instrumentGetters.byId(icb.get('vcfAddress'), 'vcf')).toJS();
    const wave = reactor.evaluate(instrumentGetters.byId(icb.get('waveAddress'), 'wave')).toJS();
    const ampl = Array.from(reactor.evaluate(instrumentGetters.byId(icb.get('amplAddress'), 'ampl')));
    const freq = null; //Array.from(reactor.evaluate(instrumentGetters.byId(icb.get('freqAddress'), 'freq')));
    const json = {
      icb: icb.toJS(),
      vcf: vcf,
      wave: wave,
      ampl: ampl,
      freq: freq
    };

    // Store to state, show export modal
    let file = new Blob([JSON.stringify(json)], { type: "application/json" });
    let url = URL.createObjectURL(file);
    this.setState({ export: url });
  }
  
  _handleSave() {
    // Send to SysEx
    this.props.client.setICB(this.props.instrumentAddress, this.state.icb)
    .then(() => {
      // Refresh data in case the Wersi has made any changes
      return this.props.client.getICB(this.props.instrumentAddress);
    })
    .then((data) => {
      // Update store
      instrumentActions.update(this.props.instrumentAddress, 'icb', toImmutable(data));
      
      // Reload instrument
      return this.props.client.reloadInstrument(this.props.instrumentAddress);
    })
    ;
  }
  
  render() {
    const { icb } = this.state;
    
    const name = (this.state.name !== null) ? this.state.name : icb.get('name');

    let header = (
      <h3>Instrument control</h3>
    );

    // Button toggle handler
    let handleButtonToggle = (type) => {
      instrumentActions.update(
        this.props.instrumentAddress, 'icb',
        this.state.icb.set(type, !this.state.icb.get(type))
      );
    };
    // Regular input set handler
    let handleInputSet = (type, value) => {
      instrumentActions.update(
        this.props.instrumentAddress, 'icb',
        this.state.icb.set(type, value)
      );
    };
    
    const transposeRange = 2, detuneRange = 2;  // times 12 (octave)
    
    // Import/export modal
    let modal = (
      <Modal show={(this.state.export || this.state.import) ? true : false}>
        <Modal.Header>
          <Modal.Title>{(this.state.export ? "Export" : "Import") + " instrument"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            {this.state.export ? "Your instrument has been exported to a JSON file." : null}
            {this.state.import ? this.state.import : null}
          </p>
          {this.state.export
            ? (
              <p>
                <a download={icb.get('name') + '.json'} href={this.state.export} onClick={() => this.setState({ export: null })}>
                Click here to download.
                </a>
              </p>
            )
            : (
              <Dropzone style={{ width: '100%', border: '2px dashed #ccc', padding: 10, cursor: 'pointer' }}
                onDrop={(files) => {
                  if (files && files.length == 1) {
                    let fr = new FileReader();
                    fr.onload = (e) => {
                      try {
                        const json = JSON.parse(e.target.result);
                        const icb = json.icb;
                        
                        // Retrieve ICB addresses
                        let vcfAddress = icb.vcfAddress;
                        let waveAddress = icb.waveAddress;
                        let amplAddress = icb.amplAddress;
                        let freqAddress = icb.freqAddress;
                        console.log("Original ICB addresses: vcf " + vcfAddress + " wave " + waveAddress + " ampl " + amplAddress + " freq " + freqAddress);
                        
                        // Override these with 1-to-1 Wersi mapping
                        vcfAddress = this.props.instrumentAddress - 1;
                        waveAddress = this.props.instrumentAddress - 1;
                        amplAddress = this.props.instrumentAddress - 1;
                        freqAddress = this.props.instrumentAddress - 1;
                        console.log("Remapped ICB addresses: vcf " + vcfAddress + " wave " + waveAddress + " ampl " + amplAddress + " freq " + freqAddress);

                        // Send to SysEx
                        this.props.client.setICB(this.props.instrumentAddress, toImmutable(json.icb))
                        //.then(() => this.props.client.getICB(this.props.instrumentAddress))
                        //.then((data) => instrumentActions.update(this.props.instrumentAddress, 'icb', toImmutable(data)))
                        .then(() => instrumentActions.update(this.props.instrumentAddress, 'icb', toImmutable(json.icb)))

                        .then((data) => this.props.client.setVCF(vcfAddress, toImmutable(json.vcf)))
                        //.then(() => this.props.client.getVCF(vcfAddress))
                        //.then((data) => instrumentActions.update(vcfAddress, 'vcf', toImmutable(data)))
                        .then(() => instrumentActions.update(vcfAddress, 'vcf', toImmutable(json.vcf)))

                        .then((data) => this.props.client.setFixWave(waveAddress, json.wave))
                        //.then(() => this.props.client.getFixWave(waveAddress))
                        //.then((data) => instrumentActions.update(waveAddress, 'wave', toImmutable(data)))
                        .then(() => instrumentActions.update(waveAddress, 'wave', toImmutable(json.wave)))

                        .then((data) => this.props.client.setAmpl(amplAddress, json.ampl))
                        //.then(() => this.props.client.getAmpl(amplAddress))
                        //.then((data) => instrumentActions.update(amplAddress, 'ampl', toImmutable(data)))
                        .then(() => instrumentActions.update(amplAddress, 'ampl', toImmutable(json.ampl)))
                        
//                          .then((data) => this.props.client.setFreq(freqAddress, toImmutable(json.freq)))
//                          .then(() => this.props.client.getFreq(freqAddress))
//                          .then((data) => instrumentActions.update(freqAddress, 'freq', toImmutable(data)))

                        .then(() => this.props.client.reloadInstrument(this.props.instrumentAddress))
                        ;
                        
                        // Hide modal and reset state variables
                        this.setState({ import: null, name: null });
                      }
                      catch (e) {
                        this.setState({ import: "Could not load your JSON file! Please try again." });
                        console.error(e);
                      }
                    };
                    fr.readAsText(files[0]);
                  }
                }
              }>
                <p style={{ margin: 0, textAlign: 'center' }}>
                  Please drop your instrument JSON file here, or click here to upload your file.
                </p>
              </Dropzone>
            )
          }
        </Modal.Body>
        <Modal.Footer>
          <Button bsStyle="primary" onClick={() => this.setState({ export: null, import: null })}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    );
    
    let form = (
      <Form horizontal>
        <FormGroup controlId="name">
          <Col sm={2} componentClass={ControlLabel}>Name</Col>
          <Col sm={3}>
            <FormControl value={name} type="text" maxLength="6" placeholder="Instrument name" maxLength={6}
            onChange={(event) => this.setState({ name: event.target.value })}
            onBlur={(event) => handleInputSet("name", event.target.value)}
            />
          </Col>
        </FormGroup>
        <FormGroup controlId="dynamics">
          <Col sm={2} componentClass={ControlLabel}>Dynamics</Col>
          <Col sm={3}>
            <InputGroup>
              <InputGroup.Addon>Level</InputGroup.Addon>
              <FormControl componentClass="select"
                value={icb.get('dynamics')}
                onChange={(event) => handleInputSet('dynamics', event.target.value)}>
                {Array.from(['None', 'Medium', 'Strong', 'Full'], (v, k) => {
                  return (<option value={k} key={"dynamics-" + k}>{v}</option>);
                })}
              </FormControl>
            </InputGroup>
          </Col>
          <Col sm={3}>
            <ButtonToolbar>
              <Button active={icb.get('voiceSelectLower')} onClick={() => handleButtonToggle('voiceSelectLower')}>Lower</Button>
              <Button active={icb.get('voiceSelectUpper')} onClick={() => handleButtonToggle('voiceSelectUpper')}>Upper</Button>
            </ButtonToolbar>
          </Col>
        </FormGroup>
        <FormGroup controlId="tuning">
          <Col sm={2} componentClass={ControlLabel}>Tuning</Col>
          <Col sm={3}>
            <InputGroup>
              <InputGroup.Addon>Transpose</InputGroup.Addon>
              <FormControl componentClass="select"
                value={icb.get('transpose')}
                onChange={(event) => handleInputSet('transpose', event.target.value)}>
                {Array.from({length: 1 + 12 * transposeRange * 2}, (v, k) => {
                  const val = -12 * transposeRange + k;
                  return (<option value={val} key={"transpose-" + k}>{val > 0 ? "+" : ""}{val}</option>);
                })}
              </FormControl>
            </InputGroup>
          </Col>
          <Col sm={3}>
            <InputGroup>
              <InputGroup.Addon>Detune</InputGroup.Addon>
              <FormControl componentClass="select"
                value={icb.get('detune')}
                onChange={(event) => handleInputSet('detune', event.target.value)}>
                {Array.from({length: 1 + 12 * detuneRange * 2}, (v, k) => {
                  const val = -12 * detuneRange + k;
                  return (<option value={val} key={"detune-" + k}>{val > 0 ? "+" : ""}{val}</option>);
                })}
              </FormControl>
            </InputGroup>
          </Col>
        </FormGroup>
        <FormGroup>
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
              <Button active={icb.get('wvFeedbackStereoFlat')} onClick={() => handleButtonToggle('wvFeedbackStereoFlat')}>Flat</Button>
              <Button active={icb.get('wvFeedbackDeep')} onClick={() => handleButtonToggle('wvFeedbackDeep')}>Deep</Button>
            </ButtonToolbar>
          </Col>
        </FormGroup>
        <FormGroup>
          <Col sm={2} componentClass={ControlLabel}>Output</Col>
          <Col sm={8}>
            <ButtonToolbar>
              <span className="btn btn-link">Voice</span>
              <span className="btn btn-link">⤑</span>
              <Button active={icb.get('routeBright')} onClick={() => handleButtonToggle('routeBright')}>Bright</Button>
              <span className="btn btn-link">⤑</span>
              <Button active={icb.get('routeLeft')} onClick={() => handleButtonToggle('routeLeft')}>Left</Button>
              <Button active={icb.get('routeRight')} onClick={() => handleButtonToggle('routeRight')}>Right</Button>
              <Button active={icb.get('routeWV')} onClick={() => handleButtonToggle('routeWV')}>WersiVoice</Button>
              <Button active={icb.get('routeVCF')} onClick={() => handleButtonToggle('routeVCF')}>VCF</Button>
            </ButtonToolbar>
          </Col>
        </FormGroup>
      </Form>
    );
    
    // Determine variables related to layering, use default 1-to-1 Wersi mapping for any next instrument addresses
    const firstInstrument = this.props.instrumentAddresses.first() == this.props.instrumentAddress;
    const firstInstrumentId = WersiClient.ADDRESS.id(this.props.instrumentAddresses.first());
    const currentInstrumentLayer = WersiClient.ADDRESS.layer(this.props.instrumentAddress) + 1; // 1-based for front-end
    const nextInstrument = icb.get('nextInstrumentAddress') !== 0;
    const nextNewInstrumentAddress = WersiClient.ADDRESS.RAM(WersiClient.ADDRESS.id(firstInstrument), currentInstrumentLayer + 1);
    console.log(icb.get('nextInstrumentAddress'));
    console.log(this.props.instrumentAddress);
    
    return (
      <div>
        {modal}
        <Panel header={header} collapsible defaultExpanded>
          <ButtonToolbar>
            <ButtonToolbar className="pull-right">
              <ButtonGroup>
                <Button onClick={() => this.props.handlePrevInstrument()} bsStyle="info" disabled={firstInstrument}><Glyphicon glyph="chevron-left"/></Button>
                <Button onClick={() => this.props.handleNextInstrument(icb.get('nextInstrumentAddress'))} bsStyle="info" disabled={!nextInstrument}><Glyphicon glyph="chevron-right"/></Button>
                <Button bsStyle="link" style={{ width: '11ch' }}>Voice {currentInstrumentLayer} ({this.props.instrumentAddress})</Button>
                <Button onClick={() => this.props.handleNewInstrument(nextNewInstrumentAddress)} bsStyle="info" disabled={nextInstrument}><Glyphicon glyph="file"/></Button>
                <Button onClick={() => handleInputSet('nextInstrumentAddress', 0)} bsStyle="info" disabled={!nextInstrument}><Glyphicon glyph="remove"/></Button>
              </ButtonGroup>
              <ButtonGroup>
                <Button onClick={this._handleImport.bind(this)} bsStyle="primary">Import</Button>
                <Button onClick={this._handleExport.bind(this)} bsStyle="primary">Export</Button>
              </ButtonGroup>
              <Button onClick={this._handleSave.bind(this)} bsStyle="primary">Save</Button>
            </ButtonToolbar>
          </ButtonToolbar>
        {form}
        </Panel>
      </div>
    );
  }
}
