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
export default class EnvelopeModuleExpDown extends EnvelopeModule {
  static defaultProps = {
    ...EnvelopeModule.defaultProps,
    title: 'Exp. down',
    description: 'Exponentially decreases the envelope. Starts off on the amplitude of the previous module, and thus cannot be the first module.',
		aTitle: 'Duration',
		bTitle: 'Final amplitude',
		a: 2048,
		b: 0,
    amplBefore: 4079,
    timeBefore: 0,
    interpolate: true,
    sustainEnable: true,
    
    aMin: 0,
    aMax: 4079
  };
  
  _decode(data) {
    const A = (((~data[1]) & 0xFF) << 4) | ((~data[0] >> 4) & 0xF);
    const B = (((data[4]) & 0xFF) << 4) | ((data[3] >> 4) & 0xF);
    return {
      a: A,
      b: B,
      c: null,
      sustain: A >= 4080
    };
  }
  
  _handleSave(state) {
    const a = state.sustain ? 4095 : state.a;
    const A = ~a & 0xFFF;
    const B = state.b & 0xFFF;
    return new Uint8Array([
      ((A & 0xF) << 4) | 0x2,
      (A >> 4) & 0xFF,
      0xF0,
      ((B & 0xF) << 4) | 0x9,
      (B >> 4) & 0xFF
    ]);
  }
  
  _graphFunction(state) {
    const { a, b, c, amplBefore, timeBefore, isFirst } = state;
    const { TIMESTEP, TIMESTEP7, TIMESTEP12 } = WersiClient.ENVELOPE;
		/*
		* A (time duration)
		* 0: 60 ms
		* 4079: 7500 ms
		* >=4080: infinite
		*
		* B (end amplitude)
		* 0 to 4095
		*
		*/
		var i, n = 25, data = [], error = null;
		for(i = 0; i < n; i++) {
			data.push(
				{
					x: timeBefore+((this._expScale(a, 4080, 60, 7500) / n) * i)/1000,
					y: amplBefore - (Math.exp(1 - (1 / Math.pow(i / n, 2))) * Math.max(0, amplBefore - b))
				}
			);
		};
		return {
			warning: (amplBefore < b) ? 'Start amplitude is smaller than end amplitude. Use exponential-up instead' : null,
			data: data,
      error: error
		};
  }
}
