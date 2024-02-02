import { APIGatewayProxyEvent, APIGatewayProxyResult, SQSEvent } from 'aws-lambda';

import { createClient } from 'redis';

import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const redisURL = process.env.REDIS_URL;

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

async function publishMetric(delta: number) {
    const client = new CloudWatchClient();

    const command = new PutMetricDataCommand({
        MetricData: [{
            MetricName: 'Cacher/Delay',
            Dimensions: [
                {
                    Name: 'Delay',
                    Value: 'Delay'
                },
            ],
            Value: delta,
            Unit: 'Milliseconds'
        }],
        Namespace: 'Cacher',
    });

    const response = await client.send(command);

    console.log ("publishMetric response: ", response);
}

async function publishMessage(account: string, data: number) {
    console.log ("publishMessage account: ", account, " data: ", data);

    const client = await createClient({
        url: redisURL
    })
      .on('error', (err: any) => console.log('Redis Client Error', err))
    .connect();

    await client.set(account, data);
    await client.disconnect();

    const now = Date.now();
    const delta = now - data;
    console.log ("publishMessage now: ", now, " delta: ", delta);

    await publishMetric(delta);

    return "account " + account + " set with value " + data;
}

export const apiHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const response = await publishMessage("0", Date.now());

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

export const queueHandler = async (event: SQSEvent): Promise<void> => {
    console.log ("queueHandler Redis URL: ", redisURL);


    try {
        for (const message of event.Records) {
            const body = JSON.parse(message.body);

            const attributes = body.MessageAttributes;

            console.log ("queueHandler attributes: ", attributes);
            console.log ("queueHandler attributes type: ", typeof attributes);

            await publishMessage(attributes.Account.Value, attributes.Data.Value);
        }
    } catch (err) {
        console.log(err);
    }
};
