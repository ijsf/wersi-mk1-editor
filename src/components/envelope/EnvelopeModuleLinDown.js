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
    interpolate: true
  };
  
  _decode(data) {
    const A = ((~data[1]) & 0xFF) << 4;
    const B = (data[4] & 0xFF) << 4;
    return {
      a: A,
      b: B,
      c: null
    };
  }
  
  _handleSave() {
    const A = (~(this.state.a >> 4)) & 0xFF;
    const B = (this.state.b >> 4) & 0xFF;
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
		* 4094: 20500ms
		* 4095: infinite
		*
		* B (end amplitude)
		* 0 to 4095
		*
		* If start amplitude is smaller than end amplitude, end amplitude equals start amplitude
		*/
    // TODO: exponential time?
		return {
			warning: (amplBefore < b) ? 'Start amplitude is smaller than end amplitude. Use linear-up instead' : null,
			data: [
				{ x: timeBefore, y: amplBefore },
				{ x: timeBefore+((5 + (a / 4094) * (20500 - 5)))/1000, y: (amplBefore < b) ? amplBefore : b }
			]
		};
  }
}
