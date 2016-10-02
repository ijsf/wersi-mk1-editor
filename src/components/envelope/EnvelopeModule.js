import React, { Component, PropTypes } from 'react';
import { DragSource, DropTarget } from 'react-dnd';

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
	fontSize: 12,
  fontWeight: 'normal',
  opacity: 0.8
};

const styleGraph = {
	display: 'inline-block'
};

const styleSlider = {
  marginTop: 5,
  marginBottom: 5
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
			title.innerHTML = unit.formatter(new Date(value * 1000));
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
    
    // Default min and max for 12-bit values
    aMin: 0,
    aMax: 4095
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
      timeBefore: props.timeBefore,
      
      // Drag copies of values
      _a: null,
      _b: null,
      _c: null
    };
    
    this._graph = null;
  }
  
  static moduleSource = {
    canDrag(props) {
      // Only allow drag if the required properties are actually specified
      return (props.findModule) ? true : false;
    },
    
    beginDrag(props) {
      return {
        id: props.id,
        originalIndex: props.findModule(props.id).index
      };
    },
    endDrag(props, monitor) {
      const { id: droppedId, originalIndex } = monitor.getItem();
      const didDrop = monitor.didDrop();

      if (!didDrop) {
        props.moveModule(droppedId, originalIndex);
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
  
  _handleSave() {
    throw "No _handleSave implemented."
  }
  
  componentWillUpdate(nextProps, nextState) {
    // Move values into state
    /*
    nextState.a = nextProps.a;
    nextState.b = nextProps.b;
    nextState.c = nextProps.c;
    nextState.amplBefore = nextProps.amplBefore;
    nextState.timeBefore = nextProps.timeBefore;
    */
  }
  
  _getUpdatedData(props) {
    let { id, data, a, b, c, amplBefore, timeBefore } = props;
    
    // Check if we received data, in which case we will decode the data
    if (this._decode && data) {
      let decoded = this._decode(data);
      a = decoded.a;
      b = decoded.b;
      c = decoded.c;
    }
    
    // Move values into hacky global (time is typically a and amplitude is typically b)
    window.envelopeModules[id] = {
      a: a,
      b: b
    };
    
    // Attempt to get timeBefore (a) and amplBefore (b) from hacky global
    // (Here, we assume that the previous module has already executed this function!)
    if (id > 0) {
      timeBefore = window.envelopeModules[id - 1].a;
      amplBefore = window.envelopeModules[id - 1].b;
    }
    
    return {
      a: a,
      b: b,
      c: c,
      amplBefore: amplBefore,
      timeBefore: timeBefore
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
  
  componentDidMount() {
    // Render already occurred, this._graph must be valid, so construct the graph
    if (this._graph) {
      // Check for some props to see if we should create a graph at all
      if (this.props.a || this.props.b || this.props.c) {
        this._createGraph();
      }
    }
  }
  
  shouldComponentUpdate(nextProps, nextState) {
    const { graph } = this.state;

    // If we are dragging, don't re-render
    if (this.state._a !== nextState._a
    || this.state._b !== nextState._b
    || this.state._c !== nextState._c) {
      // Copy drag values into real values
      nextState.a = nextState._a ? nextState._a : this.state.a;
      nextState.b = nextState._b ? nextState._b : this.state.b;
      nextState.c = nextState._c ? nextState._c : this.state.c;
    
      // Just update the graph
      const graphData = this._graphFunction(nextState);
      graph.series[0].data = graphData.data;
      graph.update();
      
      // Don't re-render
      return false;
    }
    return true;
  }
  
  render() {
    const { isDragging, connectDragSource, connectDropTarget, width, height, margin } = this.props;
    const { graph } = this.state;
    const opacity = isDragging ? 0 : 1;
    const marginRight = margin;
    
    // Find out whether we're actually being used for editing or not (dragging must be enabled)
    const showCase = (this.props.findModule) ? false : true;
    
    // Determine if we should show a move cursor for specific elements
    const cursor = showCase ? 'default' : 'move';

    // Update and render graph
    if (graph) {
      const graphData = this._graphFunction(this.state);
      graph.series[0].data = graphData.data;
      graph.update();
      graph.render();
    }
    
    // Create HTML5 sliders (don't show if we're showcasing)
    const sliders = showCase ? null : Array.from(['a', 'b', 'c']).map((key) => {
      const value = this.state[key];
      const valueMin = this.props[key + "Min"];
      const valueMax = this.props[key + "Max"];
      const title = this.props[key + "Title"];
      if (value != null) {
        return (
          <input type="range"
          style={{...styleSlider}}
          data-tip={title} data-type="info" data-effect="solid" data-place="bottom" data-class="tooltip"
          defaultValue={value}
          min={valueMin}
          max={valueMax}
          key={key}
          onMouseEnter={() => {
            // Disable drag
            this.setState({ disableDrag: true, changed: false });
          }}
          onMouseUp={() => {
            // Update state, but only if changed
            if (this.state.changed) {
              this.props.save(this._handleSave());
            }
          }}
          onMouseLeave={() => {
            // Enable drag
            this.setState({ disableDrag: false });
          }}
          onChange={(event) => {
            // Move value into this.state._KEY
            let update = {};
            update['_' + key] = Number(event.target.value);
            update.changed = true;
            this.setState(update);
          }}
          />
        );
      }
    });
    
    // Create contents
    // We generally use bootstrap styles for colors to support flexible theming
    const contents = (
      <div style={{ ...style, opacity, width, height, marginRight, cursor }} className="btn-default">
        <div style={{ ...styleTitle }}>{this.props.title}</div>
        <div style={{ ...styleGraph }} ref={(c) => this._graph = c} />
        <div style={{ ...styleSliderContainer }}>
          {sliders}
        </div>
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
