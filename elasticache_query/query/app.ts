import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { createClient } from 'redis';

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

async function queryRedis() {
    console.log ("queryRedis connecting to ", redisURL);
    
    const client = await createClient({
        url: redisURL
    })
      .on('error', (err: any) => console.log('Redis Client Error', err))
    .connect();

    const result = []
    for await (const key of client.scanIterator()) {
        const value = await client.get(key);
        console.log ("queryRedis key: ", key, " value: ", value);
        result.push ({
            key: key,
            value: value
        });
    }
    return result;

}

export const apiHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const response = await queryRedis();

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
