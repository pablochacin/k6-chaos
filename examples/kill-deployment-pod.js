import { check, sleep } from 'k6';
import { Kubernetes } from 'k6/x/kubernetes';
import { DeploymentHelper } from '../src/helpers.js';
import  http from 'k6/http';

const app = "nginx"
const image = "nginx"

export function setup() {
    const k8sClient = new Kubernetes()

    // create a random namespace
    const namespace = "k6-"+Math.random().toString(32).slice(2, 7);
    k8sClient.namespaces.create({name: namespace})

    // create a test deployment
    const helper = new DeploymentHelper(k8sClient, app, namespace, image, 1)
    helper.deploy()

    // wait for deployment's pods to be created
    sleep(3)

    // make service accessible to the test script
    const ip = helper.expose()

    // pass service ip to scenarios
    return {
        srv_ip: ip,
        pods: helper.getPods(),
        namespace: namespace
    }
}

export function disrupt(data) {
    const k8sClient = new Kubernetes()

    // kill por in the deployment
    const target = data.pods[0]
    console.log("Killing pod " + target + " in namespace " + data.namespace)
    k8sClient.pods.delete(target, data.namespace)
}

export default function (data) {
    let res = http.get('http://' + data.srv_ip);
    check(res, {
        'successful request': (r) => r.status === 200,
      });
    sleep(1)
}

export function teardown(data) {
    const k8sClient = new Kubernetes()
    k8sClient.namespaces.delete(data.namespace)
  }

export const options = {
    scenarios: {
        load: {
            executor: 'constant-vus',
            vus: 10,
            exec: "default",
            startTime: '0s',
            duration: "60s",
        },
        delay: {
            executor: 'shared-iterations',
            iterations: 1,
            vus: 1,
            exec: "disrupt",
            startTime: "10s",
        }
    }
}
