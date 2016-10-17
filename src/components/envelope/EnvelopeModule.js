import React, { Component, PropTypes } from 'react';
import { DragSource, DropTarget } from 'react-dnd';
import { Glyphicon, Button, Overlay, OverlayTrigger, Tooltip } from 'react-bootstrap';
import ToggleButton from 'react-toggle-button';

import { findDOMNode } from 'react-dom';

import Rickshaw from 'rickshaw';

const style = {
  display: 'inline-block',
  fontSize: 12,
  textAlign: 'center',
  verticalAlign: 'top',
  lineHeight: '100%',
  border: '1px solid black',
  borderRadius: 4
};

const styleTitle = {
	display: 'inline-block',
	marginTop: 5,
	marginBottom: 5,
	verticalAlign: 'middle',
	fontSize: 11,
  fontWeight: 'normal',
  opacity: 0.8
};

const styleGraph = {
	display: 'inline-block'
};

const styleSlider = {
	display: 'inline-block',
  marginTop: 5,
  marginBottom: 5,
  marginLeft: 5,
  marginRight: 5,
  verticalAlign: 'middle',
  height: 15
};

const styleText = {
	display: 'inline-block',
  marginTop: 5,
  marginBottom: 5,
  marginLeft: 5,
  marginRight: 5,
  verticalAlign: 'middle',
  fontSize: 11,
  height: 15
};

const styleSliderButton = {
	display: 'inline-block',
  paddingLeft: 4,
  paddingRight: 4,
  paddingTop: 0,
  paddingBottom: 0,
  marginTop: 0,
  marginBottom: 0
};

const styleSliderContainer = {
  cursor: 'default',
  margin: 5
};

// Custom Rickshaw axis renderer
const RickshawCustomAxisRenderer = function(args) {

	var self = this;

	this.graph = args.graph;
	this.elements = [];
	this.ticksTreatment = args.ticksTreatment || 'plain';

	var time = args.timeFixture || new Rickshaw.Fixtures.Time();

	this.appropriateTimeUnit = function() {

		var unit;
		var units = time.units;

		var domain = this.graph.x.domain();
		var rangeSeconds = domain[1] - domain[0];

		units.forEach( function(u) {
			if (Math.floor(rangeSeconds / u.seconds) >= 2) {
				unit = unit || u;
			}
		} );

		return (unit || time.units[time.units.length - 1]);
	};

	this.render = function() {

		this.elements.forEach( function(e) {
			e.parentNode.removeChild(e);
		} );

		this.elements = [];

		var unit = this.appropriateTimeUnit();

		{
			var value = this.graph.x.domain()[0];
			var element = document.createElement('div');
			element.style.left = '5px';
      element.style.cssFloat = 'left';
			element.classList.add('x_tick_custom');
			element.classList.add(self.ticksTreatment);

			var title = document.createElement('div');
			title.classList.add('title');
			title.innerHTML = unit.formatter(new Date(value * 1000));
			element.appendChild(title);

			self.graph.element.appendChild(element);
			self.elements.push(element);
		}
		{
			var value = this.graph.x.domain()[1];
			var element = document.createElement('div');
			element.style.right = '5px';
			element.style.cssFloat = 'right';
			element.classList.add('x_tick_custom');
			element.classList.add(self.ticksTreatment);

			var title = document.createElement('div');
			title.classList.add('title');
      // _sustain is quite the hack
			title.innerHTML = self.graph._sustain ? "∞" : unit.formatter(new Date(value * 1000));
			element.appendChild(title);

			self.graph.element.appendChild(element);
			self.elements.push(element);
		}
	};

	this.graph.onUpdate( function() { self.render() } );
};

//
// Retarded ES6 decorators do not appear to work for extended classes...
//
// DropTarget and DropSource are therefore now decorated on derived classes,
// instead of cleanly on the base class right here.
//

export default class EnvelopeModule extends Component {
  static defaultProps = {
    ...Component.defaultProps,
    showTimeAxis: true,
    graphHeight: 70,
    color: 'silver',
    sustainEnable: false,
    index: null,
    
    // Default type is graph
    type: 'graph',
    
    // Default min and max and step increments for 12-bit values
    aMin: 0,
    aMax: 4095,
    aStep: 1,
    bMin: 0,
    bMax: 4095,
    bStep: 1,
    cMin: 0,
    cMax: 4095,
    cStep: 1,
    
    // Type of value
    aType: 'range',
    bType: 'range',
    cType: 'range',
    
    // Epilogue enabled?
    epilogue: true
  };
  
