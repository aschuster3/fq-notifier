# FQ Notifier
A simple serverless app that converts a task posted to the Fireman Queue into a rich-text Slack message

### Setup
0. Install the serverless node package.  I recommend having it globally available.
```sh
$ npm install --global serverless
```

### Install Packages
1. run `npm install` in `fq-notifier` directory

### To make changes
1. Create a new branch
2. Make changes
3. run `npm run eslint`
3. Make PR to merge new changes into master

### Deploy
1. Make sure you're on `master`
2. run `npm install`
3. run `npm run deploy`
