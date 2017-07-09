import React, { Component, PropTypes } from 'react';
import { DragSource, DropTarget } from 'react-dnd';

import EnvelopeModule from 'components/envelope/EnvelopeModule';

@DropTarget("envelope", EnvelopeModule.moduleTarget, connect => ({
  connectDropTarget: connect.dropTarget()
}))
@DragSource("envelope", EnvelopeModule.moduleSource, (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  isDragging: monitor.isDragging()
}))
export default class EnvelopeModuleUnknown extends EnvelopeModule {
  static defaultProps = {
    ...EnvelopeModule.defaultProps,
    title: 'Unknown',
    description: 'Unknown module',
    icon: 'question-sign',
    epilogue: false,
    type: 'icon'
  };
  
  _graphFunction() {
    return {};
  }

  _handleSave(state) {
    // Return unmodified data
    return this.props.data;
  }
}
