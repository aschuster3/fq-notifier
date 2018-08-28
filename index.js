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

function determineHospitalOrGroup(task) {
  const hospital_id_field = task.extra_fields.find((element) => {
    return element.name === 'Hospital ID';
  });
  const group_id_field = task.extra_fields.find((element) => {
    return element.name === 'Group ID';
  });
  if (hospital_id_field.value !== '') { return 'Hospital(s) ' + hospital_id_field.value; }
  else if (group_id_field.value !== '') { return 'Groups(s) ' + group_id_field.value; }
  else { return 'unspecified hospital(s)'; }
}

function formSlackMessage(raw_task_body) {
  const task = JSON.parse(raw_task_body);
  const pre_message = 'New request in Fireman Queue from ' + task.first_name;
  const issue_message = 'Issue with ' + determineHospitalOrGroup(task);
  const description_field = task.extra_fields.find((element) => {
    return element.name === 'Description';
  });

  let base_message = { fallback: pre_message, pretext: pre_message, color: 'danger' };
  base_message.fields = [{ title: issue_message, value: description_field.value, short: false }]
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
