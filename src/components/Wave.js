import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { Panel, Button, Checkbox, Modal, Col, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';

import reactor from 'modules/flux';
import { toImmutable } from 'nuclear-js';

import Chartist from 'chartist';
import ChartistGraph from 'react-chartist';

import { actions as instrumentActions, getters as instrumentGetters } from 'modules/instrument';

const bgStyle = {
  position: 'absolute', left: 0, top: 0, width: '100%',
  paddingTop: 16, paddingLeft: 24,
  fontSize: 48, textAlign: 'left', letterSpacing: '0.2em',
  fontFamily: 'Raleway',
  opacity: 0.08,
  fontWeight: 300
};

export default class Wave extends Component {
  static defaultProps = {
    low: 0,
    high: 1
  };
  
  constructor() {
    super();
    
    this.state = {
      wave: null
    };
  }
  
  _watch(id, type) {
    const getter = instrumentGetters.byId(id, type);
    
    // Unwatch if possible
    this._unwatch();
    
    // Add observer
    this._unwatchFn = reactor.observe(getter, (v) => {
      this.setState((state) => {
        state[type] = v;
        return state;
      });
    });
    // Get initial data
    this.setState((state) => {
      state[type] = reactor.evaluate(getter);
      return state;
    });
  }
  _unwatch() {
    // Remove observer if it exists
    if (this._unwatchFn) {
      this._unwatchFn();
    }
  }
  
  componentWillUnmount() {
    this._unwatch();
  }
  
  componentWillMount() {
    this._watch(this.props.waveAddress, 'wave');
  }
  
  componentWillUpdate(nextProps, nextState) {
    // Check if instrument has changed
    if (this.props.waveAddress !== nextProps.waveAddress) {
      this._watch(nextProps.waveAddress, 'wave');
    }
  }
  
  updateWave(waveData) {
    let wave = this.state.wave.withMutations((state) => {
      state.set(this.props.waveSet, waveData);
    });
    instrumentActions.update(this.props.waveAddress, 'wave', wave);
  }
  
  _handleUpdateWave(index, value) {
    let waveData = this.state.wave.get(this.props.waveSet).set(index, this._decodeValue(value));
    
    // Call update callback, if any (this may possibly already handle wave updating, hence shouldUpdate)
    let shouldUpdate = true;
    if (this.props.updateCallback) {
      shouldUpdate = this.props.updateCallback(waveData);
    }
    
    // Update store, if we should update it
    if (shouldUpdate) {
      this.updateWave(waveData);
    }
  }
  
  // Converts from s8
  _encodeWave(wave) {
    return wave.map(this._encodeValue);
  }
  _encodeValue(x) {
    return x / 255;
  }
  
  // Converts to s8
  _decodeWave(wave) {
    return wave.map(this._decodeValue);
  }
  _decodeValue(x) {
    return x * 255;
  }
  
  render() {
    const { wave } = this.state;
    let waveData = null;
    
    // Check if we have any valid wave data
    if (wave) {
      waveData = this._encodeWave(wave.get(this.props.waveSet));
    }

    let lineChartData = {
      series: [
        waveData
        ? waveData.map((v, index) => {
          return { value: v, meta: index };
        }).toJS()
        : []
      ]
    }
    let lineChartOptions = {
      low: this.props.low,
      high: this.props.high,
      chartPadding: 10,
      fullWidth: true,
      height: '100px',
      axisX: {
        showGrid: true,
        showLabel: false,
        offset: 0
      },
      axisY: {
        showGrid: true,
        showLabel: false,
        offset: 0
      },
      plugins: [
        (chart) => {
          let dragElement = null, dragStartX = null, dragStartY = null, dragY = null, dragMinY = Infinity, dragMaxY = -Infinity;
        
          let downHandler = (event) => {
            if (event.target.classList.contains('ct-point')) {
              event.preventDefault();
            
              dragElement = event.target;
              dragStartX = event.clientX;
              dragStartY = event.clientY;
              dragY = Number(dragElement.getAttribute('y1'));
            
              // Iterate over all grid lines and find minimum and maximum Y values
              let nodeList = chart.container.querySelectorAll('.ct-grid.ct-vertical');
              for(let i = 0, n; n = nodeList[i]; ++i) {
                let y = Number(n.getAttribute('y1'));
                if (dragMinY > y) {
                  dragMinY = y;
                }
                if (dragMaxY < y) {
                  dragMaxY = y;
                }
              }
            }
          };
          let upHandler = (event) => {
            if (dragElement) {
              // Redraw chart
              let index = Number(dragElement.getAttribute('ct:meta'));

              // Normalize value based on Y value
              let value = (dragY - dragMinY) / (dragMaxY - dragMinY);
              
              // Rescale value based on chart high and low
              value = this.props.high - (value * (this.props.high - this.props.low));
              
              // Update wave data through store
              this._handleUpdateWave(index, value);

              // Reset variables
              dragElement = null, dragStartX = null, dragStartY = null, dragY = null, dragMinY = Infinity, dragMaxY = -Infinity;
            }
          };
          let moveHandler = (event) => {
            if (dragElement) {
              event.preventDefault();
            
              let dY = event.clientY - dragStartY;
              dragY += dY;
            
              // Drag inside of minimum and maximum Y
              if (dragY > dragMaxY) {
                dragY = dragMaxY;
              }
              else if (dragY < dragMinY) {
                dragY = dragMinY;
              }
            
              dragElement.setAttribute('y1', dragY);
              dragElement.setAttribute('y2', dragY);
            
              dragStartX = event.clientX;
              dragStartY = event.clientY;
            }
          };
        
          // Bind down on the chart
          chart.container.addEventListener('mousedown', downHandler);
          chart.container.addEventListener('touchstart', downHandler);

          // Bind up globally
          document.addEventListener('mouseup', upHandler);
          document.addEventListener('touchend', upHandler);
        
          // Bind move globally
          document.addEventListener('mousemove', moveHandler);
          document.addEventListener('touchmove', moveHandler);
        
          // Draw options
          chart.on('draw', (data) => {
            if (data.type == 'point') {
              data.element._node.style['stroke-width'] = '10px';
            }
          });
        }
      ]
    }
    
    return (
      <div style={{ position: 'relative', width: '100%', height: '100px' }}>
        <div style={{...bgStyle}}>
          {this.props.waveSet.substr(0, this.props.waveSet.length - 4)}
        </div>
        <ChartistGraph
          data={lineChartData}
          options={lineChartOptions}
          type={'Line'}
          style={{ position: 'absolute', left: 0, top: 0, width: '100%' }}
        />
      </div>
    );
  }
}
