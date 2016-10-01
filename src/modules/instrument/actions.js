import reactor from 'modules/flux';
import { UPDATE_INSTRUMENT } from './actionTypes';

exports.update = function(id, key, data) {
  reactor.dispatch(UPDATE_INSTRUMENT, { id, key, data });
};
