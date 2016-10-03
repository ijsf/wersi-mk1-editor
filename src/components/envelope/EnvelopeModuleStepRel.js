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
    interpolate: false
  };
  
  _graphFunction(state) {
    const { a, b, c, amplBefore, timeBefore } = state;
		/*
		* A (first amplitude)
		* 0 to 4095
		*
		* B (second amplitude)
		* 0 to 4095
		*
		* Steps from amplitude A to B in 10ms, each step lasting 5ms.
		* Start amplitude is added to amplitudes A and B, module 4096, similar to constant-relative.
		*/
		return {
			info: (((amplBefore + a) > 4095) || (amplBefore + b) > 4095) ? 'Value wrapped around at 4096' : null,
			data: [
				{ x: timeBefore, y: (amplBefore + a) % 4096 },
				{ x: timeBefore+(5)/1000, y: (amplBefore + b) % 4096 },
				{ x: timeBefore+(10)/1000, y: (amplBefore + b) % 4096 }
			]
		};
  }
}
