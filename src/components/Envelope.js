import React, { Component, PropTypes } from 'react';
import update from 'react/lib/update';
import { Glyphicon, Overlay, OverlayTrigger, Tooltip, Well, Panel, Button, ButtonToolbar, Checkbox, Modal, Col, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';
import Loader from 'react-loader-advanced';

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
import EnvelopeModuleUnknown from 'components/envelope/EnvelopeModuleUnknown';
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
@DropTarget('envelope', moduleTarget, connect => ({
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
    moduleHeight: 210
  };
  
  constructor(props) {
    super(props);
    
    this.state = {
      showAdd: false,
      showValues: false,
      modules: null,
      dropCount: 0,
      releasePhaseStart: 3,
      
      loading: false
    };
    
    this._unwatchFn = null;
    
    // References to all EnvelopeModule components
    this._moduleEls = [];
    
    // Use global modules variable to allow simple communication between modules
    window.envelopeModules[this.props.type] = [];
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
  
  _handleData(dataNormal) {
    // Convert to Uint8Array
    const data = new Uint8Array(dataNormal);
    
    if (this.props.type === 'ampl') {
      // Dissect attack and release data
      let releasePhaseStart = (data[1] - 2) / 6;
      if (releasePhaseStart > 6) {
        // Release disabled, just enable it for now and fix it on the last module
        releasePhaseStart = 6;
      }
    
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
    }
    else if (this.props.type === 'freq') {
      // Dissect attack and release data
      let releasePhaseStart = (data[1] - 2) / 5;
      if (releasePhaseStart > 4) {
        // Release disabled, just enable it for now and fix it on the last module
        releasePhaseStart = 4;
      }
    
      // Dissect module data (6 bytes each, 5 modules)
      let modules = [];
      for(let i = 0; i < 5; ++i) {
        modules.push(this._handleLoadModule(i, data));
      }
      this.setState({
        modules: modules,
        data: data,
        releasePhaseStart: releasePhaseStart
      });
    }
  }
  
  _watch(envAddress, type) {
    const getter = instrumentGetters.byId(envAddress, type);

    // Unwatch if possible
    this._unwatch();
    
    // Register observer (databindings do not work because of retarded conflicts with decorators)
    this._unwatchFn = reactor.observe(getter, this._handleData.bind(this));
    
    // Get initial data
    const data = reactor.evaluate(getter);
    if (data) {
      this._handleData(data);
    }
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
    if (this.props.envAddress) {
      this._watch(this.props.envAddress, this.props.type);
    }
  }
  
  componentWillUpdate(nextProps, nextState) {
    // Check if instrument has changed
    if (nextProps.envAddress && this.props.envAddress !== nextProps.envAddress) {
      this._watch(nextProps.envAddress, nextProps.type);
    }
  }
  _handleAdd() {
    this.setState({ showAdd: true });
  }

  _handleToggleValues() {
    this.setState((state) => {
      return {
        showValues: !state.showValues
      };
    });
  }
  
  _handleSave() {
    // Set attack and release offsets (attack always starts at 2, module 0).
    const releaseOffset = 2 + (this.state.releasePhaseStart * 6);
    this.state.data[0] = 2;
    this.state.data[1] = releaseOffset;
    
    // Send to SysEx
    this.setState({ loading: true }, () => {
      this.props.client.setEnvelope(this.props.type, this.props.envAddress, this.state.data)
      .then(() => {
        // Refresh data in case the Wersi has made any changes
        return this.props.client.getEnvelope(this.props.type, this.props.envAddress);
      })
      .then((data) => {
        // Update store
        instrumentActions.update(this.props.envAddress, this.props.type, toImmutable(data));
        this.setState({ loading: false });
      
        // Reload instrument
        return this.props.client.reloadInstrument(this.props.firstInstrumentAddress);
      })
      ;
    });
  }
  
  _handleSaveRelease() {
    // Set attack and release offsets (attack always starts at 2, module 0).
    const releaseOffset = 2 + (this.state.releasePhaseStart * 6);
    this.state.data[0] = 2;
    this.state.data[1] = releaseOffset;
    
    // Update store
    instrumentActions.update(this.props.envAddress, this.props.type, this.state.data);
  }

  _handleLoadModule(id, data) {
    const offset = 2 + id * 6;
    const moduleData = data.slice(offset, offset + 6);
    let type;
    
    // Detect type
    //
    // After spending some time reverse engineering these,
    // probably should've rather done this decoding using the Wersi instructions themselves,
    // but alas, this code was written pretty early on, and it works.
    //
    const id1n = moduleData[0] & 0xF;
    const id2n = moduleData[2] & 0xF;
    const id2 = moduleData[2] & 0xFF;
    const id23 = ((moduleData[2] & 0xFF) << 4) | (moduleData[3] & 0xF);
    if      (id1n === 0x3 && id23 === 0x68D)    { type = 'linup'; }
    else if (id1n === 0x3 && id23 === 0x889)    { type = 'lindown'; }
    else if (id1n === 0xC && id23 === 0x68D)    { type = 'dynlinup'; }
    else if (id1n === 0xC && id23 === 0x889)    { type = 'dynlindown'; }
    else if (id1n === 0x2 && id23 === 0xE0D)    { type = 'expup'; }
    else if (id1n === 0x2 && id23 === 0xF09)    { type = 'expdown'; }
    else if (id1n === 0xC && id23 === 0xE4D)    { type = 'dynexpup'; }
    else if (id1n === 0xC && id23 === 0xF49)    { type = 'dynexpdown'; }
    else if (id1n === 0xC && id2 === 0x00)      { type = 'dynremain'; }
    else if (id1n === 0x1 && id2 === 0x00)      { type = 'constabs'; }
    else if (id1n === 0x5 && id2 === 0x00)      { type = 'constrel'; }
    else if (id1n === 0x2 && id2 === 0x00)      { type = 'repeat'; }
    else if (id1n === 0x1 && id2n === 0x1)      { type = 'stepabs'; }
    else if (id1n === 0x5 && id2n === 0x5)      { type = 'steprel'; }
    else if (id1n === 0x0 && id2n === 0x00)     { type = 'empty'; }
    else                                        { type = 'unknown'; }

    console.log(`[${id}] ${type}: ${(Array.from(moduleData).map(function (x) {return x.toString(16);})).join(';')}`);
    
    return {
      id: id,
      data: moduleData,
      type: type
    };
  }
  
  _handleSaveModule(index, moduleData, props) {
    // Construct buffer
    let buffer = new Uint8Array(6);
    
    // Null all 6 values
    buffer.set([0,0,0,0,0,0], 0);
    
    // Set module data
    if (moduleData) {
      buffer.set(moduleData, 0);
      
      // Add epilogue if necessary
      if (props.epilogue === true) {
        const dataId = 0xC4 + index * 6;
        buffer[moduleData.length] = dataId;
      } else if (typeof props.epilogue == 'number') {
        // Custom epilogue
        buffer[moduleData.length] = props.epilogue;
      }
    }
    
    // Splice into existing data
    let data = this.state.data;
    data.set(buffer, 2 + index * 6);
    
    // Update store (store as normal array)
    instrumentActions.update(this.props.envAddress, this.props.type, Array.prototype.slice.call(data));
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

  _findFirstEmptyModule() {
    const { modules } = this.state;
    for(let i = 0; i < this.props.moduleSlots; ++i) {
      if(modules[i].type == 'empty') {
        return i;
      }
    }
    return -1;
  }

  _deleteAllModules() {
    for(let index = 0; index < this.props.moduleSlots; ++index) {
      this._handleSaveModule(index);
    }
  }
  
  _deleteModule(id) {
    // Move and resave modules
    for(let index = 0; index < this.props.moduleSlots; ++index) {
      if (index != id) {
        window.envelopeModules[this.props.type][index].ref.saveModule(index < id ? index : (index - 1));
      }
    }
    
    // Add empty module at the end
    this._handleSaveModule(this.props.moduleSlots - 1);
    
    // Move release slider if necessary
    if (this.state.releasePhaseStart > id) {
      this.setState({releasePhaseStart: this.state.releasePhaseStart - 1});
    }
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
      
      // Determine Wersi style "phase index" (1, 3, 5, 7, 9, 11, 13)
      const wersiPhase = 1 + index * 2;

      // Set up props
      let moduleProps = {
        key: module.id,
        id: module.id,  // unique identifier
        index: index,   // linear index
        width: moduleWidth,
        height: moduleHeight,
        margin: moduleMargin,
        moveModule: this._moveModule.bind(this),
        deleteModule: this._deleteModule.bind(this),
        findModule: this._findModule.bind(this),
        save: this._handleSaveModule.bind(this),
        data: module.data,
        color: release ? 'thistle' : 'lightsteelblue',
        release: release,
        showValues: this.state.showValues,
        showError: (message) => { this.setState({ error: 'Error for module ' + wersiPhase + ': ' + message }) },
        envType: this.props.type
      };
  
      // Create element
      let el;
      if (module.type === 'linup')            { el = (<EnvelopeModuleLinUp {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === 'lindown')     { el = (<EnvelopeModuleLinDown {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === 'dynlinup')    { el = (<EnvelopeModuleDynLinUp {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === 'dynlindown')  { el = (<EnvelopeModuleDynLinDown {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === 'expup')       { el = (<EnvelopeModuleExpUp {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === 'expdown')     { el = (<EnvelopeModuleExpDown {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === 'dynexpup')    { el = (<EnvelopeModuleDynExpUp {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === 'dynexpdown')  { el = (<EnvelopeModuleDynExpDown {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === 'dynremain')   { el = (<EnvelopeModuleDynRemain {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === 'constabs')    { el = (<EnvelopeModuleConstAbs {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === 'constrel')    { el = (<EnvelopeModuleConstRel {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === 'stepabs')     { el = (<EnvelopeModuleStepAbs {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === 'steprel')     { el = (<EnvelopeModuleStepRel {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === 'repeat')      { el = (<EnvelopeModuleRepeat {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else if (module.type === 'empty')       { el = (<EnvelopeModuleEmpty {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      else                                    { el = (<EnvelopeModuleUnknown {...moduleProps} ref={(c)=>{this._moduleEls[index]=c;}} />); }
      return el;
    });
  }
  
  render() {
    const { connectDropTarget, moduleWidth, moduleHeight, moduleMargin, moduleSlots, title, type } = this.props;
    const { modules, releasePhaseStart } = this.state;
    
    const width = moduleMargin + moduleSlots * (moduleMargin + moduleWidth);
    const padding = moduleMargin;
    
    // Release slider
    let releaseSlider = (
      <div style={{ width: width, position: 'relative', left: moduleWidth * 0.5, marginTop: 10 }}>
        <OverlayTrigger
        placement='bottom'
        overlay={<Tooltip className='info' id='tooltipRelease'>Start of release phase</Tooltip>}
        >
          <input type='range'
          style={{ width: width - moduleWidth }}
          value={ releasePhaseStart }
          min={0}
          max={this.props.moduleSlots - 1}
          onChange={(event) => {
            this.setState({ releasePhaseStart: Number(event.target.value) }, () => {
              this._handleSaveRelease();
            });
          }}
          />
        </OverlayTrigger>
      </div>
      );
    
    // Add function
    let handleAddModule = (moduleData, props) => {
      // Try to find the first empty module
      const id = this._findFirstEmptyModule();
      if(id != -1) {
        // Add this particular module
        this._handleSaveModule(id, moduleData, props);
        
        // Save modules
        this._handleSave();
      }
    };
    
    return connectDropTarget(
      <div>
        <Loader show={this.state.loading} message={(<h5>« Downloading... »</h5>)} contentBlur={2}>
          <Panel
            header={(<h3>{title} <sup>{`${this.props.envAddress || ''}`}</sup></h3>)}
            collapsible
            defaultExpanded
            >
            <EnvelopeDialog 
            show={this.state.showAdd}
            moduleWidth={moduleWidth}
            moduleHeight={moduleHeight}
            moduleMargin={moduleMargin}
            cancel={() => {this.setState({ showAdd: false })}}
            addedModule={this._handleAddedModule.bind(this)}
            save={handleAddModule}
            />
            <ButtonToolbar style={{ paddingBottom: 10 }}>
              <div className='pull-left' style={{ height: 18, padding: 8, verticalAlign: 'middle' }}>
                {this.state.error}
              </div>
              <OverlayTrigger placement='bottom' overlay={(<Tooltip className='info' id='savetooltip'>Save envelope (hotkey {this.props.hotKeySave})</Tooltip>)}>
                <Button onClick={this._handleSave.bind(this)} className='pull-right' bsStyle='primary'><Glyphicon glyph='save'/></Button>
              </OverlayTrigger>
              <OverlayTrigger placement='bottom' overlay={(<Tooltip className='info' id='cleartooltip'>Clear envelope</Tooltip>)}>
                <Button onClick={this._deleteAllModules.bind(this)} className='pull-right' bsStyle='primary'><Glyphicon glyph='trash'/></Button>
              </OverlayTrigger>
              <OverlayTrigger placement='bottom' overlay={(<Tooltip className='info' id='stopsoundtooltip'>Stop all (hanging) sounds</Tooltip>)}>
                <Button onClick={() => { this.props.client.stopSound(); }} className='pull-right' bsStyle='primary'><Glyphicon glyph='off'/></Button>
              </OverlayTrigger>
              <OverlayTrigger placement='bottom' overlay={(<Tooltip className='info' id='showvaluessliderstooltip'>Show values or sliders</Tooltip>)}>
                <Button onClick={this._handleToggleValues.bind(this)} className='pull-right'>{this.state.showValues ? (<Glyphicon glyph='tasks'/>) : (<Glyphicon glyph='pencil'/>)}</Button>
              </OverlayTrigger>
              <OverlayTrigger placement='bottom' overlay={(<Tooltip className='info' id='addmoduletooltip'>Add module to end</Tooltip>)}>
                <Button onClick={this._handleAdd.bind(this)} className='pull-right'><Glyphicon glyph='plus'/></Button>
              </OverlayTrigger>
            </ButtonToolbar>
            <Well bsSize='small'>
            <div style={{
              width: width,
              paddingLeft: moduleMargin,
              paddingTop: moduleMargin,
              paddingBottom: moduleMargin
            }}>
              {modules ? this._createModules(modules) : 'No modules available.'}
              {releaseSlider}
            </div>
            </Well>
          </Panel>
        </Loader>
      </div>
    );
  }
}

export default Envelope;
