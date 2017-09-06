import React, { Component } from 'react';
import { toImmutable } from 'nuclear-js';

import WersiClient from 'modules/midi/WersiClient';
import { Button, Modal, Col, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';

import { actions as instrumentActions, getters as instrumentGetters } from 'modules/instrument/index';

export default class MidiConfig extends Component {
  constructor() {
    super();
    
    this.state = {
      status: 'connecting',
      error: null,
      portsQueried: null,
      portIn: localStorage.getItem('portIn') || 0,
      portOut: localStorage.getItem('portOut') || 0,
      showConfig: true,
      wersiConnecting: false
    };
  }
  
  componentWillMount() {
    if (!this.props.client.isConnected()) {
      this.props.client.open()
      .then((portsQueried) => {
        this.setState({ status: 'sysexConnected', portsQueried });
      })
      .catch(() => {
        this.setState({ status: 'error', error: 'Could not connect to WebMIDI API.' });
      });
    }
  }
  
  _handleSubmit(e) {
    e.preventDefault();
    
    // Save selected ports in local storage
    localStorage.setItem('portIn', this.state.portIn);
    localStorage.setItem('portOut', this.state.portOut);
    
    // Set ports
    this.props.client.setPorts(this.state.portIn, this.state.portOut).then(() => {
      if (this.props.populateCallback) {
        this.props.populateCallback();
      }
    });
    
    // Set wersi connecting state
    this.setState({ wersiConnecting: true });
    
    // Try to send a SysEx message to see if the synthesizer is responsive
    this.props.client.getICB(WersiClient.ADDRESS.CV(0))
    .then(() => {
      // Everything checks out, so hide this dialog
      this.setState({ showConfig: false });
    })
    .catch((error) => {
      // An error has occurred, so try to find out what happened
      if(!this.props.client.isFirmwarePatched()) {
        // Unpatched firmware
        this.setState({ status: 'unpatched' });
      }
      else {
        this.setState({ status: 'error' });
      }
    })
    ;
  }
  
  render() {
    let modalContents;
    
    if (this.state.status == 'connecting') {
      modalContents = (
        <Modal.Body>
          Connecting to WebMIDI API.
        </Modal.Body>
      );
    }
    else if(this.state.status == 'sysexConnected') {
      if (!this.state.portsQueried) {
        // Still querying ports
        modalContents = (
          <Modal.Body>
            Connected to WebMIDI API.
          </Modal.Body>
        );
      }
      else if (!this.state.portsQueried.inports || !this.state.portsQueried.outports) {
        // No available in- or outports
        modalContents = (
          <Modal.Body>
            <p>
              {!this.state.portsQueried.inports
                ? !this.state.portsQueried.outports
                  ? 'No available MIDI input and output ports could be found.'
                  : 'No available MIDI input ports could be found.'
                : 'No available MIDI output ports could be found.'
              }
            </p>
            <p>
              This application requires at least one MIDI input and one MIDI output port to be available.
              Please connect your MIDI interface hardware and make sure you have the appropriate drivers installed,
              and try again.
            </p>
          </Modal.Body>
        );
      }
      else {
        // Ports received, show options
        modalContents = (
          <Form horizontal onSubmit={this._handleSubmit.bind(this)}>
            <Modal.Body>
              <p>
                Before you continue, please make sure SysEx functionality is enabled on your synthesizer:
              </p>
              <ol>
                <li>Press H followed by F to enter the MIDI settings.</li>
                <li>Press C. Ensure 8 (SysEx) is lit, then ensure 1 (Stop) is not lit, and press 1 twice.</li>
                <li>Press B. Ensure 8 (SysEx) is lit, then ensure 1 (Stop) is not lit, and press 1 twice.</li>
                <li>Press H to exit the MIDI settings.</li>
              </ol>
              <p>
                Select the MIDI input and output ports that connect to your synthesizer.
              </p>
              <FormGroup>
                <Col componentClass={ControlLabel} sm={3}>
                  Input port
                </Col>
                <Col sm={9}>
                  <FormControl value={this.state.portIn} componentClass="select" onChange={(e) => { this.setState({ portIn: Number(e.target.value) }); } }>
                    {this.state.portsQueried.inports.map((port, index) => {
                      return (<option value={index} key={'inport-' + index}>{port.name}</option>);
                    })}
                  </FormControl>
                </Col>
              </FormGroup>
              <FormGroup>
                <Col componentClass={ControlLabel} sm={3}>
                  Output port
                </Col>
                <Col sm={9}>
                  <FormControl value={this.state.portOut} componentClass="select" onChange={(e) => { this.setState({ portOut: Number(e.target.value) }); } }>
                    {this.state.portsQueried.outports.map((port, index) => {
                      return (<option value={index} key={'outport-' + index}>{port.name}</option>);
                    })}
                  </FormControl>
                </Col>
              </FormGroup>
            </Modal.Body>
            <Modal.Footer>
              <Button bsStyle="primary" type="submit" disabled={this.state.wersiConnecting}>
                {this.state.wersiConnecting ? 'Connecting...' : 'Connect'}
              </Button>
            </Modal.Footer>
          </Form>
        );
      }
    }
    else if(this.state.status == 'unpatched') {
      modalContents = (
        <Modal.Body>
          <p>
            It appears that your device is running the original operating system firmware ROM.
            This firmware contains a number of unfortunate bugs that prevent this editor from working properly.
          </p>
          <p>
            In order to use this editor, it is therefore necessary to update the firmware to a newer patched version.
          </p>
          <p>
            Please refer to the firmware section at <a href="http://wer.si">wer.si</a> for more information.
          </p>
        </Modal.Body>
      );
    }
    else if(this.state.status == 'error') {
      modalContents = (
        <Modal.Body>
          {this.props.error || 'An error occurred while trying to communicate with your device.'}
        </Modal.Body>
      );
    }

    return (
      <div>
        <Modal show={this.state.showConfig}>
          <Modal.Header>
            <Modal.Title>MIDI configuration</Modal.Title>
          </Modal.Header>
          {modalContents}
        </Modal>
      </div>
    );
  }
}
