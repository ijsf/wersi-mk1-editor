import React, { Component, PropTypes } from 'react';
import update from 'react/lib/update';
import { Overlay, OverlayTrigger, Tooltip, Well, Panel, Button, Checkbox, Modal, Col, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';

import reactMixin from 'react-mixin';
import reactor from 'modules/flux';
import { toImmutable } from 'nuclear-js';

import EnvelopeDialog from 'components/EnvelopeDialog';
import EnvelopeModule from 'components/envelope/EnvelopeModule';
import EnvelopeModuleConstAbs from 'components/envelope/EnvelopeModuleConstAbs';
import EnvelopeModuleConstRel from 'components/envelope/EnvelopeModuleConstRel';
import EnvelopeModuleDynExpDown from 'components/envelope/EnvelopeModuleDynExpDown';
import EnvelopeModuleDynExpUp from 'components/envelope/EnvelopeModuleDynExpUp';
import EnvelopeModuleDynLinDown from 'components/envelope/EnvelopeModuleDynLinDown';
import EnvelopeModuleDynLinUp from 'components/envelope/EnvelopeModuleDynLinUp';
import EnvelopeModuleDynRemain from 'components/envelope/EnvelopeModuleDynRemain';
import EnvelopeModuleEmpty from 'components/envelope/EnvelopeModuleEmpty';
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

import { DropTarget, DragDropContext } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

import { actions as instrumentActions, getters as instrumentGetters } from 'modules/instrument';

const moduleTarget = {
  drop(props, monitor, component) {
    // Indicate that we just dropped
    component.setState((state) => {
      return {
        dropCount: state.dropCount + 1
      };
    });
  }
};

@DragDropContext(HTML5Backend)
@DropTarget("envelope", moduleTarget, connect => ({
  connectDropTarget: connect.dropTarget()
}))

class Envelope extends Component {
  static propTypes = {
    connectDropTarget: PropTypes.func.isRequired
  };
  
  static defaultProps = {
    ...Component.defaultProps,
    moduleSlots: 7,
    moduleMargin: 5,
    moduleWidth: 122,
    moduleHeight: 190
  };
  
  constructor(props) {
    super(props);
    
    this.state = {
      showAdd: false,
      modules: null,
      dropCount: 0,
      releasePhaseStart: 3
    };
    
    this._unwatch = null;
    
    // References to all EnvelopeModule components
    this._moduleEls = [];
    
    // Use global modules variable to allow simple communication between modules
    window.envelopeModules = [];
  }
  
  componentDidUpdate() {
  }
  
  shouldComponentUpdate(nextProps, nextState) {
    // Check if we just dropped a module
    if (this.state.dropCount !== nextState.dropCount) {
      // NOTE: this is a hacky anti-pattern!
      this._moduleEls.forEach((dnd) => {
        const module = dnd.getDecoratedComponentInstance().getDecoratedComponentInstance();
        module.saveModule();
      });
      return false;
    }
    return true;
  }
  
  componentWillMount() {
    // Register observer (databindings do not work because of retarded conflicts with decorators)
    this._unwatch = reactor.observe(instrumentGetters.byId(this.props.instrumentId, this.props.type), (dataNormal) => {
      // Convert to Uint8Array
      const data = new Uint8Array(dataNormal);
      
      // Dissect attack and release data
      let releasePhaseStart = (data[1] - 2) / 6;
      if (releasePhaseStart > 6) {
        // Release disabled, just enable it for now and fix it on the last module
        releasePhaseStart = 6;
      }
      console.log(data[0] + ' ' + data[1] + ' releasePhaseStart ' + releasePhaseStart);
      
      // Dissect module data (6 bytes each, 7 modules)
      let modules = [];
      for(let i = 0; i < 7; ++i) {
        modules.push(this._handleLoadModule(i, data));
      }
      this.setState({
        modules: modules,
        data: data,
        releasePhaseStart: releasePhaseStart
      });
    });
  }
  
  componentWillUnmount() {
    // Unregister observer
    if (this._unwatch) {
      this._unwatch();
    }
  }
  
  _handleAdd() {
    this.setState({ showAdd: true });
  }
  
  _handleSave() {
    // Set attack and release offsets (attack always starts at 2, module 0).
    const releaseOffset = 2 + (this.state.releasePhaseStart * 6);
    this.state.data[0] = 2;
    this.state.data[1] = releaseOffset;
    
    // Send to SysEx
    this.props.client.setAmpl(this.props.instrumentId, this.state.data)
    .then(() => {
      // Refresh data in case the Wersi has made any changes
      return this.props.client.getAmpl(this.props.instrumentId);
    })
    .then((data) => {
      // Update store
      instrumentActions.update(65, 'ampl', toImmutable(data));
      
      // Reload instrument
      return this.props.client.reloadInstrument(this.props.instrumentId);
    })
    ;
  }

  _handleLoadModule(id, data) {
    const offset = 2 + id * 6;
    const moduleData = data.slice(offset, offset + 6);
    let type;
    
    // Detect type
    const id1 = moduleData[0] & 0xF;
    const id2 = moduleData[2] & 0xFF;
    const id23 = ((moduleData[2] & 0xFF) << 4) | (moduleData[3] & 0xF);
    if      (id1 === 0x3 && id23 === 0x68D)    { type = 'linup'; }
    else if (id1 === 0x3 && id23 === 0x889)    { type = 'lindown'; }
    else if (id1 === 0x2 && id23 === 0xE0D)    { type = 'expup'; }
    else if (id1 === 0x2 && id23 === 0xF09)    { type = 'expdown'; }
    else if (id1 === 0x1 && id2 === 0x000)     { type = 'constabs'; }
    else if (id1 === 0x5 && id2 === 0x000)     { type = 'constrel'; }
    else                                       { type = 'empty'; }

    console.log(type + ': ' + (Array.from(moduleData).map(function (x) {return x.toString(16);})).join(";"));
    
    return {
      id: id,
      data: moduleData,
      type: type
    };
  }
  
  _handleSaveModule(index, moduleData, props) {
    // Construct buffer
    let buffer = new Uint8Array(moduleData.length + 1);
    buffer.set(moduleData, 0);
    
    // Add epilogue if necessary
    if (props.epilogue) {
      let dataId = 0xC4 + index * 6;
      buffer[moduleData.length] = dataId;
    }
    
    // Splice into existing data
    let data = this.state.data;
    data.set(buffer, 2 + index * 6);
    
    // Update store (store as normal array)
    instrumentActions.update(this.props.instrumentId, this.props.type, Array.prototype.slice.call(data));
  }
  
  _moveModule(id, atIndex) {
    const { module, index } = this._findModule(id);
    this.setState(update(this.state, {
      modules: {
        $splice: [
          [index, 1],
          [atIndex, 0, module]
        ]
      }
    }));
  }

  _findModule(id) {
    const { modules } = this.state;
    const module = modules.filter(c => c.id === id)[0];

    return {
      module,
      index: modules.indexOf(module)
    };
  }
  
  _handleAddedModule() {
    // Module has just been added, hide add dialog
    this.setState({ showAdd: false });
  }
  
  _createModules(modules) {
    const { moduleWidth, moduleHeight, moduleMargin, moduleSlots, title } = this.props;

    this._moduleEls = [];
    
    return modules.map((module, index) => {
      // Determine if this is a release module
      const release = (index >= this.state.releasePhaseStart);
      
      // Set up props
      let moduleProps = {
        key: module.id,
        id: module.id,  // unique identifier
        index: index,   // linear index
        width: moduleWidth,
        height: moduleHeight,
        margin: moduleMargin,
        moveModule: this._moveModule.bind(this),
        findModule: this._findModule.bind(this),
        save: this._handleSaveModule.bind(this, index),   // use linear index here
        data: module.data,
        color: release ? 'thistle' : 'lightsteelblue',
        relaease: release
      };
  
      // Create element
      let el;
      if (module.type === "linup")          { el = (<EnvelopeModuleLinUp {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === "lindown")   { el = (<EnvelopeModuleLinDown {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === "expup")     { el = (<EnvelopeModuleExpUp {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === "expdown")   { el = (<EnvelopeModuleExpDown {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === "constabs")  { el = (<EnvelopeModuleConstAbs {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === "constrel")  { el = (<EnvelopeModuleConstRel {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else                                  { el = (<EnvelopeModuleEmpty {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      return el;
    });
  }
  
  render() {
    const { connectDropTarget, moduleWidth, moduleHeight, moduleMargin, moduleSlots, title, type } = this.props;
    const { modules, releasePhaseStart } = this.state;
    
    const width = moduleMargin + moduleSlots * (moduleMargin + moduleWidth);
    const padding = moduleMargin;
    
    let header = (
      <h3>{title}</h3>
    );
    
    // Release slider
    let releaseSlider = (
      <div style={{ width: width, position: 'relative', left: moduleWidth * 0.5, marginTop: 10 }}>
        <OverlayTrigger
        placement="bottom"
        overlay={<Tooltip className="info" id="tooltipRelease">Start of release phase</Tooltip>}
        >
          <input type="range"
          style={{ width: width - moduleWidth }}
          value={ releasePhaseStart }
          min={0}
          max={6}
          onChange={(event) => {
            this.setState({ releasePhaseStart: Number(event.target.value) });
          }}
          />
        </OverlayTrigger>
      </div>
      );
    
    return connectDropTarget(
      <div>
        <Panel header={header} collapsible defaultExpanded>
          <EnvelopeDialog 
          show={this.state.showAdd}
          moduleWidth={moduleWidth}
          moduleHeight={moduleHeight}
          moduleMargin={moduleMargin}
          cancel={() => {this.setState({ showAdd: false })}}
          addedModule={this._handleAddedModule.bind(this)}
          save={this._handleSaveModule.bind(this, 6)}   // always add in the 6th slot
          />
          <div className="clearfix" style={{ paddingBottom: 10 }}>
            <Button onClick={this._handleSave.bind(this)} className="pull-right" bsStyle="primary">
              Save
            </Button>
            <Button onClick={this._handleAdd.bind(this)} className="pull-right">
              Add
            </Button>
          </div>
          <Well bsSize="small">
          <div style={{
            width: width,
            paddingLeft: moduleMargin,
            paddingTop: moduleMargin,
            paddingBottom: moduleMargin
          }}>
            {modules ? this._createModules(modules) : "No modules available."}
            {releaseSlider}
          </div>
          </Well>
        </Panel>
      </div>
    );
  }
}

export default Envelope;
