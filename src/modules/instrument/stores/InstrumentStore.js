import { Store, toImmutable } from 'nuclear-js';
import { UPDATE_INSTRUMENT } from '../actionTypes';

export default Store({
  getInitialState() {
    return toImmutable({});
  },

  initialize() {
    this.on(UPDATE_INSTRUMENT, updateInstrument);
  }
});

function updateInstrument(state, { id, key, data }) {
  return state.setIn([id, key], data);
}
