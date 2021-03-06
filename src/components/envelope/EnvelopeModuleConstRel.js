import React, { Component, PropTypes } from 'react';
import { DragSource, DropTarget } from 'react-dnd';
import WersiClient from 'modules/midi/WersiClient';

import EnvelopeModule from 'components/envelope/EnvelopeModule';
import Rickshaw from 'rickshaw';

@DropTarget('envelope', EnvelopeModule.moduleTarget, connect => ({
  connectDropTarget: connect.dropTarget()
}))
@DragSource('envelope', EnvelopeModule.moduleSource, (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  isDragging: monitor.isDragging()
}))
export default class EnvelopeModuleConstRel extends EnvelopeModule {
  static defaultProps = {
    ...EnvelopeModule.defaultProps,
    title: 'Const. relative',
    description: 'Adds a value to the last envelope (wraps around at maximum)',
		aTitle: 'Duration',
		bTitle: 'Amplitude',
		a: 63,
		b: 1024,
    amplBefore: 2048,
    timeBefore: 0,
    interpolate: true,
    sustainEnable: true,
    
    // 7-bit range with 8th bit indicating infinity
    aMin: 0,
    aMax: 127,
    aStep: 1,
    
    // Somehow, this block has a 0x00 0x00 epilogue
    epilogue: false
  };
  
  _decode(data) {
    const A = data[3];
    const B = ((data[1]) & 0xFF) << 4 | ((data[0] >> 4) & 0xF);
    return {
      a: A & 0x7F,
      b: B,
      c: null,
      sustain: A === 0x80
    };
  }
  
  _handleSave(state) {
    const A = state.sustain ? 0x80 : Math.min(state.a, 0x7F);
    const B = state.b & 0xFFF;
    return new Uint8Array([
      ((B & 0xF) << 4) | 0x5,
      (B >> 4) & 0xFF,
      0x00,
      A,
      0x00
    ]);
  }
  
  _graphFunction(state) {
    const { a, b, c, amplBefore, timeBefore } = state;
    const { TIMESTEP, TIMESTEP7, TIMESTEP12 } = WersiClient.ENVELOPE;
		/*
		* A (time duration)
		* 0: 5 ms
		* 4079: 635 ms
		* 4080: infinite
		*
		* B (added amplitude)
		* 0 to 4095
		*
		* Start amplitude + B, modulo 4096
		*/
		return {
			info: ((amplBefore + b) > 4095) ? 'Value wrapped around at 4096' : null,
			data: [
				{ x: timeBefore, y: (amplBefore + b) % 4096 },
				{ x: timeBefore+((TIMESTEP + (a / 127) * (TIMESTEP7 - TIMESTEP)))/1000, y: (amplBefore + b) % 4096 }
			]
		};
  }
}
