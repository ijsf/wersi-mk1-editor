import React, { Component, PropTypes } from 'react';
import { DragSource, DropTarget } from 'react-dnd';

import EnvelopeModule from 'components/envelope/EnvelopeModule';

const style = {
  cursor: 'move',
  display: 'inline-block'
};

/*
 * Repeat
 *
 * Repeats X last modules.
 *
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
    aMax: 4079,
    aType: 'range',
    aTitle: 'Delay after repeat',
    b: 1,
    bMin: 1,
    bMax: 127,
    bType: 'text',
    bTitle: 'Repeat N times',
    c: 1,
    cMin: 1,
    cType: 'text',
    cTitle: 'Repeat last N modules',
    
    // Use sustain for b (times to repeat)
    sustainEnable: true
  };
  
  componentWillUpdate(nextProps, nextState) {
    // Adjust some variables based on the information we currently have
    nextState.description = 'Repeat the last ' + nextProps.a + ' modules';
    
    const goto = (this.props.index - nextState.a);
    nextState.aMax = (goto < 1) ? 1 : goto;
  }
  
  _decode(data) {
    const B = data[1] & 0xFF;
    const A = data[3] & 0xFF;
    const ptrCurrentModule = 2 + this.props.index * 6;
    const ptrGoto = data[5];
    const goto = (ptrCurrentModule - ptrGoto) / 6;
    return {
      a: (A & 0x7F) << 5,  // 7-bit to 12-bit for uniformity on time axis
      b: B,
      c: goto,
      sustain: B === 128
    };
  }
  
  _handleSave(state) {
    const B = state.sustain ? 128 : (state.b & 0x7F);
    const A = (state.a >> 5) & 0x7F;  // 12-bit to 7-bit (from time axis to real value)
    // Convert from value (X) to pointer (offset from beginning of envelope data),
    // using a pointer to our current position in that data
    const ptrCurrentModule = 2 + this.props.index * 6;
    let ptrGoto = ptrCurrentModule - state.c * 6;
    if (ptrGoto < 0) {
      // Invalid ptr, just point to current module
      ptrGoto = ptrCurrentModule;
    }
    return new Uint8Array([
      0x02,
      B,
      0x00,
      A,
      0x18,
      ptrGoto
    ]);
  }
  
  _graphFunction(state) {
    const { a, b, c } = state;
    const goto = (this.props.index - c);
		return {
			error: (goto < 0) ? 'Not enough previous modules' : null
		};
  }
}
