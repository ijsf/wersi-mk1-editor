import React, { Component, PropTypes } from 'react';
import { DragSource, DropTarget } from 'react-dnd';

import EnvelopeModule from 'components/envelope/EnvelopeModule';

const style = {
  cursor: 'move',
  display: 'inline-block'
};

/*
 * Dynamic remain
 *
 * Keeps the last ("left-hand") envelope value depending on dynamics.
 *
 * Depends on the value of an earlier envelope. Appears to do (weight * time).
 */

@DropTarget('envelope', EnvelopeModule.moduleTarget, connect => ({
  connectDropTarget: connect.dropTarget()
}))
@DragSource('envelope', EnvelopeModule.moduleSource, (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  isDragging: monitor.isDragging()
}))
export default class EnvelopeModuleDynRemain extends EnvelopeModule {
  static defaultProps = {
    ...EnvelopeModule.defaultProps,
    title: 'Dynamic remain',
    description: 'Keeps the last envelope value depending on dynamics (weight * time).',
    icon: 'bullhorn',
    type: 'icon',
    sustainEnable: true,
    timeBefore: 0,
    
    a: 32,
    aStep: 32,
    aMin: 1,
    aMax: 4079,
    aType: 'range',
    aTitle: 'Dynamic weight',
    b: 32,
    bStep: 32,
    bMin: 1,
    bMax: 4079,
    //bType: 'range',
    bTitle: 'Time (multiplied by weight)',

    epilogue: 0x10  // custom epilogue
  };
  
  _decode(data) {
    let A = (data[3] & 0x7F) << 5;  // 7-bit
    const B = (data[1] & 0xFF) << 4;
    let sustain = A >= 4080;
    if (!sustain) {
      A = Math.min(4080 - 1, A);
    }
    return {
      a: A,
      b: B,
      c: null,
      sustain: sustain
    };
  }
  
  _handleSave(state) {
    const a = state.sustain ? 4080 : Math.min(4080 - 1, state.a);
    const A = (a >> 5) & 0x7F;  // 7-bit
    const B = (state.b >> 4) & 0xFF;
    return new Uint8Array([
      0xBC,
      B,
      0x00,
      A,
      0xC
    ]);
  }
  
  _graphFunction(state) {
		return {
			error: null
		};
  }
}
