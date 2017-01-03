import React, { Component, PropTypes } from 'react';
import { DragSource, DropTarget } from 'react-dnd';
import WersiClient from 'modules/midi/WersiClient';

import EnvelopeModule from 'components/envelope/EnvelopeModule';
import Rickshaw from 'rickshaw';

const style = {
  cursor: 'move',
  display: 'inline-block'
};

@DropTarget("envelope", EnvelopeModule.moduleTarget, connect => ({
  connectDropTarget: connect.dropTarget()
}))
@DragSource("envelope", EnvelopeModule.moduleSource, (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  isDragging: monitor.isDragging()
}))
export default class EnvelopeModuleLinUp extends EnvelopeModule {
  static defaultProps = {
    ...EnvelopeModule.defaultProps,
    title: 'Linear up',
    description: 'Linearly increases the envelope',
		aTitle: 'Duration',
		bTitle: 'Final amplitude',
		a: 2048,
		b: 2048,
    amplBefore: 0,
    timeBefore: 0,
    interpolate: true,
    sustainEnable: true,
    
    aMin: 0,
    aMinSlider: 3400,
    aMax: 4094
  };
  
  // Generate LUT based on n = 4094 and tMax = n * 5 = 20470 ms (using 5 ms envelope clock rate)
  static timeLUT = EnvelopeModule.timeLUTGenerator(4094, 4094 * 5);
  
  _decode(data) {
    const A = ((~data[1]) & 0xFF) << 4 | ((~data[0] >> 4) & 0xF);
    const B = (data[4] & 0xFF) << 4 | ((data[3] >> 4) & 0xF);
    return {
      a: A,
      b: B,
      c: null,
      sustain: A === 4095
    };
  }
  
  _handleSave(state) {
    const a = state.sustain ? 4095 : Math.min(state.a, 4094);
    const A = ~a & 0xFFF;
    const B = state.b & 0xFFF;
    return new Uint8Array([
      ((A & 0xF) << 4) | 0x3,
      (A >> 4) & 0xFF,
      0x68,
      ((B & 0xF) << 4) | 0xD,
      (B >> 4) & 0xFF
    ]);
  }
  
  _graphFunction(state) {
    const { a, b, c, amplBefore, timeBefore } = state;
    const { TIMESTEP, TIMESTEP7, TIMESTEP12 } = WersiClient.ENVELOPE;
		/*
		* A (time duration)
		* 4095: infinite
		*
		* B (end amplitude)
		* 0 to 4095
		*
		* If start amplitude is bigger than end amplitude, end amplitude equals start amplitude
		*/
		return {
			error: (amplBefore > b) ? 'Start amplitude is bigger than end amplitude. Use linear-down instead' : null,
			data: [
				{ x: 0, y: amplBefore },
				{ x: EnvelopeModuleLinUp.timeLUT[a]/1000, y: (amplBefore > b) ? amplBefore : b }
			]
		};
  }
}
