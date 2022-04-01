// Lambda use AWS SDK v2 by default

const AWS = require('aws-sdk');

const ddb = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const { USERS_TABLE_NAME, GROUPS_TABLE_NAME } = process.env;

exports.handler = async (event) => {
    console.log(`Receives:\n\tBody:\n${event.body}\n\tRequest Context:\n${JSON.stringify(event.requestContext)}\n\tEnvironment:\n${JSON.stringify(process.env)}`);
    
    // body to object
    const body = JSON.parse(event.body);
    
    // userid
    // NOTE: use connectionIs as a second index to not have to send userid
    // TODO: verify userid with connectionId
    // TODO: throw an error if userid is undefined
    const userid = body.userid;
    
    // groupid
    // TODO: throw an error if groupid is undefined
    const groupid = body.groupid;
    
    // data
    // TODO: throw an error if data is undefined
    const data = body.data;
    
    // connectionId
    const connectionId = event.requestContext.connectionId;
    
    // get users
    let users;
    try {
        console.log(`Try get users groups:id:${groupid}`);
        const group = await ddb.get({
        TableName: GROUPS_TABLE_NAME,
        Key: {id : groupid},
        AttributesToGet: ['id', 'users'],
    }).promise(); 
    console.log(`\tgroup:\n${JSON.stringify(group)}`);
    // verify groupid exists
    if (!group.Item) {
        throw `Error: group ${groupid} not found.`;
    } else {
        users = group.Item.users.values;
    }
    } catch (e) {
        throw e;
    }
    
    // TODO: verify userid is in group
    // connectionIds
    let connectionIds;
    try {
        console.log(`Try get users:connectionIds ids:${JSON.stringify(users)}`);
        const groupusers = await ddb.batchGet({
            RequestItems: {
            [USERS_TABLE_NAME]: {
              Keys: users.map(u => ({id: u})),  
              AttributesToGet: ['id', 'connectionId'],
            },
        }}).promise();
        connectionIds = groupusers.Responses[USERS_TABLE_NAME];
    } catch (e) {
        throw e;
    }
    console.log(`\tConnection ids:\n${JSON.stringify(connectionIds)}`);
    
    // broadcast
    const apigwManagementApi = new AWS.ApiGatewayManagementApi({
        endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
     });
    
    try {
        console.log(`Try connection ${connectionId}`);
        await apigwManagementApi.postToConnection({ConnectionId: connectionId, Data: JSON.stringify({data: data})}).promise();
    } catch (e) {
        if (e.statusCode === 410) {
            console.log(`Found stale connection, deleting ${connectionId}`);
        } else {
            throw e;
        }
    }
    
    // debug
    const response = {
        statusCode: 200,
        body: JSON.stringify('Send message!'),
    };
    
    console.log(`Returns:\n${JSON.stringify(response)}`);
    return response;
};
