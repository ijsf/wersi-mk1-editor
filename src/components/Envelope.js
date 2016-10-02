import React, { Component, PropTypes } from 'react';
import update from 'react/lib/update';
import { Well, Panel, Button, Checkbox, Modal, Col, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';

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
  drop() {
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
    moduleHeight: 160
  };
  
  constructor(props) {
    super(props);
    
    this.state = {
      showAdd: false,
      modules: null
    };
    
    this._unwatch = null;
  }
  
  componentWillMount() {
    // Register observer (databindings do not work because of retarded conflicts with decorators)
    this._unwatch = reactor.observe(instrumentGetters.byId(this.props.instrumentId, this.props.type), (dataNormal) => {
      // Convert to Uint8Array
      const data = new Uint8Array(dataNormal);
      
      // Dissect data (6 bytes each, 7 modules)
      let modules = [];
      for(let i = 0; i < 7; ++i) {
        modules.push(this._handleLoadModule(i, data));
      }
      this.setState({
        modules: modules,
        data: data
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
    const id2 = ((moduleData[2] & 0xFF) << 4) | (moduleData[3] & 0xF);
    if      (id1 === 0x3 && id2 === 0x68D)    { type = 'linup'; }
    else if (id1 === 0x3 && id2 === 0x889)    { type = 'lindown'; }
    else                                      { type = 'empty'; }
    
    return {
      id: id,
      data: moduleData,
      type: type
    };
  }
  
  _handleSaveModule(id, moduleData) {
    // Construct buffer with epilogue
    let dataId = 0xC4 + id * 6;
    let buffer = new Uint8Array(moduleData.length + 1);
    buffer.set(moduleData, 0);
    buffer[moduleData.length] = dataId;
    
    // Splice into existing data
    let data = this.state.data;
    data.set(buffer, 2 + id * 6);
    
    // Update store (store as normal array)
    instrumentActions.update(this.props.instrumentId, this.props.type, Array.prototype.slice.call(data));
  }
  
  _moveModule(id, atIndex) {
    // TODO: update module.id!
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
  
  _createModules(modules) {
    const { moduleWidth, moduleHeight, moduleMargin, moduleSlots, title } = this.props;

    // Use global modules variable to allow simple communication between modules
    window.envelopeModules = [];
    
    return modules.map(module => {
      // Set up props
      let moduleProps = {
        key: module.id,
        id: module.id,
        width: moduleWidth,
        height: moduleHeight,
        margin: moduleMargin,
        moveModule: this._moveModule.bind(this),
        findModule: this._findModule.bind(this),
        save: this._handleSaveModule.bind(this, module.id),
        data: module.data
      };
  
      // Create element
      if (module.type === "linup")            { return (<EnvelopeModuleLinUp {...moduleProps} />); }
      else if (module.type === "lindown")     { return (<EnvelopeModuleLinDown {...moduleProps} />); }
      else                                    { return (<EnvelopeModuleEmpty {...moduleProps} />); }
    });
  }
  
  render() {
    const { connectDropTarget, moduleWidth, moduleHeight, moduleMargin, moduleSlots, title } = this.props;
    const { modules } = this.state;
    
    const width = moduleMargin + moduleSlots * (moduleMargin + moduleWidth);
    const padding = moduleMargin;
    
    let header = (
      <h3>{title}</h3>
    );
    
    return connectDropTarget(
      <div>
        <Panel header={header} collapsible defaultExpanded>
          <EnvelopeDialog 
          show={this.state.showAdd}
          moduleWidth={moduleWidth}
          moduleHeight={moduleHeight}
          moduleMargin={moduleMargin}
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
          </div>
          </Well>
        </Panel>
      </div>
    );
  }
}

export default Envelope;
