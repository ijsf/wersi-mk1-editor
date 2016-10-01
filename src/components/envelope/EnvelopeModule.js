import React, { Component, PropTypes } from 'react';
import { DragSource, DropTarget } from 'react-dnd';

const style = {
  cursor: 'move',
  display: 'inline-block'
};

const moduleSource = {
  beginDrag(props) {
    return {
      id: props.id,
      originalIndex: props.findModule(props.id).index
    };
  },

  endDrag(props, monitor) {
    const { id: droppedId, originalIndex } = monitor.getItem();
    const didDrop = monitor.didDrop();

    if (!didDrop) {
      props.moveModule(droppedId, originalIndex);
    }
  }
};

const moduleTarget = {
  canDrop() {
    return false;
  },

  hover(props, monitor) {
    const { id: draggedId } = monitor.getItem();
    const { id: overId } = props;

    if (draggedId !== overId) {
      const { index: overIndex } = props.findModule(overId);
      props.moveModule(draggedId, overIndex);
    }
  }
};

@DropTarget("envelope", moduleTarget, connect => ({
  connectDropTarget: connect.dropTarget()
}))
@DragSource("envelope", moduleSource, (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  isDragging: monitor.isDragging()
}))
export default class EnvelopeModule extends Component {
  static propTypes = {
    connectDragSource: PropTypes.func.isRequired,
    connectDropTarget: PropTypes.func.isRequired,
    isDragging: PropTypes.bool.isRequired,
    id: PropTypes.any.isRequired,
    text: PropTypes.string.isRequired,
    moveModule: PropTypes.func.isRequired,
    findModule: PropTypes.func.isRequired,
    width: PropTypes.number.isRequired,
    margin: PropTypes.number.isRequired
  };
  
  getTitle() {
    return "Empty";
  }
  
  getContent() {
    return null;
  }

  render() {
    const { text, isDragging, connectDragSource, connectDropTarget } = this.props;
    const opacity = isDragging ? 0 : 1;
    const width = this.props.width;
    const marginRight = this.props.margin;

    return connectDragSource(connectDropTarget(
      <div style={{ ...style, opacity, width, marginRight }} className="env-content">
        <div className="env-title">{this.getTitle()}</div>
        {this.getContent()}
      </div>
    ));
  }
}
