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
export default class EnvelopeModuleLinDown extends EnvelopeModule {
  static defaultProps = {
    ...EnvelopeModule.defaultProps,
    title: 'Linear down',
    description: 'Linearly decreases the envelope',
    color: 'lightslategrey',
		aTitle: 'Duration',
		bTitle: 'Final amplitude',
		a: 2048,
		b: 0,
    amplBefore: 2048,
    timeBefore: 0,
    interpolate: true,

    // Don't allow infinity, scale up to 4080 max
    aMin: 0,
    aMax: 4080
  };
  
  _decode(data) {
    // upper 4 bits ignored, always 0xF?
    const A = ((~data[1]) & 0xFF) << 4;
    const B = (data[4] & 0xFF) << 4;
    return {
      a: A,
      b: B,
      c: null
    };
  }
  
  _handleSave(state) {
    const A = (~(state.a >> 4)) & 0xFF;
    const B = (state.b >> 4) & 0xFF;
    return new Uint8Array([
      0xF3,
      A,
      0x88,
      0x09,
      B
    ]);
  }
  
  _graphFunction(state) {
    const { a, b, c, amplBefore, timeBefore } = state;
		/*
		* A (time duration)
		* 0: 5ms
		* 4094: 20500ms -- doesn't make sense at all since 4080 is max.. adjusted to 3s according to empirical evidence
		* 4095: infinite (how is this even possible with 0:255 (8-bit) rescaled to 0:4080 (12-bit))
		*
		* B (end amplitude)
		* 0 to 4095
		*
		* If start amplitude is smaller than end amplitude, end amplitude equals start amplitude
		*/
    const yMin = 5;
    const yMax = 3000;
    const aMax = 4080 + 1;
    const aLog = yMax-((yMax-yMin)*Math.log10(aMax-a))/Math.log10(aMax);
		return {
			warning: (amplBefore < b) ? 'Start amplitude is smaller than end amplitude. Use linear-up instead' : null,
			data: [
				{ x: timeBefore, y: amplBefore },
				{ x: timeBefore+this._expScale(a, 4080 + 1, 5, 3000)/1000, y: (amplBefore < b) ? amplBefore : b }
			]
		};
  }
}
