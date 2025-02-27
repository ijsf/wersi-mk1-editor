import React, { Component, PropTypes } from 'react';
import { DragSource, DropTarget } from 'react-dnd';

import EnvelopeModule from 'components/envelope/EnvelopeModule';

@DropTarget('envelope', EnvelopeModule.moduleTarget, connect => ({
  connectDropTarget: connect.dropTarget()
}))
@DragSource('envelope', EnvelopeModule.moduleSource, (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  isDragging: monitor.isDragging()
}))
export default class EnvelopeModuleEmpty extends EnvelopeModule {
  static defaultProps = {
    ...EnvelopeModule.defaultProps,
    title: 'Empty',
    epilogue: false,
    type: 'none'
  };
  
  _graphFunction() {
    return {};
  }

  _handleSave(state) {
    return new Uint8Array([
      0,
      0,
      0,
      0,
      0
    ]);
  }
}
