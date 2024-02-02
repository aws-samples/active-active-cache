import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

export const snsClient = new SNSClient({});

async function publishMessage() {
    const topicArn = process.env.TOPIC_ARN;

    console.log ("publishMessage topicArn: ", topicArn);

    const command = new PublishCommand({
        Message: "Hello from SNS!",
        TopicArn: topicArn,
        MessageAttributes: {
            "Account": {
                DataType: "String",
                StringValue: "1"
            },
            "Data": {
                DataType: "String",
                StringValue: Date.now().toString()
            }
        }
    });

    const response = await snsClient.send(command);
    console.log ("publishMessage Response: ", response);

    return response;
}

export const send = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        var response;

        for (let i = 0; i < 10; i++) {
            response = await publishMessage();
        }
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: response,
            }),
        };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'some error happened',
            }),
        };
    }
};

