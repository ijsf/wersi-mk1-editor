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
 * Start amplitude is added to amplitudes A and B, module 4096, similar to constant-relative.
 */

@DropTarget('envelope', EnvelopeModule.moduleTarget, connect => ({
  connectDropTarget: connect.dropTarget()
}))
@DragSource('envelope', EnvelopeModule.moduleSource, (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  isDragging: monitor.isDragging()
}))
export default class EnvelopeModuleStepRel extends EnvelopeModule {
  static defaultProps = {
    ...EnvelopeModule.defaultProps,
    title: 'Step relative',
    description: 'Steps the envelope between two values added to the last envelope (wraps around at maximum)',
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
      WersiClient.ENVELOPE.add(A),
      WersiClient.ENVELOPE.add(B),
      0x00
    ));
  }
  
  _graphFunction(state) {
    const { a, b, c, amplBefore, timeBefore } = state;
    const { TIMESTEP, TIMESTEP7, TIMESTEP12 } = WersiClient.ENVELOPE;
		return {
			info: (((amplBefore + a) > 4095) || (amplBefore + b) > 4095) ? 'Value wrapped around at 4096' : null,
			data: [
				{ x: timeBefore, y: (amplBefore + a) % 4096 },
				{ x: timeBefore+(TIMESTEP)/1000, y: (amplBefore + b) % 4096 },
				{ x: timeBefore+(TIMESTEP * 2)/1000, y: (amplBefore + b) % 4096 }
			]
		};
  }
}
