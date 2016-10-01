/**
 * instrument
 *
 * This module contains the store related functionality to contain all instrument data.
 *
*/

import reactor from 'modules/flux';

import InstrumentStore from './stores/InstrumentStore';

import * as _actions from './actions';
import * as _getters from './getters';

reactor.registerStores({
  'instruments': InstrumentStore
});

export const actions = _actions;
export const getters = _getters;
