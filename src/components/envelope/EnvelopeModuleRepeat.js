import React, { Component, PropTypes } from 'react';
import { DragSource, DropTarget } from 'react-dnd';

import EnvelopeModule from 'components/envelope/EnvelopeModule';

const style = {
  cursor: 'move',
  display: 'inline-block'
};

/*
 * Does not appear to work correctly with all modules (e.g. linear up/down).
 */

@DropTarget("envelope", EnvelopeModule.moduleTarget, connect => ({
  connectDropTarget: connect.dropTarget()
}))
@DragSource("envelope", EnvelopeModule.moduleSource, (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  isDragging: monitor.isDragging()
}))
export default class EnvelopeModuleRepeat extends EnvelopeModule {
  static defaultProps = {
    ...EnvelopeModule.defaultProps,
    title: 'Repeat',
    description: 'Repeat the last X modules',
    icon: 'fa-repeat',
    epilogue: false,
    type: 'icon',
    
    // Use regular input field
    a: 1,
    aMin: 1,
    aType: 'text',
    aTitle: 'Modules to repeat',
    b: 1,
    bMin: 1,
    bMax: 127,
    bType: 'text',
    bTitle: 'Times to repeat',
    sustainEnable: true
  };
  
  componentWillUpdate(nextProps, nextState) {
    // Adjust some variables based on the information we currently have
    nextState.description = 'Repeat the last ' + nextProps.a + ' modules';
    
    const goto = (this.props.index - nextState.a);
    nextState.aMax = (goto < 1) ? 1 : goto;
  }
  
  _decode(data) {
    const ptrCurrentModule = 2 + this.props.index * 6;
    const ptrGoto = data[5];
    const goto = (ptrCurrentModule - ptrGoto) / 6;
    return {
      a: goto
    };
  }
  
  _handleSave(state) {
    // Convert from value (X) to pointer (offset from beginning of envelope data),
    // using a pointer to our current position in that data
    const ptrCurrentModule = 2 + this.props.index * 6;
    let ptrGoto = ptrCurrentModule - state.a * 6;
    if (ptrGoto < 0) {
      // Invalid ptr, just point to current module
      ptrGoto = ptrCurrentModule;
    }
    return new Uint8Array([
      0x02,
      0x10, // repeat #
      0x00,
      0x80,
      0x18,
      ptrGoto
    ]);
  }
  
  _graphFunction(state) {
    const { a } = state;
    const goto = (this.props.index - a);
		return {
			error: (goto < 0) ? 'Not enough previous modules' : null
		};
  }
}
