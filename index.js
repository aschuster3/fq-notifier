const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const request = require('request');
const express = require('express');
const app = express();

const slackhook = 'https://hooks.slack.com/services/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';

let requestParser = function(request_id, action) {
  if(action !== 'create') return 'Do nothing';
  request.post(slackhook, { form: { payload: '{ "text": "Yo boi" }' }});
  return 'Do something';
}

app.use(bodyParser.json({ strict: false }));

app.get('/', function (req, res) {
  request.post(slackhook, { form: { payload: '{ "text": "Hey team" }' }})
  res.send('Hello World');
})

app.post('/fq-notify', function (req, res) {
  const { appointment_id, action } = req.body
  res.send(requestParser(appointment_id, action));
})

module.exports.handler = serverless(app);
