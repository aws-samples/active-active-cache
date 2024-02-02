#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SolutionStack } from '../lib/solution-stack';

const app = new cdk.App();
new SolutionStack(app, 'PrimarySolutionStack', {
  env: { region: 'us-west-2' },
  stackName: 'Primary'
});

new SolutionStack(app, 'SecondarySolutionStack', {
  env: { region: 'us-east-2' },
  stackName: 'Secondary'
})