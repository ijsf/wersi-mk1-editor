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
export default class EnvelopeModuleVibrato2 extends EnvelopeModule {
  static defaultProps = {
    ...EnvelopeModule.defaultProps,
    title: 'Vibrato B',
    description: 'Applies centered \'frequency\' vibrato to envelope',
    color: 'steelblue',
		aTitle: 'Duration',
		bTitle: 'Vibrato amplitude',
		cTitle: 'Vibrato frequency',
		a: 512,
		b: 1024,
		c: 1024,
    amplBefore: 2048,
    timeBefore: 0,
    interpolate: true
  };
  
  _graphFunction(state) {
		/*
		* A (activation time)
		* Values unknown (5 to 600ms?)
		*
		* B (vibrato amplitude)
		* Values unknown
		*
		* C (vibrato frequency)
		* Values unknown (4080 and higher invalid)
		*
		* Applies vibrato to start amplitude, with amplitude rising up to B during activation time.
		*/
		var i, n = 50, maxCycles = 25, startTime = 5, endTime = 600, data = [];
		for(i = 0; i < n; i++) {
			var f = i / n;
			var a = Math.min(1, (i * 2) / n);
			var v = (Math.sin(f * (2 * Math.PI * (state.c / 4095 * maxCycles))) * state.b * 0.5) * a;
			data.push(
				{
					x: (state.timeBefore + startTime + ((endTime - startTime) / n) * i)/1000,
					y: state.amplBefore + v
				}
			);
		};
		return {
			warning: (state.c > 4079) ? 'Frequency must be lower than 4080' : null,
			data: data
		};
  }
}
