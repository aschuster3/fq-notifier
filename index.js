let request = require('request');
let qs = require('querystring');

const API_URL = process.env.CLOCKWISE_API_URL;
const API_KEY = process.env.CLOCKWISE_API_KEY;

const SLACK_CHAT_POST_ROUTE = 'https://slack.com/api/chat.postMessage'
const SLACK_CHAT_UPDATE_ROUTE = 'https://slack.com/api/chat.update'
const SLACK_OAUTH_ACCESS = process.env.SLACK_OAUTH_ACCESS

const SUCCESS_RESPONSE = {
  statusCode: 200,
  body: 'ok'
};

const DO_NOTHING_RESPONSE = {
  statusCode: 200,
  body: 'do_nothing'
};

const EMPTY_RESPONSE = {
  statusCode: 200
};

const FORM_URLENCODED = 'application/x-www-form-urlencoded';
const APPLICATION_JSON = 'application/json';

function determineHospitalOrGroup(task) {
  const hospital_id_field = task.extra_fields.find((element) => {
    return element.name === 'Hospital ID';
  });
  const group_id_field = task.extra_fields.find((element) => {
    return element.name === 'Group ID';
  });
  if (hospital_id_field.value !== '') { return 'Hospital(s) ' + hospital_id_field.value; }
  else if (group_id_field.value !== '') { return 'Group(s) ' + group_id_field.value; }
  else { return 'unspecified hospital(s)'; }
}

function formSlackMessage(raw_task_body) {
  const task = JSON.parse(raw_task_body);
  const pre_message = 'New request in Fireman Queue from ' + task.first_name;
  const issue_message = 'Issue with ' + determineHospitalOrGroup(task);
  const description_field = task.extra_fields.find((element) => {
    return element.name === 'Description';
  });

  let base_message = { fallback: pre_message, callback_id: task.id, pretext: pre_message, color: 'warning' };
  base_message.fields = [{ title: issue_message, value: description_field.value, short: false }]

  // These actions are used below to determine how to act on a FQ task
  base_message.actions = [{ name: "task", text: "Complete", type: "button", style: "primary", value: "callback" },
                          { name: "task", text: "Remove", type: "button", style: "danger", value: "remove" }]
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
    let next_options = {
      method: 'POST',
      uri: SLACK_CHAT_POST_ROUTE,
      form: {
        token: SLACK_OAUTH_ACCESS,
        channel: '#fireman',
        attachments: message_content,
        as_user: true
      },
      headers: {
        'Content-Type': APPLICATION_JSON,
        'Accept': APPLICATION_JSON
      }
    }
    request(next_options);
  });
}

function firemanQueueTaskResponse(body, callback) {
  if(body.event_type !== 'create') {
    callback(null, DO_NOTHING_RESPONSE);
    return;
  }
  processNewTask(body.appointment_id, body.event_type)
  callback(null, SUCCESS_RESPONSE);
}

function taskPostProcessing(action, task_id) {
  let options = {
    method: 'PUT',
    url: `${API_URL}${task_id}/${action}`,
    headers: {
      'Accept': 'application/json',
      'Authtoken': API_KEY
    }
  }

  // Update the FQ task on Clockwise
  request(options, (error, response, body) => {
    console.log('This is the CW post task response')
    console.log(error)
    console.log(response)
    console.log(body)
  })
}

function slackTaskPostProcessing(body, action) {
  // good: 2eb886
  // warning: daa038
  // danger: a30200

  let new_attachments = body.original_message.attachments
  delete new_attachments[0].actions

  if(action === 'callback') {
    new_attachments[0].color = '2eb886'
    new_attachments[0].fields.push({ title: 'Task marked complete!' })
  } else if (action === 'remove') {
    new_attachments[0].color = 'a30200'
    new_attachments[0].fields.push({ title: 'Task was removed!' })
  } else {
    delete new_attachments[0].color
    new_attachments[0].fields.push({ title: 'I have no idea what you did!' })
  }

  let options = {
    method: 'POST',
    uri: SLACK_CHAT_UPDATE_ROUTE,
    form: {
      token: SLACK_OAUTH_ACCESS,
      channel: body.channel.id,
      ts: body.message_ts,
      attachments: JSON.stringify(new_attachments),
      as_user: true
    },
    headers: {
      'Content-Type': APPLICATION_JSON,
      'Accept': APPLICATION_JSON
    }
  }

  // Update the message to reflect desired change in Slack
  request(options, (error, response, body) => {
    console.log('This is the Slack post task response')
    console.log(error)
    console.log(response)
    console.log(body)
  })
}

function slackResponse(body, callback) {
  // Immediately respond so we can process at our own pace
  callback(null, EMPTY_RESPONSE)

  // The action should return `callback` or `remove`,
  // which determines what happens to the fq task
  let action = body.actions[0].value

  taskPostProcessing(action, body.callback_id)
  slackTaskPostProcessing(body, action)
}

function digestEvent(event) {
  // Slack apps send responnses as URL encoded forms, so this
  // is a general purpose method of processing those
  if(event.headers['Content-Type'] === FORM_URLENCODED) {
    let parsed_form = qs.parse(event.body)
    return JSON.parse(parsed_form.payload)
  }
  return JSON.parse(event.body)
}

module.exports.handler = (event, context, callback) => {
  let body = digestEvent(event)
  let userAgent = event.headers['User-Agent']

  // A pretty hacky check to see if the message came from Slack
  if(userAgent.indexOf('Slack') !== -1) return slackResponse(body, callback)
  firemanQueueTaskResponse(body, callback)
};
