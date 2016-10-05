import React, { Component, PropTypes } from 'react';
import { DragSource, DropTarget } from 'react-dnd';
import WersiClient from 'modules/midi/WersiClient';

import EnvelopeModule from 'components/envelope/EnvelopeModule';
import Rickshaw from 'rickshaw';

const style = {
  cursor: 'move',
  display: 'inline-block'
};

/*
 * StepAbs
 *
 * A (first amplitude)
 * 0 to 4095
 *
 * B (second amplitude)
 * 0 to 4095
 *
 * Steps from amplitude A to B in 10ms, each step lasting 5ms.
 */

@DropTarget("envelope", EnvelopeModule.moduleTarget, connect => ({
  connectDropTarget: connect.dropTarget()
}))
@DragSource("envelope", EnvelopeModule.moduleSource, (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  isDragging: monitor.isDragging()
}))
export default class EnvelopeModuleStepAbs extends EnvelopeModule {
  static defaultProps = {
    ...EnvelopeModule.defaultProps,
    title: 'Step absolute',
    description: 'Steps the envelope between two constant values',
		aTitle: 'First amplitude',
		bTitle: 'Second amplitude',
		a: 512,
		b: 1024,
    amplBefore: 4000,
    timeBefore: 0,
    interpolate: false,
    sustainEnabled: false,
    epilogue: false
  };
  
  _decode(data) {
    const A = ((data[1]) & 0xFF) << 4 | ((data[0] >> 4) & 0xF);
    const B = (data[3] & 0xFF) << 4 | ((data[2] >> 4) & 0xF);
    return {
      a: A,
      b: B,
      c: null
    };
  }
  
  _handleSave(state) {
    const A = state.a & 0xFFF;
    const B = state.b & 0xFFF;
    return new Uint8Array([].concat(
      WersiClient.ENVELOPE.set(A),
      WersiClient.ENVELOPE.set(B),
      0x00
    ));
  }
  
  _graphFunction(state) {
    const { a, b, c, amplBefore, timeBefore } = state;
		return {
			data: [
				{ x: timeBefore, y: a },
				{ x: timeBefore+(5)/1000, y: b },
				{ x: timeBefore+(10)/1000, y: b }
			]
		};
  }
}
