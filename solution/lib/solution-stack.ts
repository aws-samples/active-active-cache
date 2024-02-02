import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Port, Peer, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Queue, IQueue } from 'aws-cdk-lib/aws-sqs';
import { aws_elasticache as ElastiCache } from 'aws-cdk-lib';
import { SqsSubscription, EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Alarm } from 'aws-cdk-lib/aws-cloudwatch';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { SSMParameterReader } from './ssm-parameter-reader';
import { Dashboard, GraphWidget, Metric, Dimension } from 'aws-cdk-lib/aws-cloudwatch';

export class SolutionStack extends Stack {
  private vpc: Vpc;
  private topic: Topic;
  private sqs: Queue;
  private securityGroup: SecurityGroup;

  private createVpc() {
    this.vpc = new Vpc (this, 'cache');
  }

  private createSns(topicName: string) {
    return new Topic(this, topicName)
  }

  private createDLQ() {
    return new Queue (this, 'DLQ');
  }

  private createSqs(dlq: Queue) {
    this.sqs = new Queue (this, 'Queue', {
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 1
      }
    });
  }

  private subscribeSqsToSns(queue: IQueue, dlq: Queue) {
    this.topic.addSubscription(new SqsSubscription(queue, {
      deadLetterQueue: dlq
    }));
  }

  private createElastiCache(stackName: string) {
    const groupName = stackName + "ElastiCacheSubnetGroup";
    const securityGroupName = stackName + "ElastiCacheSecurityGroup";

    const subnetIds = [];
    for (const subnet of this.vpc.privateSubnets) {
      console.log ("createElastiCache subnet ID: ", subnet.subnetId);
      subnetIds.push(subnet.subnetId);
    }

    const subnetGroup = new ElastiCache.CfnSubnetGroup(this, "ElastiCacheSubnetGroup", {
      cacheSubnetGroupName: groupName,
      subnetIds: subnetIds,
      description: "ElastiCache Subnet Group"
    })

    this.securityGroup = new SecurityGroup(this, securityGroupName, {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: "ElastiCache Security Group",
      securityGroupName: securityGroupName
    });

    this.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(6379), "Redis port");

    console.log ("createElasticCache securityGroup: ", this.securityGroup);

    new ElastiCache.CfnReplicationGroup(this, "ReplicationGroup", {
      replicationGroupDescription: "Elastic Cache Replication Group",
      numCacheClusters: 1,
      automaticFailoverEnabled: false,
      engine: 'redis',
      cacheNodeType: 'cache.m7g.large',
      cacheSubnetGroupName: subnetGroup.ref,
      securityGroupIds:[this.securityGroup.securityGroupId],
    });

  }

  private exportPrivateSubnet(name: string) {
    const subnetOutput = new CfnOutput(this, name, {
      value: this.vpc.privateSubnets[0].subnetId,
      exportName: name
    });
  }

  private defineOutput() {
    this.exportPrivateSubnet('CardAuthPrivateSubnet1');

    const securityGroupOutput = new CfnOutput(this, 'SecurityGroupId', {
      exportName: 'SecurityGroupId',
      value: this.securityGroup.securityGroupId
    });

    new CfnOutput(this, 'QueueARN', {
      exportName: 'QueueARN',
      value: this.sqs.queueArn
    });

    new CfnOutput(this, 'QueueURL', {
      exportName: 'QueueURL',
      value: this.sqs.queueUrl
    });

  }

  private createDLQAlarm (dlq: Queue) {
      const alarm = new Alarm(this, 'DLQAlarm', {
        metric: dlq.metricApproximateNumberOfMessagesVisible(),
        threshold: 1,
        evaluationPeriods: 1,
      })
  }

  private defineParameters(stackName: String) {
    new StringParameter(this, 'SQSParameter', {
      parameterName: stackName + 'SQS',
      description: 'The SQS ARN',
      stringValue: this.sqs.queueArn
    });
  }

  private retrieveSecondarySqsArn() {
    const reader = new SSMParameterReader(this, 'SecondarySQS', {
      parameterName: 'SecondarySQS',
      region: 'us-east-2'
    })
    const arn = reader.getParameterValue();
    console.log ("retrieveSecondarySqsArn arn: ", arn);
    return arn;
  }

  private defineSNSParameter() {
    new StringParameter(this, 'SNSParameter', {
      parameterName: 'SNS',
      description: 'The SNS ARN',
      stringValue: this.topic.topicArn
    });
  }

  private retrieveSNSArn() {
    const reader = new SSMParameterReader(this, 'SNS', {
      parameterName: 'SNS',
      region: 'us-west-2'
    })
    const arn = reader.getParameterValue();
    console.log ("retrieveSNSArn arn: ", arn);
    return arn;
  }

  private addMetric(region: string, statistic: string) {
    return new Metric({
      region: region,
      namespace: "Cacher",
      metricName: "Cacher/Delay",
      statistic: statistic,
      dimensionsMap: {
        "Delay": "Delay"
      }
    })
  }

  private createDashboard() {
    const dashboard = new Dashboard(this, 'Dash', {
      defaultInterval: Duration.hours(1),
    });

    dashboard.addWidgets(new GraphWidget({
      title: "Cache Delay",
      left: [
        this.addMetric("us-east-2", "Average"),
        this.addMetric("us-west-2", "Average"),
        this.addMetric("us-east-2", "p99"),
        this.addMetric("us-west-2", "p99")
      ]
    }));
  };



constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    var stackName = 'Unknown';
    if (props && props.stackName) {
      stackName = props.stackName;
    }
    console.log ("Stack name: ", stackName);

    this.createVpc();
    const dlq = this.createDLQ();
    this.createDLQAlarm(dlq);
    this.createSqs(dlq);
    
    const snsArn = this.retrieveSNSArn();
    console.log ("snsArn: ", snsArn);
    
    console.log ("createVpc stackName: ", stackName);
    if (stackName == 'Primary') {
      this.topic = this.createSns('Message');
      this.subscribeSqsToSns(this.sqs, dlq);
      const secondarySqsArn = this.retrieveSecondarySqsArn();

      const secondaryQueue = Queue.fromQueueArn(this, 'SecondaryQueue', secondarySqsArn);
      this.subscribeSqsToSns(secondaryQueue, dlq);
      this.defineSNSParameter();
      this.createDashboard();

      new CfnOutput(this, 'TopicARN', {
        exportName: 'TopicARN',
        value: this.topic.topicArn
      })
  

    } else {
      console.log ("Skipping SNS creation");
    }

    this.createElastiCache(stackName);
    this.defineOutput();
    this.defineParameters(stackName);
  }
}
