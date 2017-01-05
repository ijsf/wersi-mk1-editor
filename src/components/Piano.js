import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { Panel, Button, Checkbox, Modal, Col, Form, FormGroup, InputGroup, FormControl, ControlLabel } from 'react-bootstrap';

import BeautifulPianoCSS from '../vendor/beautiful-piano/styles.css';

/**
 * Loosely based on musicjs/beautiful-piano
 *
 * The MIT License (MIT)
 * 
 * Copyright (c) 2015 Anton Wilhelm
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export default class Piano extends Component {
  static defaultProps = {
    startKey: 'A',
    startOctave: 2,
    endKey: 'F',
    endOctave: 5,
    showNames: true
  };
  
  constructor() {
    super();
    
    this.state = {
      keyActive: null
    };
  }
  
  render() {
    const keys = {
        en: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
        de: ['C', 'D', 'E', 'F', 'G', 'A', 'H']
    };

    const keyReverseMap = {
        C: 0,
        D: 1,
        E: 2,
        F: 3,
        G: 4,
        A: 5,
        B: 6
    };

    const keysLength = keys.en.length;

    // black keys belongs to the previous white key
    // It's the DOM representation
    // avoid here to use #, because it's not a valid CSS selector
    const blackKeyNameMap = {
        en: {
            C: false,
            D: [' C#', ' Db'],
            E: [' D#', ' Eb'],
            F: false,
            G: [' F#', ' Gb'],
            A: [' G#', ' Ab'],
            B: [' A#', ' Bb']
        },
        de: {
            C: false,
            D: ['Cis', 'Des'],
            E: ['Dis', ' Es'],
            F: false,
            G: ['Fis', 'Ges'],
            A: ['Gis', ' As'],
            B: ['Ais', '  B']
        }
    };
    const blackKeyMap = {
        C: false,
        D: ['Cs', 'Db'],
        E: ['Ds', 'Eb'],
        F: false,
        G: ['Fs', 'Gb'],
        A: ['Gs', 'Ab'],
        B: ['As', 'Bb']
    };

    // scientific notation
    const octaves = [0,1,2,3,4,5,6,7,8,9,10];
    
    let { startKey, startOctave, endKey, endOctave } = this.props;
    let { keyActive } = this.state;
    
    let getCurrentNotation = function(key, octaveIndex) {
      return key + octaveIndex;
    };

    var keyElementArray = [];
    var firstOccurrence = true;
    var keyActiveOffset = 0;
    for (var o=startOctave; o<=endOctave; o++) {
      for (var k=keyReverseMap[startKey]; k<(o === endOctave ? keyReverseMap[endKey]+1 : keysLength); k++) {
        var n = keys.en[k]; // key name
        var displayWhiteKey = getCurrentNotation(keys['en'][k], o);
        if (blackKeyMap[n] && !firstOccurrence) {
          var blackNames = blackKeyMap[n].map(function(k) {return k+o});
          var displayBlackKey = blackKeyNameMap['en'][n][0];
          var blackIpnName = blackKeyNameMap['de'][n][0].replace('is', '#')
          const whiteActive = keyActive == Infinity || (keyActiveOffset + 1) == keyActive;
          const blackActive = keyActive == Infinity || keyActiveOffset == keyActive;
          keyElementArray.push(
            (<li>
              <div data-ipn={n+o} data-keyname={displayWhiteKey} className={'anchor ' + n+o + (whiteActive ? ' active' : '')}/>
              <span data-ipn={blackIpnName+o} data-keyname={displayBlackKey} className={blackNames.join(' ') + (blackActive ? ' active' : '')}/>
            </li>)
          );
          keyActiveOffset += 2;
        } else {
          const whiteActive = keyActive == Infinity || keyActiveOffset == keyActive;
          keyElementArray.push(
            (<li>
              <div data-ipn={n+o} data-keyname={displayWhiteKey} className={'anchor ' + n+o + (whiteActive ? ' active' : '')}/>
            </li>)
          );
          ++keyActiveOffset;
        }
        if (firstOccurrence) {
          firstOccurrence = false;
        }
      }
      startKey = 'C'; // continue next octave from C
    }
    return (
      <div className={`piano-show-names`} style={{...this.props.style}}>
        <ul id="beautiful-piano" style={{display: 'inline-block'}}>
          {keyElementArray}
        </ul>
      </div>
    );
  }
}
