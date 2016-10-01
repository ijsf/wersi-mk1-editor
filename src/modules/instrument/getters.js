/**
* byId
*
* Getter for a specific instrument, identified by its id.
*/
exports.byId = function(id, key) {
  if (key) {
    return ['instruments', id, key];
  }
  else {
    return ['instruments', id];
  }
};
