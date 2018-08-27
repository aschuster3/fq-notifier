const request = require('request');

let requestParser = function(request_id, action) {
  if(action !== 'create') return 'Do nothing';
  return 'Do something';
}

module.exports.parseFQRequest = requestParser
