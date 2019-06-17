let request = require('request')
let qs = require('querystring')

const API_URL = process.env.CLOCKWISE_API_URL
const API_KEY = process.env.CLOCKWISE_API_KEY

const SLACK_CHAT_POST_ROUTE = 'https://slack.com/api/chat.postMessage'
const SLACK_CHAT_UPDATE_ROUTE = 'https://slack.com/api/chat.update'
const SLACK_OAUTH_ACCESS = process.env.SLACK_OAUTH_ACCESS

const SLACK_CHANNEL = '#fireman'

const SUCCESS_RESPONSE = {
  statusCode: 200,
  body: 'ok'
}

const DO_NOTHING_RESPONSE = {
  statusCode: 200,
  body: 'do_nothing'
}

const EMPTY_RESPONSE = {
  statusCode: 200
}

const ACTION_RESPONSES = {
  'callback': {
    'color': '2eb886',
    'title': 'Task marked complete!'
  },
  'remove': {
    'color': 'a30200',
    'title': 'Task was removed!'
  }
}

const FORM_URLENCODED = 'application/x-www-form-urlencoded'
const APPLICATION_JSON = 'application/json'

function determineHospitalOrGroup (task) {
  const hospitalIdField = task.extra_fields.find((element) => {
    return element.name === 'Hospital ID'
  })
  const groupIdField = task.extra_fields.find((element) => {
    return element.name === 'Group ID'
  })
  if (hospitalIdField.value !== '') {
    return 'Hospital(s) ' + hospitalIdField.value
  } else if (groupIdField.value !== '') {
    return 'Group(s) ' + groupIdField.value
  } else { return 'unspecified hospital(s)' }
}

function pluckHelpfulLinks (task) {
  const hospitalIdField = task.extra_fields.find((element) => {
    return element.name === 'Hospital ID'
  })
  const groupIdField = task.extra_fields.find((element) => {
    return element.name === 'Group ID'
  })
  let helpfulLinks
  if (hospitalIdField.value !== '') {
    helpfulLinks = [
      `https://www.clockwisemd.com/hospitals/${hospitalIdField.value}/patient_queue`,
      `https://www.clockwisemd.com/team/admin/hospitals/${hospitalIdField.value}`
    ]
  } else if (groupIdField.value !== '') {
    helpfulLinks = [
      `https://www.clockwisemd.com/groups/${groupIdField.value}`,
      `https://www.clockwisemd.com/team/admin/groups/${groupIdField.value}`
    ]
  }
  return helpfulLinks.join('\n')
}

function formSlackMessage (rawTaskBody) {
  const task = JSON.parse(rawTaskBody)
  const preMessage = 'New request in Fireman Queue from ' + task.first_name
  const issueMessage = 'Issue with ' + determineHospitalOrGroup(task)
  const helpfulLinks = pluckHelpfulLinks(task)
  const descriptionField = task.extra_fields.find((element) => {
    return element.name === 'Description'
  })

  let baseMessage = { fallback: preMessage, callback_id: task.id, pretext: preMessage, color: 'warning' }
  baseMessage.fields = [{ title: issueMessage, value: descriptionField.value + '\n\n' + helpfulLinks, short: false }]

  // These actions are used below to determine how to act on a FQ task
  baseMessage.actions = [{ name: 'task', text: 'Complete', type: 'button', style: 'primary', value: 'callback' },
    { name: 'task', text: 'Remove', type: 'button', style: 'danger', value: 'remove' },
    { name: 'task', text: 'Add To Playbook', type: 'button', value: 'playbook' }]
  return JSON.stringify([baseMessage])
}

