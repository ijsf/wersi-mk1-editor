import React, { Component } from 'react';
import { Panel, Button, ButtonGroup, ButtonToolbar, Glyphicon, Checkbox, Modal, Col, Row, Form, FormGroup, InputGroup, FormControl, ControlLabel, Tooltip, OverlayTrigger } from 'react-bootstrap';
import Dropzone from 'react-dropzone';
import Loader from 'react-loader-advanced';
import { Notification } from 'react-notification';

import reactor from 'modules/flux';
import { toImmutable } from 'nuclear-js';

import WersiClient from 'modules/midi/WersiClient';

import { actions as instrumentActions, getters as instrumentGetters } from 'modules/instrument';

export default class InstrumentControl extends Component {
  constructor() {
    super();
    
    this.state = {
      name: null,
      notification: null,
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
    let icb = this.state.icb;
    const vcf = reactor.evaluate(instrumentGetters.byId(icb.get('vcfAddress'), 'vcf')).toJS();
    const wave = reactor.evaluate(instrumentGetters.byId(icb.get('waveAddress'), 'wave')).toJS();
    const ampl = Array.from(reactor.evaluate(instrumentGetters.byId(icb.get('amplAddress'), 'ampl')));
    const freq = null; //Array.from(reactor.evaluate(instrumentGetters.byId(icb.get('freqAddress'), 'freq')));
    
    // Strip addresses as we will regenerate them
    icb = icb
    .delete('nextInstrumentAddress')
    .delete('vcfAddress')
    .delete('waveAddress')
    .delete('amplAddress')
    .delete('freqAddress')
    ;
    
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
    this.setState({ loading: true }, () => {
      this.props.client.setICB(this.props.instrumentAddress, this.state.icb)
      .then(() => {
        // Refresh data in case the Wersi has made any changes
        return this.props.client.getICB(this.props.instrumentAddress);
      })
      .then((data) => {
        // Update store
        instrumentActions.update(this.props.instrumentAddress, 'icb', toImmutable(data));
        this.setState({ loading: false });
      
        // Reload instrument
        return this.props.client.reloadInstrument(this.props.firstInstrumentAddress);
      })
      ;
    });
  }
  
  _getDefaultInstrumentData(icb, instrumentAddress) {
    // Return default settings for a new instrument based
    //
    // * always set nextInstrumentAddress to 0
    // * regenerate addresses (1-to-1 Wersi mapping)
    // * use first instrument VCF address
    //
    // NOTE: we are assuming the first instrument ICB is actually stored in the store!
    const firstInstrumentAddress = this.props.instrumentAddresses.first();
    const firstVCFAddress = reactor.evaluate(instrumentGetters.byId(firstInstrumentAddress, 'icb')).get('vcfAddress');
    
    return icb
    .set('nextInstrumentAddress', 0)
    .set('vcfAddress', firstVCFAddress)
    .set('waveAddress', instrumentAddress - 1)
    .set('amplAddress', instrumentAddress - 1)
    .set('freqAddress', instrumentAddress - 1)
    .set('name', 'NEW')
    ;
  }
  
  _handleNewInstrument(newInstrumentAddress) {
    if (newInstrumentAddress !== null) {
      // Change nextInstrumentAddress
      this.setState({ loading: true, icb: this.state.icb.set('nextInstrumentAddress', newInstrumentAddress) }, () => {
        // Update store of CURRENT instrument
        instrumentActions.update(this.props.instrumentAddress, 'icb', this.state.icb);
        
        // Send SysEx for NEW instrument
        const icbNew = this._getDefaultInstrumentData(this.state.icb, newInstrumentAddress);
        this.props.client.setICB(newInstrumentAddress, icbNew);

        // Send SysEx for CURRENT instrument
        this.props.client.setICB(this.props.instrumentAddress, this.state.icb)
        .then(() => {
          // Switch to next instrument
          this.props.handleNextInstrument(newInstrumentAddress);
          this.setState({ loading: false });
        });
      });
    }
    else {
      // Invalid address
      this.props.showError("No more RAM space for new voice layers!");
    }
  }
  
  _handleRemoveInstruments() {
    // Change nextInstrumentAddress to 0
    this.setState({ icb: this.state.icb.set('nextInstrumentAddress', 0) }, () => {
      // Update store
      instrumentActions.update(this.props.instrumentAddress, 'icb', this.state.icb);

      // Send to SysEx
      this.props.client.setICB(this.props.instrumentAddress, this.state.icb);
    });
  }
  
  _prevInstrument() {
    this.setState({ loading: true }, () => {
      this.props.handlePrevInstrument().then(() => {
        this.setState({ loading: false });
      });
    });
  }

  _nextInstrument(address) {
    this.setState({ loading: true }, () => {
      this.props.handleNextInstrument(address).then(() => {
        this.setState({ loading: false });
      });
    });
  }

  _setInstrument(address) {
    this.setState({ loading: true }, () => {
      this.props.handleSetInstrument(address).then(() => {
        this.setState({ loading: false });
      });
    });
  }
  
  render() {
    const { icb } = this.state;
    
    const name = (this.state.name !== null) ? this.state.name : icb.get('name');

    let header = (
      <h3>Instrument control ({this.props.instrumentAddress})</h3>
    );

    // Determine variables related to layering and CVs, use default 1-to-1 Wersi mapping for any next instrument addresses
    const firstInstrumentAddress = this.props.instrumentAddresses.first();
    const firstInstrument = firstInstrumentAddress == this.props.instrumentAddress;
    const firstInstrumentId = WersiClient.ADDRESS.id(firstInstrumentAddress);
    const currentInstrumentLayer = WersiClient.ADDRESS.layer(this.props.instrumentAddress);
    const nextInstrument = icb.get('nextInstrumentAddress') !== 0;
    const nextNewInstrumentAddress = WersiClient.ADDRESS.CV(firstInstrumentId, currentInstrumentLayer + 1);

    const firstCV = firstInstrumentId === 0;
    const lastCV = firstInstrumentId === WersiClient.ADDRESS.maxCVs;
    const prevCV = firstInstrumentAddress - 1;
    const nextCV = firstInstrumentAddress + 1;
    
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
                        let notification = null, useVCF = true;
                        
                        // Retrieve ICB addresses
                        const vcfAddress = json.icb.vcfAddress;
                        const waveAddress = json.icb.waveAddress;
                        const amplAddress = json.icb.amplAddress;
                        const freqAddress = json.icb.freqAddress;
                        console.log("Original ICB addresses: vcf " + vcfAddress + " wave " + waveAddress + " ampl " + amplAddress + " freq " + freqAddress);
                        
                        // Disable next instrument
                        json.icb.nextInstrumentAddress = 0;
                        
                        // Override these with 1-to-1 Wersi mapping
                        json.icb.waveAddress = this.props.instrumentAddress - 1;
                        json.icb.amplAddress = this.props.instrumentAddress - 1;
                        json.icb.freqAddress = this.props.instrumentAddress - 1;

                        // Check if we are importing the first layer
                        if (currentInstrumentLayer === 0) {
                          // Use a legit VCF address
                          json.icb.vcfAddress = this.props.instrumentAddress - 1;
                        }
                        else {
                          // Use global VCF address equal to VCF address of first address
                          // NOTE: we are assuming the first instrument ICB is actually stored in the store!
                          const firstVCFAddress = reactor.evaluate(instrumentGetters.byId(firstInstrumentAddress, 'icb')).get('vcfAddress');
                          console.log('Using VCF address from first instrument/layer: ' + firstVCFAddress);
                          notification = "Ignored VCF settings. VCF importing only supported for first layer.";
                          json.icb.vcfAddress = firstVCFAddress;
                          useVCF = false;
                        }
                        console.log("Remapped ICB addresses: vcf " + json.icb.vcfAddress + " wave " + json.icb.waveAddress + " ampl " + json.icb.amplAddress + " freq " + json.icb.freqAddress);

                        // Send to SysEx
                        this.setState({ loading: true, import: null, name: null, notification }, () => {
                          // react-notification onDismiss failure workaround
                          setTimeout(() => this.setState({ notification: null }), 2000);
                          
                          let p = this.props.client.setICB(this.props.instrumentAddress, toImmutable(json.icb))
                          .then(() => instrumentActions.update(this.props.instrumentAddress, 'icb', toImmutable(json.icb)))

                          .then((data) => this.props.client.setFixWave(json.icb.waveAddress, json.wave))
                          .then(() => instrumentActions.update(json.icb.waveAddress, 'wave', toImmutable(json.wave)))

                          .then((data) => this.props.client.setAmpl(json.icb.amplAddress, json.ampl))
                          .then(() => instrumentActions.update(json.icb.amplAddress, 'ampl', toImmutable(json.ampl)))
                        
                          //.then((data) => this.props.client.setFreq(json.icb.freqAddress, toImmutable(json.freq)))
                          //.then(() => instrumentActions.update(json.icb.freqAddress, 'freq', toImmutable(data)))
                          ;

                          if (useVCF) {
                            p = p.then((data) => this.props.client.setVCF(json.icb.vcfAddress, toImmutable(json.vcf)))
                            .then(() => instrumentActions.update(json.icb.vcfAddress, 'vcf', toImmutable(json.vcf)))
                            ;
                          }

                          p = p.then(() => this.props.client.reloadInstrument(this.props.firstInstrumentAddress))
                          .then(() => this.setState({ loading: false }))
                          ;
                        });
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
        <FormGroup>
          <Col sm={2} componentClass={ControlLabel}>Voice selection</Col>
          <Col sm={8}>
            <ButtonToolbar>
              <ButtonGroup>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="prevcvtooltip">Previous control voice</Tooltip>)}>
                  <Button onClick={() => this._setInstrument(prevCV)} bsStyle="primary" disabled={firstCV}><Glyphicon glyph="chevron-left"/></Button>
                </OverlayTrigger>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="nextcvtooltip">Next control voice</Tooltip>)}>
                  <Button onClick={() => this._setInstrument(nextCV)} bsStyle="primary" disabled={lastCV}><Glyphicon glyph="chevron-right"/></Button>
                </OverlayTrigger>
                <Button bsStyle="link" style={{ width: '11ch' }}>CV {firstInstrumentId} ({firstInstrumentAddress})</Button>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="importcvtooltip">Import control voice</Tooltip>)}>
                  <Button onClick={this._handleImport.bind(this)} bsStyle="primary"><Glyphicon glyph="import"/></Button>
                </OverlayTrigger>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="exportcvtooltip">Export control voice</Tooltip>)}>
                  <Button onClick={this._handleExport.bind(this)} bsStyle="primary"><Glyphicon glyph="export"/></Button>
                </OverlayTrigger>
              </ButtonGroup>
              <ButtonGroup>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="prevtooltip">Previous layer</Tooltip>)}>
                  <Button onClick={() => this._prevInstrument()} bsStyle="info" disabled={firstInstrument}><Glyphicon glyph="chevron-left"/></Button>
                </OverlayTrigger>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="nexttooltip">Next layer</Tooltip>)}>
                  <Button onClick={() => this._nextInstrument(icb.get('nextInstrumentAddress'))} bsStyle="info" disabled={!nextInstrument}><Glyphicon glyph="chevron-right"/></Button>
                </OverlayTrigger>
                <Button bsStyle="link" style={{ width: '11ch' }}>Layer {currentInstrumentLayer + 1} ({this.props.instrumentAddress})</Button>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="importtooltip">Import this layer</Tooltip>)}>
                  <Button onClick={this._handleImport.bind(this)} bsStyle="info"><Glyphicon glyph="import"/></Button>
                </OverlayTrigger>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="exporttooltip">Export this layer</Tooltip>)}>
                  <Button onClick={this._handleExport.bind(this)} bsStyle="info"><Glyphicon glyph="export"/></Button>
                </OverlayTrigger>
              </ButtonGroup>
              <ButtonGroup>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="nextlayertooltip">Add next layer</Tooltip>)}>
                  <Button onClick={() => this._handleNewInstrument(nextNewInstrumentAddress)} bsStyle="info" disabled={nextInstrument}><Glyphicon glyph="file"/></Button>
                </OverlayTrigger>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="removenextlayerstooltip">Remove next layers</Tooltip>)}>
                  <Button onClick={() => this._handleRemoveInstruments()} bsStyle="info" disabled={!nextInstrument}><Glyphicon glyph="remove"/></Button>
                </OverlayTrigger>
              </ButtonGroup>
            </ButtonToolbar>
          </Col>
        </FormGroup>
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
    
    return (
      <div>
        <Loader show={this.state.loading} message={(<h5>« Downloading... »</h5>)} contentBlur={2}>
          {modal}
          <Panel header={header} collapsible defaultExpanded>
            <ButtonToolbar className="pull-right">
              <Button onClick={this._handleSave.bind(this)} bsStyle="primary">Send</Button>
            </ButtonToolbar>
            {form}
          </Panel>
        </Loader>
        <Notification
          isActive={this.state.notification !== null}
          message={(this.state.notification !== null) ? this.state.notification : ""}
          barStyle={{ fontSize: 16, zIndex: 9999, opacity: 0.9 }}
        />
      </div>
    );
  }
}
