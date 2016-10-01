import React, { Component, PropTypes } from 'react';
import update from 'react/lib/update';
import { Well, Panel, Button, Checkbox, Modal, Col, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';

import EnvelopeDialog from 'components/EnvelopeDialog';
import EnvelopeModule from 'components/envelope/EnvelopeModule';
import EnvelopeModuleVibrato2 from 'components/envelope/EnvelopeModuleVibrato2';

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
    ...Component.defaultProps,
    moduleSlots: 7,
    moduleMargin: 5,
    moduleWidth: 122,
    moduleHeight: 155
  };
  
  constructor(props) {
    super(props);
    
    this.state = {
      showAdd: false,
      modules: Array.from({length: this.props.moduleSlots}).map((v, i) => {
        return { id: i, text: i.toString() };
      })
    };
  }
  
  componentWillMount() {
  }
  
  _handleAdd() {
    this.setState({ showAdd: true });
  }
  
  _handleSave() {
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
      <h3>{this.props.title}</h3>
    );
    
    return connectDropTarget(
      <div>
        <Panel header={header} collapsible defaultExpanded>
          <EnvelopeDialog show={this.state.showAdd} />
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
            paddingLeft: this.props.moduleMargin,
            paddingTop: this.props.moduleMargin,
            paddingBottom: this.props.moduleMargin
          }}>
            {modules.map(module => {
              return (
                <EnvelopeModuleVibrato2
                  key={module.id}
                  id={module.id}
                  text={module.text}
                  width={this.props.moduleWidth}
                  height={this.props.moduleHeight}
                  margin={this.props.moduleMargin}
                  moveModule={this._moveModule.bind(this)}
                  findModule={this._findModule.bind(this)} />
              );
            })}
          </div>
          </Well>
        </Panel>
      </div>
    );
  }
}