function processNewTask (taskId, state) {
  let options = {
    url: `${API_URL}${taskId}?include_custom_fields=true`,
    headers: {
      'Accept': 'application/json',
      'Authtoken': API_KEY
    }
  }
  request(options, (error, response, body) => {
    let messageContent = formSlackMessage(body)
    let nextOptions = {
      method: 'POST',
      uri: SLACK_CHAT_POST_ROUTE,
      form: {
        token: SLACK_OAUTH_ACCESS,
        channel: SLACK_CHANNEL,
        attachments: messageContent,
        as_user: true
      },
      headers: {
        'Content-Type': APPLICATION_JSON,
        'Accept': APPLICATION_JSON
      }
    }
    console.log('Posted Slack Message!')
    console.log(error)
    console.log(response)
    request(nextOptions)
  })
}

function firemanQueueTaskResponse (body, callback) {
  if (body.event_type !== 'create') {
    callback(null, DO_NOTHING_RESPONSE)
    return
  }
  processNewTask(body.appointment_id, body.event_type)
  callback(null, SUCCESS_RESPONSE)
}

function taskPostProcessing (action, taskId) {
  let options = {
    method: 'PUT',
    url: `${API_URL}${taskId}/${action}`,
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

function taskPlaybookPostProcessing (body) {
  const link = `https://docutap.slack.com/archives/${body.channel.id}/p${body.message_ts}`
  const playbookData = {
    'custom_fields': {
      '1320': `<a href=${link} rel="noopener noreferrer" target="_blank">Link to Message</a>`
    }
  }

  let options = {
    method: 'PUT',
    url: `${API_URL}${body.callback_id}/update`,
    json: playbookData,
    headers: {
      'Accept': 'application/json',
      'Authtoken': API_KEY
    }
  }

  // Update the FQ task on Clockwise
  request(options, (error, response, body) => {
    console.log('This is the CW post playbook task response')
    console.log(error)
    console.log(response)
    console.log(body)
  })
}

function slackTaskPostProcessing (body, action) {
  // good: 2eb886
  // warning: daa038
  // danger: a30200
  let newAttachments = body.original_message.attachments

  if (action === 'playbook') {
    newAttachments = playbookProcessing(body)
  } else {
    delete newAttachments[0].actions

    if (ACTION_RESPONSES[action]) {
      newAttachments[0].color = ACTION_RESPONSES[action].color
      newAttachments[0].fields.push({ title: ACTION_RESPONSES[action].title })
    } else {
      delete newAttachments[0].color
      newAttachments[0].fields.push({ title: 'I have no idea what you did!' })
    }
  }

  let options = {
    method: 'POST',
    uri: SLACK_CHAT_UPDATE_ROUTE,
    form: {
      token: SLACK_OAUTH_ACCESS,
      channel: body.channel.id,
      ts: body.message_ts,
      attachments: JSON.stringify(newAttachments),
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

function playbookProcessing (body) {
  let newAttachments = body.original_message.attachments
  newAttachments[0].actions = newAttachments[0].actions.filter(item => item.value !== 'playbook')
  newAttachments[0].fields[0].value += '\n*Note made to add to playbook!*'

  return newAttachments
}

function slackResponse (body, callback) {
  // Immediately respond so we can process at our own pace
  callback(null, EMPTY_RESPONSE)

  // The action should return `callback`, `remove`, or `playbook`,
  // which determines what happens to the fq task
  let action = body.actions[0].value
  if (action === 'callback' || action === 'remove') {
    taskPostProcessing(action, body.callback_id)
  } else if (action === 'playbook') {
    taskPlaybookPostProcessing(body)
  }
  slackTaskPostProcessing(body, action)
}

function digestEvent (event) {
  // Slack apps send responnses as URL encoded forms, so this
  // is a general purpose method of processing those
  if (event.headers['Content-Type'] === FORM_URLENCODED) {
    let parsedForm = qs.parse(event.body)
    return JSON.parse(parsedForm.payload)
  }

  return JSON.parse(event.body)
}

module.exports.handler = (event, context, callback) => {
  let body = digestEvent(event)
  let userAgent = event.headers['User-Agent']

  // A pretty hacky check to see if the message came from Slack
  if (userAgent.indexOf('Slack') !== -1) return slackResponse(body, callback)
  firemanQueueTaskResponse(body, callback)
}
