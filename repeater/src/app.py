import json
import time
import urllib.request
import json
import os

def lambda_handler(event, context):

    path = os.environ['AUTH_URL']
    print ("path: ", path)
    req = urllib.request.Request(
        url=path + '/send/',
        headers={'Accept': 'application/json'},
        method='GET')
    
# Run for 4 minutes
    for iter in range(1, 5*60):
        res = urllib.request.urlopen(req, timeout=5)
        print("#", iter, "Status: ", res.status)
        response = json.loads(res.read())
        print("Response: ", response)
        time.sleep(1)
    