  constructor(props) {
    super(props);
    
    this.state = {
      graph: null,
      disableDrag: false,
      
      // Move values into state
      a: props.a,
      b: props.b,
      c: props.c,
      amplBefore: props.amplBefore,
      timeBefore: 0, // props.timeBefore, -- ignore
      isFirst: true,
      sustain: false,
      
      // Temporary variables
      _text_: {},
      
      // Drag copies of values
      _a: null,
      _b: null,
      _c: null,
      _sustain: null
    };
    
    this._graph = null;
    this._dragging = false;
  }
  
  static moduleSource = {
    canDrag(props) {
      // Only allow drag if the required properties are actually specified
      return (props.findModule) ? true : false;
    },
    
    beginDrag(props, monitor, component) {
      if (component) {
        component._dragging = true;
      }
      return {
        id: props.id,
        originalIndex: props.findModule(props.id).index
      };
    },
    endDrag(props, monitor, component) {
      const { id: droppedId, originalIndex } = monitor.getItem();
      const didDrop = monitor.didDrop();

      if (!didDrop) {
        props.moveModule(droppedId, originalIndex);
      }
      if (component) {
        component._dragging = false;
      }
    }
  };

  static moduleTarget = {
    canDrop() {
      return false;
    },
    hover(props, monitor) {
      const { id: draggedId } = monitor.getItem();
      const { id: overId } = props;

      if (draggedId !== overId) {
        const { index: overIndex } = props.findModule(overId);
        props.moveModule(draggedId, overIndex);
      }
    }
  };

  _createGraph() {
    // Find out whether we're actually being used for editing or not (dragging must be enabled)
    const showCase = (this.props.findModule) ? false : true;

    // Create data series
    const graphData = this._graphFunction(this.state);
    const series = [{
      color: this.props.color,
      data: graphData.data
    }];
    
    // Create graph
    const graph = new Rickshaw.Graph( {
				element: this._graph,
        series: series,
				padding: 0,
				max: 4095,
				min: 0,
        width: this.props.width - 2,
        height: this.props.graphHeight,
				interpolation: this.props.interpolate ? 'cardinal' : 'step-after'
		});
    graph.render();
  
		// Create axis, if necessary
		if (this.props.showTimeAxis && !showCase)
		{
			new RickshawCustomAxisRenderer({
				graph: graph
			}).render();
		}
  
    this.setState({ graph: graph });
  }
  
  _graphFunction() {
    throw "No graph function implemented."
  }
  
  _handleSave(state) {
    throw "No _handleSave implemented."
  }
  
  componentWillUpdate(nextProps, nextState) {
  }
  
  _expScale(x, xMax, yMin, yMax) {
    x = Math.min(x, xMax - 1);
    return yMax-((yMax-yMin)*Math.log10(xMax-x))/Math.log10(xMax);
  }
  
  _getUpdatedData(props) {
    let { id, index, data, a, b, c, sustain, amplBefore, timeBefore, isFirst } = props;
    
    // Check if we received data, in which case we will decode the data
    if (this._decode && data) {
      let decoded = this._decode(data);
      a = decoded.a;
      b = decoded.b;
      c = decoded.c;
      sustain = decoded.sustain;
    }
    
    // Move values into hacky global (time is typically a and amplitude is typically b)
    // If we don't have a graph, just set the previous amplitude to the middle to get a nice visual.
    window.envelopeModules[index] = this.props.type === 'graph' ? { a: a, b: b, c: c } : { a: 0, b: 2048, c: 0 };
    
    // Attempt to get timeBefore (a) and amplBefore (b) from hacky global
    //
    // Here, we assume that the previous module has already executed this function!)
    // This does not hold in certain cases though, e.g. when we're dragging.
    //
    if (index > 0) {
      if (window.envelopeModules[index - 1]) {
        const aBefore = window.envelopeModules[index - 1].a;
        const bBefore = window.envelopeModules[index - 1].b;
        
        // Check if we are placed behind an empty element, which shouldn't be allowed
        if (this._isNumeric(aBefore) && this._isNumeric(bBefore)) {
          //timeBefore = aBefore; -- ignore
          amplBefore = bBefore;
        }
        else {
          // Not allowed
        }
      }
      isFirst = false;
    }
    else {
      isFirst = true;
    }
    
    return {
      a: a,
      b: b,
      c: c,
      amplBefore: amplBefore,
      timeBefore: timeBefore,
      isFirst: isFirst,
      sustain: sustain
    };
  }
  
  componentWillMount() {
    // Immediately get most updated data and set initial state accordingly
    this.setState(this._getUpdatedData(this.props));
  }
  
