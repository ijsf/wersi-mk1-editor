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
export default class EnvelopeModuleLinDown extends EnvelopeModule {
  static defaultProps = {
    ...EnvelopeModule.defaultProps,
    title: 'Linear down',
    description: 'Linearly decreases the envelope',
		aTitle: 'Duration',
		bTitle: 'Final amplitude',
		a: 2048,
		b: 0,
    amplBefore: 2048,
    timeBefore: 0,
    interpolate: true,
    sustainEnable: true,

    aMin: 0,
    aMax: 4094
  };
  
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
      0x88,
      ((B & 0xF) << 4) | 0x9,
      (B >> 4) & 0xFF
    ]);
  }
  
  _graphFunction(state) {
    const { a, b, c, amplBefore, timeBefore } = state;
    const { TIMESTEP, TIMESTEP7, TIMESTEP12 } = WersiClient.ENVELOPE;
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
		return {
			error: (amplBefore < b) ? 'Start amplitude is smaller than end amplitude. Use linear-up instead' : null,
			data: [
				{ x: timeBefore, y: amplBefore },
				{ x: timeBefore+this._expScale(a, 4095, TIMESTEP, TIMESTEP12)/1000, y: (amplBefore < b) ? amplBefore : b }
			]
		};
  }
}
