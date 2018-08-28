let request = require('request');

const API_URL = process.env.CLOCKWISE_API_URL;
const API_KEY = process.env.CLOCKWISE_API_KEY;
const SLACKHOOK = process.env.SLACKHOOK;

const SUCCESS_RESPONSE = {
  statusCode: 200,
  body: 'ok'
};

const DO_NOTHING_RESPONSE = {
  statusCode: 200,
  body: 'do_nothing'
};

function formSlackMessage(task_body) {
  const parsed_task_body = JSON.parse(task_body);
  const pre_message_text = 'New request in Fireman Queue from ' + parsed_task_body.first_name;
  let base_message = { fallback: pre_message_text, pretext: pre_message_text, color: 'danger' };
  base_message.fields = [{ title: 'Issue with H111', value: 'Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaah' }]
  return JSON.stringify([base_message])
}

function processNewTask(task_id, state) {
  let options = {
    url: `${API_URL}${task_id}?include_custom_fields=true`,
    headers: {
      'Accept': 'application/json',
      'Authtoken': API_KEY
    }
  }
  request(options, (error, response, body) => {
    let message_content = formSlackMessage(body);
    const form_sub = { form: { payload: '{ "attachments": ' + message_content + '}' }}
    request.post(SLACKHOOK, form_sub);
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
