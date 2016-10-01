import React, { Component, PropTypes } from 'react';
import update from 'react/lib/update';
import { Panel, Button, Checkbox, Modal, Col, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';
import FontAwesome from 'react-fontawesome';

import EnvelopeModule from 'components/envelope/EnvelopeModule';
import EnvelopeModuleEmpty from 'components/envelope/EnvelopeModuleEmpty';

import { DropTarget, DragDropContext } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

const moduleTarget = {
  drop() {
  }
};

@DragDropContext(HTML5Backend)
@DropTarget("envelope", moduleTarget, connect => ({
  connectDropTarget: connect.dropTarget()
}))

export default class Envelope extends Component {
  static propTypes = {
    connectDropTarget: PropTypes.func.isRequired
  };
  
  static defaultProps = {
    moduleSlots: 7,
    moduleMargin: 5,
    moduleWidth: 125
  };
  
  constructor(props) {
    super(props);
    
    this.state = {
      modules: Array.from({length: this.props.moduleSlots}).map((v, i) => {
        return { id: i, text: i.toString() };
      })
    };
  }
  
  componentWillMount() {
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
  
  render() {
    const { connectDropTarget } = this.props;
    const { modules } = this.state;
    
    const width = this.props.moduleMargin + this.props.moduleSlots * (this.props.moduleMargin + this.props.moduleWidth);
    const padding = this.props.moduleMargin;
    
    let header = (
      <h3><FontAwesome name={this.props.icon} fixedWidth />{this.props.title}</h3>
    );
    
    return connectDropTarget(
      <div>
        <Panel header={header} collapsible defaultExpanded>
          <div className="env-container" style={{
            width: width,
            paddingLeft: this.props.moduleMargin,
            paddingTop: this.props.moduleMargin,
            paddingBottom: this.props.moduleMargin
          }}>
            {modules.map(module => {
              return (
                <EnvelopeModule
                  key={module.id}
                  id={module.id}
                  text={module.text}
                  width={this.props.moduleWidth}
                  margin={this.props.moduleMargin}
                  moveModule={this._moveModule.bind(this)}
                  findModule={this._findModule.bind(this)} />
              );
            })}
          </div>
        </Panel>
      </div>
    );
  }
}
