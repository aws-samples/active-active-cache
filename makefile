all:
	echo Specify which command

add_to_resource_policy_primary: set_region_primary find_primary_queue_info get_topic_arn
	echo Topic: $(TOPIC_ARN)
	echo Queue: $(PRIMARY_QUEUE_ARN)
	sed -e 's/QUEUE_ARN/$(PRIMARY_QUEUE_ARN)/;s/TOPIC_ARN/$(TOPIC_ARN)/'  < set-queue-attributes.template.json > set-queue-attributes-primary.json
	aws sqs set-queue-attributes --queue-url $(PRIMARY_QUEUE_URL) --attributes file://set-queue-attributes-primary.json

add_to_resource_policy_secondary: get_topic_arn find_secondary_queue_info set_region_secondary 
	echo Queue: $(SECONDARY_QUEUE_ARN)
	sed -e 's/QUEUE_ARN/$(PRIMARY_QUEUE_ARN)/;s/TOPIC_ARN/$(TOPIC_ARN)/'  < set-queue-attributes.template.json > set-queue-attributes-secondary.json
	aws sqs set-queue-attributes --queue-url $(SECONDARY_QUEUE_URL) --attributes file://set-queue-attributes-secondary.json

add_to_resource_policy: add_to_resource_policy_primary add_to_resource_policy_secondary

arch:
	cd architecture; java -jar plantuml-1.2023.11.jar Architecture.puml

bootstrap:
	cd solution; cdk bootstrap

build:
	cd solution; npm run build

cacher_build: 
	cd cacher; sam build

cacher_delete: 
	cd cacher; sam delete --no-prompts

cacher_delete_secondary:
	cd cacher; sam delete --no-prompts --region us-east-2

cacher_deploy: cacher_deploy_secondary cacher_deploy_primary 

cacher_deploy_primary: set_region_primary find_primary_redis_url cacher_build
	cd cacher; sam deploy --parameter-overrides RedisURL=$(PRIMARY_REDIS_ADDRESS) --region us-west-2

cacher_deploy_secondary: set_region_secondary find_secondary_redis_url cacher_build
	cd cacher; sam deploy --parameter-overrides RedisURL=$(SECONDARY_REDIS_ADDRESS) --region us-east-2

GET_CACHER_ID=$(shell aws apigateway get-rest-apis --output json | jq '.items[] | select (.name == "cacher").id')
SET_CACHER_ID = $(eval CACHER_ID=$(GET_CACHER_ID))

cacher_save: get_region
	$(SET_CACHER_ID)
	echo Cacher ID: $(CACHER_ID)
	curl https://$(CACHER_ID).execute-api.$(REGION).amazonaws.com/Prod/save

delete:
	aws cloudformation delete-stack --stack-name SolutionStack

deploy: solution_deploy add_to_resource_policy loader_deploy cacher_deploy query_deploy repeater_deploy

destroy: cacher_delete query_delete loader_delete
	cd solution; cdk destroy --require-approval never


GET_QUERY_URL = $(shell aws cloudformation describe-stacks --stack-name ecquery --output json | jq .Stacks[0].Outputs[0].OutputValue)
SET_QUERY_URL = $(eval QUERY_URL=$(GET_QUERY_URL))

find_query_url: set_region_primary
	$(SET_QUERY_URL)
	@echo Query URL: $(QUERY_URL)

GET_PRIMARY_QUEUE_ARN = $(shell aws cloudformation describe-stacks --stack-name Primary --output json | jq -r '.Stacks[0].Outputs[] | select (.OutputKey == "QueueARN").OutputValue')
SET_PRIMARY_QUEUE_ARN = $(eval PRIMARY_QUEUE_ARN=$(GET_PRIMARY_QUEUE_ARN))
GET_PRIMARY_QUEUE_URL = $(shell aws cloudformation describe-stacks --stack-name Primary --output json | jq -r '.Stacks[0].Outputs[] | select (.OutputKey == "QueueURL").OutputValue')
SET_PRIMARY_QUEUE_URL = $(eval PRIMARY_QUEUE_URL=$(GET_PRIMARY_QUEUE_URL))

find_primary_queue_info: set_region_primary
	$(SET_PRIMARY_QUEUE_ARN)
	echo Queue ARN: $(PRIMARY_QUEUE_ARN)
	$(SET_PRIMARY_QUEUE_URL)
	echo Queue URL: $(PRIMARY_QUEUE_URL)
	$(SET_TOPIC_ARN)
	echo Topic ARN: $(TOPIC_ARN)

GET_SECONDARY_QUEUE_ARN = $(shell aws cloudformation describe-stacks --stack-name Secondary --output json | jq '.Stacks[0].Outputs[] | select (.OutputKey == "QueueARN").OutputValue')
SET_SECONDARY_QUEUE_ARN = $(eval SECONDARY_QUEUE_ARN=$(GET_SECONDARY_QUEUE_ARN))
GET_SECONDARY_QUEUE_URL = $(shell aws cloudformation describe-stacks --stack-name Secondary --output json | jq '.Stacks[0].Outputs[] | select (.OutputKey == "QueueURL").OutputValue')
SET_SECONDARY_QUEUE_URL = $(eval SECONDARY_QUEUE_URL=$(GET_SECONDARY_QUEUE_URL))

