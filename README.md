# FQ Notifier
A simple serverless app that converts a task posted to the Fireman Queue into a rich-text Slack message

### Setup
Step 0) Install the serverless node package.  I recommend having it globally available.
```sh
$ npm install --global serverless
```

With that, confirm you have AWS credentials setup and ready.  If you would like, you can setup a separate
profile so that you can keep your serverless administration separate from regular AWS.  Below steps
will assume you have an additional profile named `serverlessAdmin` setup in your AWS credentials.  To setup
another set of credentials, use the following command (which assumes you have the `awscli` installed, which
MacOS users can get from `brew`).
```sh
$ aws configure --profile [your-desired-profile-name]
```

Step 1) To deploy the function, run the following:
```sh
$ serverless deploy -v --aws-profile serverlessAdmin
```

Step 2) After the function has finished, navigate to the AWS Lambda console, select your newly created
function and add the Environment Variables for `CLOCKWISE_API_URL`, `CLOCKWISE_API_KEY`, and `SLACKHOOK`.

And that's it!

### Changing
Assuming you've gone through the Setup steps, if you want to make any changes, you can run the following
to quickly push up your changes.
```sh
$ serverless deploy function -f app --aws-profile serverlessAdmin
```