  componentWillUpdate(nextProps, nextState) {
    // Update state with most updated data
    Object.assign(nextState, this._getUpdatedData(nextProps));
  }
  
  saveModule() {
    this.props.save(this._handleSave(this.state), this.props);
  }
  
  _isNumeric(x) {
    return !isNaN(parseFloat(x)) && isFinite(x);
  }
  
  componentDidMount() {
    const { a, b, c, type } = this.props;
    
    // Render already occurred, this._graph must be valid, so construct the graph
    if (this._graph) {
      if (type === 'graph') {
        this._createGraph();
      }
    }
  }
  
  shouldComponentUpdate(nextProps, nextState) {
    const { graph } = this.state;
    
    // If we are showing values, reset the associated state variables
    if (!this.props.showValues && nextProps.showValues) {
      nextState['_text_'] = {};
    }

    // If we are dragging, don't re-render, this will also skip componentWillUpdate and reloading of data
    if (this.state._a !== nextState._a
    || this.state._b !== nextState._b
    || this.state._c !== nextState._c
    || this.state._sustain !== nextState._sustain) {
      // Copy drag values into real values
      nextState.a = nextState._a !== null ? nextState._a : this.state.a;
      nextState.b = nextState._b !== null ? nextState._b : this.state.b;
      nextState.c = nextState._c !== null ? nextState._c : this.state.c;
      nextState.sustain = (nextState._sustain !== null) ? nextState._sustain : this.state.sustain;
    
      // Just update the graph
      const graphData = this._graphFunction(nextState);
      if (nextProps.type === 'graph') {
        graph.series[0].data = graphData.data;
        graph._sustain = nextState.sustain;  // _sustain is quite the hack
        graph.update();
      }
      
      // Don't re-render
      return false;
    }
    return true;
  }
  
