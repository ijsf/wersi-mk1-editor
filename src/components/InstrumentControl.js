import React, { Component } from 'react';
import { Panel, Button, ButtonGroup, ButtonToolbar, Glyphicon, Checkbox, Modal, Col, Row, Form, FormGroup, InputGroup, FormControl, ControlLabel, Tooltip, OverlayTrigger } from 'react-bootstrap';
import Dropzone from 'react-dropzone';
import Loader from 'react-loader-advanced';
import { Notification } from 'react-notification';

import keydown from 'react-keydown';

import reactor from 'modules/flux';
import { toImmutable } from 'nuclear-js';

import WersiClient from 'modules/midi/WersiClient';

import { actions as instrumentActions, getters as instrumentGetters } from 'modules/instrument';

// Export file version
const FILE_VERSION = '1.0.0';

export default class InstrumentControl extends Component {
  constructor() {
    super();
    
    this.state = {
      name: null,
      notification: null,
      loading: false,
      double: true
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
    if (this.props.instrumentAddress) {
      this._watch(this.props.instrumentAddress, 'icb');
    }
  }
  
  componentWillUpdate(nextProps, nextState) {
    // Check if instrument has changed
    if (nextProps.instrumentAddress && this.props.instrumentAddress !== nextProps.instrumentAddress) {
      this._watch(nextProps.instrumentAddress, 'icb');
    }
  }
  
  _handleToggleDouble() {
    this.setState((state) => {
      return {
        double: !state.double
      };
    });
  }
  
  _handleImport(importCV) {
    // Show import modal
    this.setState({ import: 'Import your instrument below.', importCV });
  }
  
  async _importCV(json, firstInstrumentAddress) {
    let instrumentAddress = firstInstrumentAddress; // Start with the first address of this CV
    const firstInstrumentId = WersiClient.ADDRESS.id(firstInstrumentAddress, this.state.double);
    
    const numLayers = json.layers.length;
    for(let i = 0; i < numLayers; ++i) {
      const lastEntry = (i == numLayers - 1);
      const nextInstrumentAddress = lastEntry ? null : WersiClient.ADDRESS.CV(firstInstrumentId, i + 1, this.state.double);  // No next address for last layer
      const layer = json.layers[i];

      await this._importLayer(layer.data, firstInstrumentAddress, instrumentAddress, nextInstrumentAddress);
      instrumentAddress = nextInstrumentAddress;
    }
    
    // Always move to first instrument
    this._setInstrument(firstInstrumentAddress);
  }
  
  async _importLayer(json, firstInstrumentAddress, instrumentAddress, nextInstrumentAddress) {
    let useVCF = true;
    const currentInstrumentLayer = WersiClient.ADDRESS.layer(instrumentAddress, this.state.double);

    console.log(`Loading layer at ${instrumentAddress} (next instrument ${nextInstrumentAddress})`);

    // Retrieve ICB addresses
    const vcfAddress = json.icb.vcfAddress;
    const waveAddress = json.icb.waveAddress;
    const amplAddress = json.icb.amplAddress;
    const freqAddress = json.icb.freqAddress;
    
    // Make sure we keep the nextInstrumentAddress of our current ICB as not to destroy the CV chain, if specified
    if (nextInstrumentAddress !== null) {
      json.icb.nextInstrumentAddress = nextInstrumentAddress;
    }
    
    // Override these with 1-to-1 Wersi mapping
    json.icb.waveAddress = instrumentAddress - 1;
    json.icb.amplAddress = instrumentAddress - 1;
    json.icb.freqAddress = instrumentAddress - 1;

    // Check if we are importing the first layer
    if (currentInstrumentLayer === 0) {
      // Use a legit VCF address
      json.icb.vcfAddress = instrumentAddress - 1;
    }
    else {
      // Use global VCF address equal to VCF address of first address
      // NOTE: we are assuming the first instrument ICB is actually stored in the store!
      const firstVCFAddress = reactor.evaluate(instrumentGetters.byId(firstInstrumentAddress, 'icb')).get('vcfAddress');
      console.log('Using VCF address from first layer: ' + firstVCFAddress);
      json.icb.vcfAddress = firstVCFAddress;
      useVCF = false;
    }
    console.log('Remapped ICB addresses: vcf ' + json.icb.vcfAddress + ' wave ' + json.icb.waveAddress + ' ampl ' + json.icb.amplAddress + ' freq ' + json.icb.freqAddress);

    await this._sendLayer(instrumentAddress, json.icb, json.wave, json.ampl, json.freq, useVCF ? json.vcf : null);
    await this.props.client.reloadInstrument(firstInstrumentAddress);
  }

  async _sendLayer(instrumentAddress, icb, wave, ampl, freq, vcf) {
    await this.props.client.setICB(instrumentAddress, toImmutable(icb));
    await instrumentActions.update(instrumentAddress, 'icb', toImmutable(icb));

    await this.props.client.setFixWave(icb.waveAddress, wave);
    await instrumentActions.update(icb.waveAddress, 'wave', toImmutable(wave));

    await this.props.client.setAmpl(icb.amplAddress, ampl);
    await instrumentActions.update(icb.amplAddress, 'ampl', toImmutable(ampl));

    //await this.props.client.setAmpl(icb.amplAddress, freq);
    //await instrumentActions.update(icb.amplAddress, 'ampl', toImmutable(freq));
  
    if (vcf) {
      await this.props.client.setVCF(icb.vcfAddress, toImmutable(vcf));
      await instrumentActions.update(icb.vcfAddress, 'vcf', toImmutable(vcf));
    }
  }
  
  _exportLayer(icb, vcf, wave, ampl, freq) {
    // Strip addresses as we will regenerate them
    console.log(icb.toJS());
    icb = icb
    .delete('nextInstrumentAddress')
    .delete('vcfAddress')
    .delete('waveAddress')
    .delete('amplAddress')
    .delete('freqAddress')
    ;
    console.log(icb.toJS());
  
    return {
      icb: icb.toJS(),
      vcf: vcf,
      wave: wave,
      ampl: ampl,
      freq: freq
    };
  }
  
  async _handleExport(exportCV) {
    let json = null;

    // Read entire instrument store to JSON
    let icb = this.state.icb;
    let vcf = reactor.evaluate(instrumentGetters.byId(icb.get('vcfAddress'), 'vcf')).toJS();
    let wave = reactor.evaluate(instrumentGetters.byId(icb.get('waveAddress'), 'wave')).toJS();
    let ampl = Array.from(reactor.evaluate(instrumentGetters.byId(icb.get('amplAddress'), 'ampl')));
    let freq = null; //Array.from(reactor.evaluate(instrumentGetters.byId(icb.get('freqAddress'), 'freq')));

    if (exportCV) {
      // Export all layers in this CV

      json = {
        type: 'cv',
        version: FILE_VERSION,
        layers: []
      };

      // Iterate over all instrument layers using their next pointers
      let instrumentAddress = this.props.instrumentAddress;
      do {
        // Read current instrument from store to JSON
        console.log(`Exporting layer ${instrumentAddress}`);
        json.layers.push({
          instrumentAddress: instrumentAddress,
          data: this._exportLayer(icb, vcf, wave, ampl, freq)
        });
        
        // Try to get/fetch next instrument address
        const nextInstrumentAddress = icb.get('nextInstrumentAddress');
        icb = toImmutable(await this.props.client.getICB(nextInstrumentAddress));
        vcf = toImmutable(await this.props.client.getVCF(icb.get('vcfAddress')));
        wave = toImmutable(await this.props.client.getFixWave(icb.get('waveAddress')));
        ampl = toImmutable(await Array.from(instrumentGetters.byId(icb.get('amplAddress'), 'ampl')));
        freq = null; //toImmutable(await Array.from(instrumentGetters.byId(icb.get('amplAddress'), 'freq')));
        instrumentAddress = nextInstrumentAddress;
      } while(instrumentAddress != 0);
    }
    else {
      // Export one layer

      json = this._exportLayer(icb, vcf, wave, ampl, freq);
      json.type = 'layer';
      json.version = FILE_VERSION;
    }
    if (json) {
      // Store to state, show export modal
      let file = new Blob([JSON.stringify(json)], { type: 'application/json' });
      let url = URL.createObjectURL(file);
      this.setState({ export: url, exportCV: exportCV });
    }
    else {
      // Error occurred trying to construct JSON
    }
  }
  
  // I hotkey saves
  @keydown('i')
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
      this.props.showError('No more RAM space for new layers!');
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

    // Determine name
    let name = "";
    if (this.state.name !== null) {
      name = this.state.name;
    }
    else if (icb) {
      name = icb.get('name');
    }

    // Determine variables related to layering and CVs, use default 1-to-1 Wersi mapping for any next instrument addresses
    const firstInstrumentAddress = icb ? this.props.instrumentAddresses.first() : -1;
    const currentCV = icb ? firstInstrumentAddress : -1;
    const firstInstrument = icb ? firstInstrumentAddress == this.props.instrumentAddress : -1;
    const firstInstrumentId = icb ? WersiClient.ADDRESS.id(firstInstrumentAddress, this.state.double) : -1;
    const currentInstrumentLayer = icb ? WersiClient.ADDRESS.layer(this.props.instrumentAddress, this.state.double) : -1;
    const lastInstrumentLayer = icb ? WersiClient.ADDRESS.maxLayers(this.state.double) : -1;
    const nextInstrumentAddress = icb ? icb.get('nextInstrumentAddress') : -1;
    const nextInstrument = icb ? nextInstrumentAddress !== 0 : -1;
    const nextNewInstrumentAddress = icb ? WersiClient.ADDRESS.CV(firstInstrumentId, currentInstrumentLayer + 1, this.state.double) : -1;
    const lastInstrumentId = icb ? WersiClient.ADDRESS.maxCVs(this.state.double) : -1;

    const firstCV = icb ? firstInstrumentId === 0 : -1;
    const lastCV = icb ? firstInstrumentId === WersiClient.ADDRESS.maxCVs(this.state.double) : -1;
    const prevCV = icb ? currentCV - 1 : -1;
    const nextCV = icb ? currentCV + 1 : -1;
    
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
    let modal = icb ? (
      <Modal show={(this.state.export || this.state.import) ? true : false}>
        <Modal.Header>
          <Modal.Title>{(this.state.export ? 'Export' : 'Import') + ' ' + (this.state.importCV ? 'CV' : 'layer')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            {this.state.export ? 'Your instrument has been exported to a JSON file.' : null}
            {this.state.import ? this.state.import : null}
          </p>
          {this.state.export
            ? (
              <p>
                <a download={`${icb.get('name')}.${this.state.exportCV ? 'cv' : 'layer'}.json`} href={this.state.export} onClick={() => this.setState({ export: null })}>
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
                        
                        // Check if JSON is the right version
                        if (json.version !== FILE_VERSION) {
                          throw `Invalid version (expected ${FILE_VERSION})`;
                        }
                        
                        if (this.state.importCV) {
                          // Import a CV
                          if (json.type !== 'cv') {
                            throw 'Not a CV export.'
                          }
                          this.setState({ loading: true, import: null, name: null }, async () => {
                            await this._importCV(json, firstInstrumentAddress);
                            this.setState({ loading: false });
                          });
                        }
                        else {
                          // Import a single layer
                          if (json.type !== 'layer') {
                            throw 'Not a layer export.'
                          }
                          this.setState({ loading: true, import: null, name: null }, async () => {
                            await this._importLayer(json, this.props.firstInstrumentAddress, this.props.instrumentAddress, nextInstrumentAddress);
                            this.setState({ loading: false });

                            /*
                            // react-notification onDismiss failure workaround
                            setTimeout(() => this.setState({ notification: null }), 2000);
                            */
                          });
                        }
                      }
                      catch (e) {
                        this.setState({ import: 'Could not load your JSON file! Please try again.' });
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
    ) : null;
    
    let form = (
      <Form horizontal>
        <FormGroup>
          <Col sm={10}>
            <ButtonToolbar>
              <ButtonGroup>
                <OverlayTrigger placement="bottom" overlay={firstCV ? (<div/>) : (<Tooltip className="info" id="prevcvtooltip">Previous CV</Tooltip>)}>
                  <Button onClick={() => this._setInstrument(prevCV)} bsStyle="primary" disabled={!icb || firstCV}><Glyphicon glyph="chevron-left"/></Button>
                </OverlayTrigger>
                <OverlayTrigger placement="bottom" overlay={lastCV ? (<div/>) : (<Tooltip className="info" id="nextcvtooltip">Next CV</Tooltip>)}>
                  <Button onClick={() => this._setInstrument(nextCV)} bsStyle="primary" disabled={!icb || lastCV}><Glyphicon glyph="chevron-right"/></Button>
                </OverlayTrigger>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="reloadcvtooltip">Reload CV</Tooltip>)}>
                  <Button onClick={() => this._setInstrument(currentCV)} bsStyle="primary" disabled={!icb}><Glyphicon glyph="refresh"/></Button>
                </OverlayTrigger>
                <Button bsStyle="link" style={{ width: '16ch' }}>CV {firstInstrumentId + 1} of {lastInstrumentId + 1} ({firstInstrumentAddress})</Button>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="importcvtooltip">Load CV from file</Tooltip>)}>
                  <Button onClick={() => this._handleImport(true)} bsStyle="primary" disabled={!icb}><Glyphicon glyph="folder-open"/></Button>
                </OverlayTrigger>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="exportcvtooltip">Save CV to file</Tooltip>)}>
                  <Button onClick={() => this._handleExport(true)} bsStyle="primary" disabled={!icb}><Glyphicon glyph="floppy-disk"/></Button>
                </OverlayTrigger>
              </ButtonGroup>
              <ButtonGroup style={{ paddingLeft: '2em' }}>
                <OverlayTrigger placement="bottom" overlay={firstInstrument ? (<div/>) : (<Tooltip className="info" id="prevtooltip">Previous layer</Tooltip>)}>
                  <Button onClick={() => this._prevInstrument()} bsStyle="info" disabled={!icb || firstInstrument}><Glyphicon glyph="chevron-left"/></Button>
                </OverlayTrigger>
                <OverlayTrigger placement="bottom" overlay={!nextInstrument ? (<div/>) : (<Tooltip className="info" id="nexttooltip">Next layer</Tooltip>)}>
                  <Button onClick={() => this._nextInstrument(icb.get('nextInstrumentAddress'))} bsStyle="info" disabled={!icb || !nextInstrument}><Glyphicon glyph="chevron-right"/></Button>
                </OverlayTrigger>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="reloadlyaertooltip">Reload layer</Tooltip>)}>
                  <Button onClick={() => this._setInstrument(this.props.instrumentAddress)} bsStyle="info" disabled={!icb}><Glyphicon glyph="refresh"/></Button>
                </OverlayTrigger>
                <Button bsStyle="link" style={{ width: '16ch' }}>Layer {currentInstrumentLayer + 1} ({this.props.instrumentAddress})</Button>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="importtooltip">Load layer from file</Tooltip>)}>
                  <Button onClick={() => this._handleImport(false)} bsStyle="info" disabled={!icb}><Glyphicon glyph="folder-open"/></Button>
                </OverlayTrigger>
                <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="exporttooltip">Save layer to file</Tooltip>)}>
                  <Button onClick={() => this._handleExport(false)} bsStyle="info" disabled={!icb}><Glyphicon glyph="floppy-disk"/></Button>
                </OverlayTrigger>
              </ButtonGroup>
              <ButtonGroup>
                <OverlayTrigger placement="bottom" overlay={nextInstrument ? (<div/>) : (<Tooltip className="info" id="nextlayertooltip">Append new layer</Tooltip>)}>
                  <Button onClick={() => this._handleNewInstrument(nextNewInstrumentAddress)} bsStyle="info" disabled={!icb || nextInstrument}><Glyphicon glyph="file"/></Button>
                </OverlayTrigger>
                <OverlayTrigger placement="bottom" overlay={!nextInstrument ? (<div/>) : (<Tooltip className="info" id="removenextlayerstooltip">Delete all following layers</Tooltip>)}>
                  <Button onClick={() => this._handleRemoveInstruments()} bsStyle="info" disabled={!icb || !nextInstrument}><Glyphicon glyph="trash"/></Button>
                </OverlayTrigger>
              </ButtonGroup>
            </ButtonToolbar>
          </Col>
        </FormGroup>
        <FormGroup controlId="name">
          <Col sm={2} componentClass={ControlLabel}>Name</Col>
          <Col sm={3}>
            <OverlayTrigger placement="bottom" overlay={firstInstrument ? (<div/>) : (<Tooltip className="info" id="nametooltip">Only the first layer name will affect the CV name</Tooltip>)}>
              <FormControl value={name} type="text" maxLength="6" placeholder="Instrument name" maxLength={6}
                onChange={icb ? ((event) => this.setState({ name: event.target.value })) : null}
                onBlur={icb ? ((event) => handleInputSet('name', event.target.value)) : null}
              />
            </OverlayTrigger>
          </Col>
        </FormGroup>
        <FormGroup controlId="dynamics">
          <Col sm={2} componentClass={ControlLabel}>Dynamics</Col>
          <Col sm={3}>
            <InputGroup>
              <InputGroup.Addon>Level</InputGroup.Addon>
              <FormControl componentClass="select"
                value={icb ? icb.get('dynamics') : null}
                onChange={icb ? ((event) => handleInputSet('dynamics', event.target.value)) : null}>
                {Array.from(['None', 'Medium', 'Strong', 'Full'], (v, k) => {
                  return (<option value={k} key={'dynamics-' + k}>{v}</option>);
                })}
              </FormControl>
            </InputGroup>
          </Col>
          <Col sm={3}>
            <ButtonToolbar>
              <Button disabled={!icb} active={icb ? icb.get('voiceSelectLower') : false} onClick={() => handleButtonToggle('voiceSelectLower')}>Lower</Button>
              <Button disabled={!icb} active={icb ? icb.get('voiceSelectUpper') : false} onClick={() => handleButtonToggle('voiceSelectUpper')}>Upper</Button>
            </ButtonToolbar>
          </Col>
        </FormGroup>
        <FormGroup controlId="tuning">
          <Col sm={2} componentClass={ControlLabel}>Tuning</Col>
          <Col sm={3}>
            <InputGroup>
              <InputGroup.Addon>Transpose</InputGroup.Addon>
              <FormControl componentClass="select"
                value={icb ? icb.get('transpose') : null}
                onChange={icb ? ((event) => handleInputSet('transpose', event.target.value)) : null}>
                {Array.from({length: 1 + 12 * transposeRange * 2}, (v, k) => {
                  const val = -12 * transposeRange + k;
                  return (<option value={val} key={'transpose-' + k}>{val > 0 ? '+' : ''}{val}</option>);
                })}
              </FormControl>
            </InputGroup>
          </Col>
          <Col sm={3}>
            <InputGroup>
              <InputGroup.Addon>Detune</InputGroup.Addon>
              <FormControl componentClass="select"
                value={icb ? icb.get('detune') : null}
                onChange={icb ? ((event) => handleInputSet('detune', event.target.value)) : null}>
                {Array.from({length: 1 + 12 * detuneRange * 2}, (v, k) => {
                  const val = -12 * detuneRange + k;
                  return (<option value={val} key={'detune-' + k}>{val > 0 ? '+' : ''}{val}</option>);
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
                <FormControl componentClass="select"
                value={icb && firstInstrument ? icb.get('wvMode') : 0}
                onChange={icb ? ((event) => firstInstrument ? handleInputSet('wvMode', event.target.value) : false) : null}>
                >
                {!icb || firstInstrument
                  ? Array.from(['Rotor Slow', 'Rotor Fast', 'Flanger', 'Strings', 'Chorus'], (v, k) => {
                      return (<option value={k} key={'mode-' + k}>{v}</option>);
                    })
                    : (<option value={0}>First layer only</option>)
                }
              </FormControl>
            </InputGroup>
          </Col>
          <Col sm={5}>
            <ButtonToolbar>
              <Button active={icb ? icb.get('wvFeedbackStereoFlat') : false} disabled={!icb || !firstInstrument} onClick={() => handleButtonToggle('wvFeedbackStereoFlat')}>Flat</Button>
              <Button active={icb ? icb.get('wvFeedbackDeep') : false} disabled={!icb || !firstInstrument} onClick={() => handleButtonToggle('wvFeedbackDeep')}>Deep</Button>
            </ButtonToolbar>
          </Col>
        </FormGroup>
        <FormGroup>
          <Col sm={2} componentClass={ControlLabel}>Output</Col>
          <Col sm={8}>
            <ButtonToolbar>
              <span className="btn btn-link">Layer</span>
              <span className="btn btn-link">⤑</span>
              <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="brighttooltip">80 Hz low-pass filter</Tooltip>)}>
                <Button disabled={!icb} active={icb ? icb.get('routeBright') : false} onClick={() => handleButtonToggle('routeBright')}>Bright</Button>
              </OverlayTrigger>
              <span className="btn btn-link">⤑</span>
              <Button disabled={!icb} active={icb ? icb.get('routeLeft') : false} onClick={() => handleButtonToggle('routeLeft')}>Left</Button>
              <Button disabled={!icb} active={icb ? icb.get('routeRight') : false} onClick={() => handleButtonToggle('routeRight')}>Right</Button>
              <Button disabled={!icb} active={icb ? icb.get('routeWV') : false} onClick={() => handleButtonToggle('routeWV')}>WersiVoice</Button>
              <Button disabled={!icb} active={icb ? icb.get('routeVCF') : false} onClick={() => handleButtonToggle('routeVCF')}>VCF</Button>
            </ButtonToolbar>
          </Col>
        </FormGroup>
      </Form>
    );
    
    return (
      <div>
        <Loader show={this.state.loading} message={(<h5>« Downloading... »</h5>)} contentBlur={2}>
          {modal}
          <Panel
            header={(<h3>Instrument control <sup>{`${this.props.instrumentAddress || ''}`}</sup></h3>)}
            collapsible
            defaultExpanded
            >
            <ButtonToolbar className="pull-right">
              <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="doubletooltip">Toggle double layer mode</Tooltip>)}>
                <Button onClick={this._handleToggleDouble.bind(this)} active={this.state.double}><Glyphicon glyph="random"/></Button>
              </OverlayTrigger>
              <OverlayTrigger placement="bottom" overlay={(<Tooltip className="info" id="savetooltip">Save instrument control (hotkey I)</Tooltip>)}>
                <Button onClick={this._handleSave.bind(this)} bsStyle="primary"><Glyphicon glyph="save"/></Button>
              </OverlayTrigger>
            </ButtonToolbar>
          {form}
          </Panel>
        </Loader>
        <Notification
          isActive={this.state.notification !== null}
          message={(this.state.notification !== null) ? this.state.notification : ''}
          barStyle={{ fontSize: 16, zIndex: 9999, opacity: 0.9 }}
        />
      </div>
    );
  }
}
