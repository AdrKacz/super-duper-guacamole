/* Amplify Params - DO NOT EDIT
	ANALYTICS_AWA_ID
	ANALYTICS_AWA_REGION
	API_AWAMESSAGES_GRAPHQLAPIENDPOINTOUTPUT
	API_AWAMESSAGES_GRAPHQLAPIIDOUTPUT
	API_AWAMESSAGES_GRAPHQLAPIKEYOUTPUT
	ENV
	REGION
Amplify Params - DO NOT EDIT */const AWS = require('aws-sdk');

const axios = require('axios');
const gql = require('graphql-tag');
const graphql = require('graphql');
const { print } = graphql;

const region = process.env.ANALYTICS_AWA_REGION;
const appId = process.env.ANALYTICS_AWA_ID;

function createMessageRequest({addresses, action, message, priority, silent, title, ttl, url}) {
  let messageRequest = {
    'Addresses': {},
    'MessageConfiguration': {
      DefaultPushNotificationMessage: {
        Action: action,
        Body: message,
        SilentPush: silent,
        Title: title,
        Url: url,
      },
      'GCMMessage': {
        'Action': action,
        'Body': message,
        'Priority': priority,
        'SilentPush': silent,
        'Title': title,
        'TimeToLive': ttl,
        'Url': url,
      },
      'APNSMessage': {
        'Action': action,
        'Body': message,
        'Priority': priority,
        'SilentPush': silent,
        'Title': title,
        'TimeToLive': ttl,
        'Url': url,
      },
      'BaiduMessage': {
        'Action': action,
        'Body': message,
        'SilentPush': silent,
        'Title': title,
        'TimeToLive': ttl,
        'Url': url,
      },
      'ADMMessage': {
        'Action': action,
        'Body': message,
        'SilentPush': silent,
        'Title': title,
        'Url': url,
      },
    },
  };

  addresses.forEach((address, i) => {
    messageRequest['Addresses'][address.token] = {
      'ChannelType' : address.service,
    }
  });

  return messageRequest;
}

const parameters = {
  // The title that appears at the top of the push notification.
  title: 'You just received a message',

  // The Amazon Pinpoint project ID that you want to use when you send this
  // message. Make sure that the push channel is enabled for the project that
  // you choose.
  applicationId: appId,

  // The action that should occur when the recipient taps the message. Possible
  // values are OPEN_APP (opens the app or brings it to the foreground),
  // DEEP_LINK (opens the app to a specific page or interface), or URL (opens a
  // specific URL in the device's web browser.)
  action: 'OPEN_APP',

  // The priority of the push notification. If the value is 'normal', then the
  // delivery of the message is optimized for battery usage on the recipient's
  // device, and could be delayed. If the value is 'high', then the notification is
  // sent immediately, and might wake a sleeping device.
  priority: 'normal',

  // The amount of time, in seconds, that the push notification service provider
  // (such as FCM or APNS) should attempt to deliver the message before dropping
  // it. Not all providers allow you specify a TTL value.
  ttl: 30,

  // Boolean that specifies whether the notification is sent as a silent
  // notification (a notification that doesn't display on the recipient's device).
  silent: false,
}

async function sendMessages(parameters) {
  const messageRequest = createMessageRequest(parameters);
  console.log('send message request: ', messageRequest);

  // Specify that you're using a shared credentials file, and specify the
  // IAM profile to use.
  // const credentials = new AWS.SharedIniFileCredentials({ profile: 'default' });
  // AWS.config.credentials = credentials;

  // Specify the AWS Region to use.
  AWS.config.update({region: region});

  const pinpoint = new AWS.Pinpoint();

  // Try to send the message.
  return await pinpoint.sendMessages({
    "ApplicationId": parameters['applicationId'],
    "MessageRequest": messageRequest
  }).promise()
  .then(data => {console.log('Received data: ', data); return data})
  .catch(err => console.log('error in pinpoint send messages: ', err));
}

const listUsers = gql`
  query listUsers {
    listUsers {
      items {
        token
      }
    }
  }
`;

async function retreiveUserTokens() {
  try {
    const graphqlData = await axios({
      url: process.env.API_AWAMESSAGES_GRAPHQLAPIENDPOINTOUTPUT,
      method: 'post',
      headers: {
        'x-api-key': process.env.API_AWAMESSAGES_GRAPHQLAPIKEYOUTPUT,
      },
      data: {
        query: print(listUsers),
      }
    });
    const body = {
      graphqlData: graphqlData.data.data.listUsers,
    };
    return body.graphqlData.items.map(item => (item.token));
  } catch (err) {
    console.log('error posting to appsync: ', err);
  }
}

exports.handler = async (event) => {
  //eslint-disable-line
  console.log(JSON.stringify(event, null, 2));
  if (!event.Records) {
    return Promise.resolve('No record to process');
  }
  console.log('Receive new Record(s)');
  console.dir(event);
  const records = event.Records.map(record => ({
    new: AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage),
    old: AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage)
  }));

  console.dir(records, { depth: null });

  const tokens = await retreiveUserTokens();
  console.log('tokens: ', tokens);

  // Send to each token
  for (let i = 0; i < records.length; i++) {
    const record = records[i].new;
    if (record && record.__typename === 'Message') {
      const output = await sendMessages({
        ...parameters,
        addresses: tokens.map((token, i) => ({
          token: token,
          service: 'APNS', // TODO: Handle Google AND Apple
        })),
        title: `${record.who}`,
        message: record.what,
      });
    }
  }

  return Promise.resolve('Successfully processed DynamoDB record');
};