find_secondary_queue_info: set_region_secondary
	$(SET_SECONDARY_QUEUE_ARN)
	@echo Queue ARN: $(SECONDARY_QUEUE_ARN)
	$(SET_SECONDARY_QUEUE_URL)
	@echo Queue URL: $(SECONDARY_QUEUE_URL)

GET_REDIS_ADDRESS = $(shell aws elasticache describe-cache-clusters \
	  --show-cache-node-info --output json | jq .CacheClusters[0].CacheNodes[0].Endpoint.Address)
SET_PRIMARY_REDIS_ADDRESS = $(eval PRIMARY_REDIS_ADDRESS=redis://$(GET_REDIS_ADDRESS):6379)
SET_SECONDARY_REDIS_ADDRESS = $(eval SECONDARY_REDIS_ADDRESS=redis://$(GET_REDIS_ADDRESS):6379)

find_primary_redis_url: set_region_primary
	  $(SET_PRIMARY_REDIS_ADDRESS)
	  echo Redis: $(PRIMARY_REDIS_ADDRESS)

find_secondary_redis_url: set_region_secondary
	  $(SET_SECONDARY_REDIS_ADDRESS)
	  echo Redis: $(SECONDARY_REDIS_ADDRESS)


GET_LOADER_ID=$(shell aws apigateway get-rest-apis --output json | jq '.items[] | select (.name == "loader").id')
SET_LOADER_URL = $(eval LOADER_URL=https://$(GET_LOADER_ID).execute-api.$(REGION).amazonaws.com/Prod/)

get_loader_url: set_region_primary get_region
	$(SET_LOADER_URL)
	echo Loader ID: $(LOADER_URL)

GET_REPEATER_ID=$(shell aws apigateway get-rest-apis --output json | jq '.items[] | select (.name == "repeater").id')
SET_REPEATER_URL = $(eval REPEATER_URL=https://$(GET_REPEATER_ID).execute-api.$(REGION).amazonaws.com/Prod/)

get_repeater_url: set_region_primary get_region
	$(SET_REPEATER_URL)
	echo Loader ID: $(REPEATER_URL)

GET_REGION=$(shell aws configure list | grep region | awk '{print $$2}')
SET_REGION=$(eval REGION=$(GET_REGION))

get_region:
	$(SET_REGION)
	echo Region: $(REGION)

GET_TOPIC_ARN = $(shell aws cloudformation describe-stacks --stack-name Primary --output json | jq -r '.Stacks[0].Outputs[] | select (.OutputKey == "TopicARN").OutputValue')
SET_TOPIC_ARN = $(eval TOPIC_ARN=$(GET_TOPIC_ARN))

get_topic_arn: set_region_primary
	$(SET_TOPIC_ARN)
	echo Topic ARN: $(TOPIC_ARN)

init:
	cd solution; cdk init app --language=typescript

loader_build: 
	cd loader; sam build

loader_delete:
	cd loader; sam delete --no-prompts

loader_deploy: set_region_primary loader_build get_topic_arn
	cd loader; sam deploy --parameter-overrides TopicARN=$(TOPIC_ARN)

load_test: get_loader_url
	ab -n 1000 $(LOADER_URL)

query_build:
	cd elasticache_query; sam build

query_delete:
	cd elasticache_query; sam delete --no-prompts

query_deploy: query_build find_primary_redis_url
	cd elasticache_query; sam deploy --parameter-overrides RedisURL=$(PRIMARY_REDIS_ADDRESS)

repeat_load: get_repeater_url
	curl $(REPEATER_URL)/repeat

repeater_build: 
	cd repeater; sam build

repeater_delete:
	cd repeater; sam delete --no-prompts

repeater_deploy: set_region_primary repeater_build get_loader_url
	cd repeater; sam deploy --parameter-overrides LoaderURL=$(LOADER_URL)

run_query: set_region_primary find_query_url
	curl $(QUERY_URL)

send_load: get_loader_url
	curl $(LOADER_URL)/send

set_region_primary:
	aws configure set default.region us-west-2
	
set_region_secondary:
	aws configure set default.region us-east-2
	
solution_deploy: solution_deploy_secondary solution_deploy_primary

solution_deploy_primary: bootstrap synth
	cd solution; cdk deploy --require-approval never PrimarySolutionStack

solution_deploy_secondary: bootstrap synth
	cd solution; cdk deploy --require-approval never SecondarySolutionStack

solution_deploy_secondary_destroy:
	cd solution; cdk destroy --require-approval never SecondarySolutionStack

synth:
	cd solution; cdk synth

pack:
	rm -f architecture/plantuml-1.2023.11.jar
	rm -rf node_modules/
	rm -rf */.aws-sam/
	rm active-active-cache.zip
	zip -r active-active-cache.zip *