  render() {
    const { isDragging, connectDragSource, connectDropTarget, width, height, margin, color, sustainEnable, icon, type, graphHeight } = this.props;
    const { graph, sustain } = this.state;
    const marginRight = margin;
    
    // Change opacity when dragging
    const opacity = isDragging ? 0 : 1;

    // Find out whether we're actually being used for editing or not (dragging must be enabled)
    const showCase = (this.props.findModule) ? false : true;

    // Add bottom margin when showcasing (cause modules may be placed below)
    const marginBottom = showCase ? margin : null;
    
    // Determine if we should show a move cursor for specific elements
    const cursor = showCase ? 'default' : 'move';

    const graphData = this._graphFunction(this.state);

    // Create visual content
    let iconContent = null;
    if (graph && type === 'graph') {
      // Update and render graph
      graph.series[0].color = color;
      graph.series[0].data = graphData.data;
      graph._sustain = this.state.sustain;  // _sustain is quite the hack
      graph.update();
      graph.render();
    }
    else if (type === 'icon') {
      iconContent = (
        <Glyphicon glyph="repeat"
        style={{
          fontSize: graphHeight * 0.5,
          padding: 4,
          color: 'silver',
          display: 'block',
          height: graphHeight + 14,
          paddingTop: graphHeight * 0.25
        }}
        />
      );
    }
    
    // Create sustain toggle (don't show if we're showcasing or if not enabled)
    let sustainToggle = (showCase || !sustainEnable)
    ? (<div style={{ height: 20 }} />)
    : (<div style={{ height: 20 }}>
          <Button
          style={{ fontSize: 10, fontWeight: 'normal', width: '100%' }}
          bsSize="xsmall"
          active={sustain}
          onClick={() => {
            this.setState((state) => {
              return { '_sustain': !sustain };
            }, () => {
              this.saveModule();
            });
          }}>SUSTAIN</Button>
      </div>
    );
    
    // Create HTML5 sliders (don't show if we're showcasing)
    const sliders = showCase ? null : Array.from(['a', 'b', 'c']).map((key) => {
      const value = this.state[key];
      const valueMin = this.props[key + "Min"];
      const valueMax = this.props[key + "Max"];
      const valueStep = this.props[key + "Step"];
      const valueType = this.props[key + "Type"];
      const title = this.props[key + "Title"];
      const keyName = "EnvelopeModule" + this.props.id + "_" + key;

      let tooltip = (<Tooltip className="info" id={keyName + "_tooltip"} key={keyName + "_tooltip"}>{title}</Tooltip>);
      
      // Use temporary state values to allow for input text field changes
      const textInputValue = this.state['_text_'][key];
      let handleTextInputChange = (event) => {
        const value = event.target.value;
        this.setState((state) => {
          state['_text_'][key] = value;
          return state;
        });
      };
      let handleTextInputDone = (event) => {
        const value = event.target.value;
        this.setState((state) => {
          state['_' + key] = value;
          state['_text_'][key] = undefined;
          return state;
        }, () => { this.saveModule() });
      };
      
      // Button handlers
      let handleButtonDecrease = () => {
        this.setState((state) => {
          if (value > valueMin) {
            state['_' + key] = value - valueStep;
          }
          return state;
        }, () => { this.saveModule() });
      };
      let handleButtonIncrease = () => {
        this.setState((state) => {
          if (value < valueMax) {
            state['_' + key] = value + valueStep;
          }
          return state;
        }, () => { this.saveModule() });
      };
      
      let handleInput = (event) => {
        console.log('oninput ' + event.target.value);
        // Move value into this.state._KEY
        let update = {};
        update['_' + key] = Number(event.target.value);
        update.changed = true;
        this.setState(update);
      };

      let sliderContent = null;
      if (valueType === 'text' || this.props.showValues) {
        sliderContent = (
          <input type="text" style={{...styleText, width: width * 0.5 + 5 }}
          onChange={handleTextInputChange}
          onBlur={handleTextInputDone}
          value={this.state['_text_'][key] !== undefined ? this.state['_text_'][key] : value}
          key={keyName + "_text"}
          />
        );
      }
      else if (valueType === "range") {
        sliderContent = (
          <input type="range" style={{...styleSlider, width: width * 0.5 + 5 }}
          defaultValue={value}
          min={valueMin}
          max={valueMax}
          step={valueStep}
          key={keyName + "_slider"}
          onMouseEnter={() => {
            // Disable drag
            this.setState({ disableDrag: true, changed: false });
          }}
          onMouseUp={() => {
            // Save changes, but only if changed
            if (this.state.changed) {
              this.saveModule();
            }
          }}
          onMouseLeave={() => {
            // Enable drag
            this.setState({ disableDrag: false });
          }}
          onInput={handleInput}
          />
        );
      }
      if (value != null) {
        return (
          <OverlayTrigger placement="bottom" overlay={tooltip} key={keyName + "_overlay"}>
            <div style={{ display: 'block' }}>
              <Button onClick={ handleButtonDecrease } style={{...styleSliderButton, width: 17}}>-</Button>
              {sliderContent}
              <Button onClick={ handleButtonIncrease } style={{...styleSliderButton, width: 17}}>+</Button>
            </div>
          </OverlayTrigger>
        );
      }
    });
    
    // Tooltip
    const overlayProps = {
      show: true,
      container: this,
      target: () => findDOMNode(this.refs.target)
    };
    let tooltip = (<div/>);
    if (!this._dragging && !showCase) {
      if (graphData.error) {
        tooltip = (<Tooltip className="error" id={"EnvelopeModule" + this.props.id + "_tooltip"}>{graphData.error}</Tooltip>);
      } else if (graphData.warning) {
        tooltip = (<Tooltip className="warning" id={"EnvelopeModule" + this.props.id + "_tooltip"}>{graphData.warning}</Tooltip>);
      } else if (graphData.info) {
        tooltip = (<Tooltip className="info" id={"EnvelopeModule" + this.props.id + "_tooltip"}>{graphData.info}</Tooltip>);
      }
    }
    
    // Determine Wersi style "phase index" (1, 3, 5, 7, 9, 11, 13)
    const wersiPhase = this.props.index === null ? null : 1 + this.props.index * 2;
    
    // Create contents
    // We generally use bootstrap styles for colors to support flexible theming
    const contents = (
      <div style={{ display: 'inline-block', position: 'relative' }} onClick={() => { if(showCase){ this.saveModule(); } }}>
        <OverlayTrigger
          placement="top" overlay={tooltip} key={"EnvelopeModule" + this.props.id + "_overlay"}>
          <div style={{ ...style, opacity, width, height, marginRight, marginBottom, cursor }}
          className={showCase ? "btn-default" : "module"}
          >
            <div style={{ ...styleTitle }}>
              <span style={{ opacity: styleTitle.opacity * 0.6}}>{wersiPhase === null ? null : wersiPhase + '.'} </span>
              {this.props.title}
            </div>
            <div style={{ ...styleGraph }} ref={(c) => this._graph = c} />
            {iconContent}
            <div style={{ ...styleSliderContainer }}>
              {sustainToggle}
              {sliders}
            </div>
          </div>
        </OverlayTrigger>
      </div>
    );
    
    // Only allow drag if not disabled or not showcasing
    if (this.state.disableDrag || showCase) {
      return contents;
    }
    else {
      return connectDragSource(connectDropTarget(contents));
    }
  }
}
