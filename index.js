let request = require('request');

const API_URL = process.env.CLOCKWISE_API_URL

const SUCCESS_RESPONSE = {
  statusCode: 200,
  body: 'ok'
}

const DO_NOTHING_RESPONSE = {
  statusCode: 200,
  body: 'do_nothing'
}

function processNewTask(task_id, state) {
  let options = {
    url: `https://apistaging.clockwisemd.com/v1/appointments/${task_id}`,
    headers: {
      'Accept': 'application/json',
      'Authtoken': process.env.CLOCKWISE_API_KEY
    }
  }
  request(options, (error, response, body) => {
    let form_sub = { form: { payload: '{ "text": ' + JSON.stringify(body) + '}' }}
    request.post(process.env.SLACKHOOK, form_sub);
  });
}

module.exports.handler = (event, context, callback) => {
  let body = JSON.parse(event.body)
  if(body.action !== 'create' && body.action !== 'callback') {
    callback(null, DO_NOTHING_RESPONSE);
    return;
  }
  processNewTask(body.appointment_id, body.action)
  callback(null, SUCCESS_RESPONSE);
};
