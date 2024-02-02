import { Construct } from 'constructs';
import { AwsCustomResource, AwsCustomResourcePolicy, AwsSdkCall, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { Arn, Stack } from 'aws-cdk-lib';

interface SSMParameterReaderProps {
  parameterName: string;
  region: string;
}

export class SSMParameterReader extends AwsCustomResource {
  constructor(scope: Construct, name: string, props: SSMParameterReaderProps) {
    const { parameterName, region } = props;

    const ssmAwsSdkCall: AwsSdkCall = {
      service: 'SSM',
      action: 'getParameter',
      parameters: {
        Name: parameterName
      },
      region,
      physicalResourceId: PhysicalResourceId.of(Date.now().toString())
    };

    const ssmCrPolicy = AwsCustomResourcePolicy.fromSdkCalls({
        resources: [
          Arn.format(
            {
              service: 'ssm',
              region: props.region,
              resource: 'parameter',
              resourceName: parameterName,
            },
            Stack.of(scope),
          ),
        ],
      });

    super(scope, name, { onUpdate: ssmAwsSdkCall, policy: ssmCrPolicy });
  }

  public getParameterValue(): string {
    return this.getResponseField('Parameter.Value').toString();
  }
}