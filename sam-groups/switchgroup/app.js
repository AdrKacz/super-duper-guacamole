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
    // TODO: throw an error if userid is undefined
    const userid = body.userid;
    
    // connectionId
    const connectionId = event.requestContext.connectionId;
    
    // get old group
    let groupid;
    try {
        console.log(`Try get user users:id:${userid}`);
        const user = await ddb.get({
        TableName: USERS_TABLE_NAME,
        Key: {id : userid},
        AttributesToGet: ['id', 'group'],
    }).promise(); 
    console.log(`\tUser:\n${JSON.stringify(user)}`);
    // verify userid exists
    if (!user.Item) {
        throw `Error: user ${userid} not found.`;
    } else {
        groupid = user.Item.group;
    }
    } catch (e) {
        throw e;
    }
    
    // remove old group
    if (groupid) {
        // update group
        try {
            console.log(`Try update group ${groupid} - DELETE groups:users:${userid}`);
            await ddb.update({
            TableName: GROUPS_TABLE_NAME,
            Key: {id : groupid},
            AttributeUpdates:{
                users: {
                    Action: "DELETE",
                    Value: ddb.createSet([userid]),
                }
            }
        }).promise(); 
        } catch (e) {
            throw e;
        }
    }
    
    // new groupid
    groupid = Math.floor(Math.random() * 10).toString();
    
    // TODO: revert users and groups on error
    // update group
    try {
        console.log(`Try update group ${groupid} - ADD groups:users:${userid}`);
        await ddb.update({
        TableName: GROUPS_TABLE_NAME,
        Key: {id : groupid},
        AttributeUpdates:{
            users: {
                Action: "ADD",
                Value: ddb.createSet([userid]),
            }
        }
    }).promise(); 
    } catch (e) {
        throw e;
    }
    
    // update user
    try {
        console.log(`Try update user ${userid} - PUT users:group:${groupid}`);
        await ddb.update({
        TableName: USERS_TABLE_NAME,
        Key: {id : userid},
        AttributeUpdates:{
            group: {
                Action: "PUT",
                Value: groupid,
            }
        }
    }).promise(); 
    } catch (e) {
        throw e;
    }
    
    // returns
    const apigwManagementApi = new AWS.ApiGatewayManagementApi({
        endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
     });
    
    try {
        console.log(`Try connection ${connectionId}`);
        await apigwManagementApi.postToConnection({ConnectionId: connectionId, Data: JSON.stringify({groupid: groupid})}).promise();
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
        body: JSON.stringify('Switch group!'),
    };
    
    console.log(`Returns:\n${JSON.stringify(response)}`);
    return response;
};
