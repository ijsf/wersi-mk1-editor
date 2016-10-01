import React, { Component } from 'react';
import { toImmutable } from 'nuclear-js';

import WersiClient from 'modules/midi/WersiClient';
import { Button, Modal, Col, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';

import { actions as instrumentActions, getters as instrumentGetters } from 'modules/instrument/index';

export default class MidiConfig extends Component {
  constructor() {
    super();
    
    this.state = {
      status: "connecting",
      error: null,
      portsQueried: null,
      portIn: localStorage.getItem('portIn') || 0,
      portOut: localStorage.getItem('portOut') || 0,
      showConfig: true
    };
  }
  
  componentWillMount() {
    if (!this.props.client.isConnected()) {
      this.props.client.open(this.props.url, this.props.token)
      .then(() => {
        this.setState({ status: "connected" });
      })
      .catch(() => {
        this.setState({ status: "error", error: "Could not connect to sysexd at " + this.props.url });
      });
    }
  }
  
  componentDidUpdate() {
    if (this.state.status == "connected") {
      if (!this.state.portsQueried) {
        // Query ports
        this.props.client.query()
        .then((data) => {
          this.setState({
            portsQueried: data
          });
        })
        .catch(() => {
          this.setState({ status: "error", error: "Could not query MIDI ports" });
        });
      }
    }
  }
  
  _handleSubmit(e) {
    e.preventDefault();
    
    // Save selected ports in local storage
    localStorage.setItem('portIn', this.state.portIn);
    localStorage.setItem('portOut', this.state.portOut);
    
    // Set ports
    this.props.client.setPorts(this.state.portIn, this.state.portOut).then(() => {
      this._populateStore();
    });
    
    this.setState({ showConfig: false });
  }
  
  _populateStore() {
    //
    // Although the Wersi supports a very flexible ICB with block pointers,
    // we simply use a very naive 1-to-1 RAM address mapping for all instruments.
    //
    // Instrument 65 uses VCF 65, AMPL 65, FREQ 65, FIXWAVE 65.
    // Instrument 66 uses VCF 66, AMPL 66, FREQ 66, FIXWAVE 66.
    // etc.
    //
    // This leaves everything in RAM and unique to each instrument,
    // just the way we want it.
    //
    // NOTE that in order to enforce this, we override the ICB,
    // rendering any existing instruments potentially useless!
    //
    
    // Request all 10 FIXWAVEs from RAM
    this.props.client.getFixWave(65).then((wave) => {
      instrumentActions.update(65, 'wave', toImmutable(wave));
    });
  }
  
  render() {
    let modalContents;
    
    if (this.state.status == "connecting") {
      modalContents = (
        <Modal.Body>
          Connecting to sysexd at {this.props.url}.
        </Modal.Body>
      );
    }
    else if(this.state.status == "connected") {
      if (!this.state.portsQueried) {
        // Still querying ports
        modalContents = (
          <Modal.Body>
            Connected to sysexd at {this.props.url}.
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
                  ? "No available MIDI input and output ports could be found."
                  : "No available MIDI input ports could be found."
                : "No available MIDI output ports could be found."
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
                Please configure your MIDI input and output ports.
              </p>
              <FormGroup>
                <Col componentClass={ControlLabel} sm={3}>
                  Input port
                </Col>
                <Col sm={9}>
                  <FormControl value={this.state.portIn} componentClass="select" onChange={(e) => { this.setState({ portIn: Number(e.target.value) }); } }>
                    {this.state.portsQueried.inports.map((port, index) => {
                      return (<option value={index} key={"inport-" + index}>{port.name}</option>);
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
                      return (<option value={index} key={"outport-" + index}>{port.name}</option>);
                    })}
                  </FormControl>
                </Col>
              </FormGroup>
            </Modal.Body>
            <Modal.Footer>
              <Button bsStyle="primary" type="submit">Save changes</Button>
            </Modal.Footer>
          </Form>
        );
      }
    }
    else if(this.state.status == "error") {
      modalContents = (
        <Modal.Body>
          {this.props.error}
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
