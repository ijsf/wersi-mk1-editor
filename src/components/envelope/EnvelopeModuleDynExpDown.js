import React, { Component, PropTypes } from 'react';
import { DragSource, DropTarget } from 'react-dnd';
import WersiClient from 'modules/midi/WersiClient';

import EnvelopeModule from 'components/envelope/EnvelopeModule';
import Rickshaw from 'rickshaw';

const style = {
  cursor: 'move',
  display: 'inline-block'
};

@DropTarget('envelope', EnvelopeModule.moduleTarget, connect => ({
  connectDropTarget: connect.dropTarget()
}))
@DragSource('envelope', EnvelopeModule.moduleSource, (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  isDragging: monitor.isDragging()
}))
export default class EnvelopeModuleDynExpDown extends EnvelopeModule {
  static defaultProps = {
    ...EnvelopeModule.defaultProps,
    title: 'Dyn. exp. down',
    description: 'Exponentially decreases the envelope with dynamic volume. Starts off on the amplitude of the previous module, and thus cannot be the first module.',
		aTitle: 'Duration',
		bTitle: 'Final amplitude',
		a: 2048,
		b: 0,
    amplBefore: 4079,
    timeBefore: 0,
    interpolate: true,
    sustainEnable: true,
    
    aMin: 0,
    aMinSlider: 2000,
    aMax: 4079
  };
  
  // Generate LUT based on n = 4094 and tMax = n * 5 = 20470 ms (using 5 ms envelope clock rate)
  static timeLUT = EnvelopeModule.timeLUTGenerator(4094, 4094 * 5);

  _decode(data) {
    let A = (((~data[1]) & 0xFF) << 4) | ((~data[0] >> 4) & 0xF);
    const B = (((data[4]) & 0xFF) << 4) | ((data[3] >> 4) & 0xF);
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
    const A = ~a & 0xFFF;
    const B = state.b & 0xFFF;
    return new Uint8Array([
      0xBC, //((A & 0xF) << 4) | 0xC,
      (A >> 4) & 0xFF,
      0xF4,
      ((B & 0xF) << 4) | 0x9,
      (B >> 4) & 0xFF
    ]);
  }
  
  _graphFunction(state) {
    const { a, b, c, amplBefore, timeBefore, isFirst } = state;
    const { TIMESTEP, TIMESTEP7, TIMESTEP12 } = WersiClient.ENVELOPE;
		/*
		* A (time duration)
		* >=4080: infinite
		*
		* B (end amplitude)
		* 0 to 4095
		*
		*/
		var i, n = 25, data = [];
		for(i = 0; i < n; i++) {
			data.push(
				{
					x: timeBefore+((EnvelopeModuleDynExpDown.timeLUT[a] / n) * i)/1000,
					y: amplBefore - (Math.exp(1 - (1 / Math.pow(i / n, 2))) * Math.max(0, amplBefore - b))
				}
			);
		};
		return {
			error: (amplBefore < b) ? 'Start amplitude is smaller than end amplitude. Use exponential-up instead' : null,
			data: data
		};
  }
}