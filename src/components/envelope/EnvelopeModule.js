import React, { Component, PropTypes } from 'react';
import { DragSource, DropTarget } from 'react-dnd';

import Rickshaw from 'rickshaw';

const style = {
  display: 'inline-block',
  cursor: 'move'
};

const styleTitle = {
	display: 'inline-block',
	height: 14,
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
			element.style.left = '0px';
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
			element.style.right = '0px';
			element.style.width = 'auto';
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
  static propTypes = {
    connectDragSource: PropTypes.func.isRequired,
    connectDropTarget: PropTypes.func.isRequired,
    isDragging: PropTypes.bool.isRequired,
    id: PropTypes.any.isRequired,
    text: PropTypes.string.isRequired,
    moveModule: PropTypes.func.isRequired,
    findModule: PropTypes.func.isRequired,
    width: PropTypes.number.isRequired,
    margin: PropTypes.number.isRequired
  };
  
  static defaultProps = {
    ...Component.defaultProps,
    showTimeAxis: false,
    graphHeight: 70
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
		if (this.props.showTimeAxis)
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
  
  componentWillMount() {
    // Move values into state
    this.setState({
      a: this.props.a,
      b: this.props.b,
      c: this.props.c,
      amplBefore: this.props.amplBefore,
      timeBefore: this.props.timeBefore
    });
  }
  
  componentDidMount() {
    // Render already occurred, this._graph must be valid, so construct the graph
    if (this._graph) {
      // Check for some props to see if we should create a graph at all
      if (this.props.a && this.props.b && this.props.c) {
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
      //graph.render();
      
      // Don't re-render
      return false;
    }
    return true;
  }
  
  render() {
    const { text, isDragging, connectDragSource, connectDropTarget, width, height, margin } = this.props;
    const { graph } = this.state;
    const opacity = isDragging ? 0 : 1;
    const marginRight = margin;

    // Update and render graph
    if (graph) {
      const graphData = this._graphFunction(this.state);
      graph.series[0].data = graphData.data;
      graph.update();
      graph.render();
    }
    
    // Create HTML5 sliders
    const sliders = Array.from(['a', 'b', 'c']).map((key) => {
      const value = this.state[key];
      if (value != null) {
        return (
          <input type="range"
          defaultValue={value}
          min={0}
          max={4095}
          key={key}
          onMouseEnter={() => this.setState({ disableDrag: true }) }
          onMouseLeave={() => this.setState({ disableDrag: false }) }
          onChange={(event) => {
            // Move value into this.state._KEY
            let update = {};
            update['_' + key] = event.target.value;
            this.setState(update);
          }}
          />
        );
      }
    });
    
    // Create contents
    // We generally use bootstrap styles for colors to support flexible theming
    const contents = (
      <div style={{ ...style, opacity, width, height, marginRight }} className="btn-default env-content">
        <div style={{ ...styleTitle }}>{this.props.title}</div>
        <div style={{ ...styleGraph }} ref={(c) => this._graph = c} />
        <div style={{ ...styleSliderContainer }}>
          {sliders}
        </div>
      </div>
    );
    
    // Only allow drag if not disabled
    if (this.state.disableDrag) {
      return contents;
    }
    else {
      return connectDragSource(connectDropTarget(contents));
    }
  }
}
