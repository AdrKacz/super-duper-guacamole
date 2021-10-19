const AWS = require('aws-sdk');
const region = process.env.AWS_REGION;

function createMessageRequest({token, service, action, message, priority, silent, title, ttl, url}) {
  let messageRequest;
  if (service == 'GCM') {
    messageRequest = {
      'Addresses': {
        [token]: {
          'ChannelType' : 'GCM'
        }
      },
      'MessageConfiguration': {
        'GCMMessage': {
          'Action': action,
          'Body': message,
          'Priority': priority,
          'SilentPush': silent,
          'Title': title,
          'TimeToLive': ttl,
          'Url': url
        }
      }
    };
  } else if (service == 'APNS') {
    messageRequest = {
      'Addresses': {
        [token]: {
          'ChannelType' : 'APNS'
        }
      },
      'MessageConfiguration': {
        'APNSMessage': {
          'Action': action,
          'Body': message,
          'Priority': priority,
          'SilentPush': silent,
          'Title': title,
          'TimeToLive': ttl,
          'Url': url
        }
      }
    };
  } else if (service == 'BAIDU') {
    messageRequest = {
      'Addresses': {
        [token]: {
          'ChannelType' : 'BAIDU'
        }
      },
      'MessageConfiguration': {
        'BaiduMessage': {
          'Action': action,
          'Body': message,
          'SilentPush': silent,
          'Title': title,
          'TimeToLive': ttl,
          'Url': url
        }
      }
    };
  } else if (service == 'ADM') {
    messageRequest = {
      'Addresses': {
        [token]: {
          'ChannelType' : 'ADM'
        }
      },
      'MessageConfiguration': {
        'ADMMessage': {
          'Action': action,
          'Body': message,
          'SilentPush': silent,
          'Title': title,
          'Url': url
        }
      }
    };
  }

  return messageRequest;
}

function showOutput(data) {
  let status;
  if (data["MessageResponse"]["Result"][recipient["token"]]["DeliveryStatus"] == "SUCCESSFUL") {
    status = "Message sent! Response information: ";
  } else {
    status = "The message wasn't sent. Response information: ";
  }
  console.log(status);
  console.dir(data, { depth: null });
}

const parameters = {
  // The title that appears at the top of the push notification.
  'title': 'You just received a message',

  // The Amazon Pinpoint project ID that you want to use when you send this
  // message. Make sure that the push channel is enabled for the project that
  // you choose.
  'applicationId': 'ce796be37f32f178af652b26eexample', // TODO: find the correct one

  // The action that should occur when the recipient taps the message. Possible
  // values are OPEN_APP (opens the app or brings it to the foreground),
  // DEEP_LINK (opens the app to a specific page or interface), or URL (opens a
  // specific URL in the device's web browser.)
  'action': 'OPEN_APP',

  // The priority of the push notification. If the value is 'normal', then the
  // delivery of the message is optimized for battery usage on the recipient's
  // device, and could be delayed. If the value is 'high', then the notification is
  // sent immediately, and might wake a sleeping device.
  'priority': 'normal',

  // The amount of time, in seconds, that the push notification service provider
  // (such as FCM or APNS) should attempt to deliver the message before dropping
  // it. Not all providers allow you specify a TTL value.
  'ttl': 30,

  // Boolean that specifies whether the notification is sent as a silent
  // notification (a notification that doesn't display on the recipient's device).
  'silent': false,
}

function sendMessage(parameters) {
  // TODO: Find the correct ones
  parameters['token'] = 'a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5a6b7c8d8e9f0';
  parameters['service'] = 'APNS'

  const messageRequest = createMessageRequest(parameters);

  // Specify that you're using a shared credentials file, and specify the
  // IAM profile to use.
  const credentials = new AWS.SharedIniFileCredentials({ profile: 'default' });
  AWS.config.credentials = credentials;

  // Specify the AWS Region to use.
  AWS.config.update({region: region});

  const pinpoint = new AWS.pinpoint();
  pinpoint.sendMessages()

  // Try to send the message.
  pinpoint.sendMessages({
    "ApplicationId": parameters['applicationId'],
    "MessageRequest": messageRequest
  }, (err, data) => {
    if (err) {
      console.log(err);
    } else {
      ShowOutput(data);
    }
  });
}

exports.handler = event => {
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

  return Promise.resolve('Successfully processed DynamoDB record');
};
