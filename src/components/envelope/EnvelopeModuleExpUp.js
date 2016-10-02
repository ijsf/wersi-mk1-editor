import React, { Component, PropTypes } from 'react';
import { DragSource, DropTarget } from 'react-dnd';

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
export default class EnvelopeModuleExpUp extends EnvelopeModule {
  static defaultProps = {
    ...EnvelopeModule.defaultProps,
    title: 'Exp. up',
    description: 'Exponentially increases the envelope. Starts off on the amplitude of the previous module, and thus cannot be the first module.',
    color: 'lightslategrey',
		aTitle: 'Duration',
		bTitle: 'Final amplitude',
		a: 2048,
		b: 4095,
    amplBefore: 0,
    timeBefore: 0,
    interpolate: true,
    
    // Minimum must be 16
    aMin: 16,
    aMax: 4095
  };
  
  _decode(data) {
    const A = (((~data[1]) & 0xFF) << 4) | ((~data[0] >> 4) & 0xF);
    const B = (((data[4]) & 0xFF) << 4) | ((data[3] >> 4) & 0xF);
    return {
      a: A,
      b: B,
      c: null
    };
  }
  
  _handleSave() {
    const A = ~this.state.a & 0xFFF;
    const B = this.state.b & 0xFFF;
    return new Uint8Array([
      ((A & 0xF) << 4) | 0x2,
      (A >> 4) & 0xFF,
      0xE0,
      ((B & 0xF) << 4) | 0xD,
      (B >> 4) & 0xFF
    ]);
  }
  
  _graphFunction(state) {
    const { a, b, c, amplBefore, timeBefore, isFirst } = state;
		/*
		* A (time duration)
		* 0: 60ms
		* 4079: 7500ms
		* 4080: infinite
		*
		* B (end amplitude)
		* 0 to 4095
		*
		* Start amplitude may not be smaller than 16.
		*/
		let i, n = 25, data = [], error = null;
		for(i = 0; i < n; i++) {
			data.push(
				{
					x: timeBefore+((this._expScale(a, 4080 + 1, 60, 7500) / n) * i)/1000,
					y: amplBefore + (Math.exp(1 - (1 / Math.pow(i / n, 2))) * Math.max(0, b - amplBefore))
				}
			);
		};
    if (isFirst) {
      error = "This module cannot be the first module"
    }
    else if (amplBefore < 16) {
      error = "Start amplitude must be higher than 16"
    }
		return {
			warning: (amplBefore > b) ? 'Start amplitude is bigger than end amplitude. Use exponential-down instead' : null,
			error: error,
			data: data
		};
  }
}
