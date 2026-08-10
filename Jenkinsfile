pipeline {
    agent any

    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
    }

    environment {
        AWS_REGION      = "ap-south-1"
        AWS_ACCOUNT_ID  = "030729259628"

        CLIENT_REPO = "video-translate-client"
        SERVER_REPO = "video-translate-server"

        CLIENT_IMAGE = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${CLIENT_REPO}:latest"
        SERVER_IMAGE = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${SERVER_REPO}:latest"

        ECS_CLUSTER = "video-translate-cluster"
        ECS_SERVICE = "video-translate-task-service-f8uorjs2"

        // ── ECS backend URL — browser-facing, baked into the React bundle ──
        // Update ECS_SERVER_HOST to your ALB DNS name or ECS server public IP
        // once it is stable. For a changing Fargate IP, use an ALB or a fixed
        // domain and set it here. Do NOT use localhost here.
        ECS_SERVER_HOST = "REPLACE_WITH_YOUR_ECS_SERVER_URL"   // e.g. http://my-alb-1234.ap-south-1.elb.amazonaws.com
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Client Image') {
            steps {
                dir('client') {
                    sh """
                    docker build \
                      --build-arg REACT_APP_API_BASE=${ECS_SERVER_HOST}/api \
                      --build-arg REACT_APP_SOCKET_URL=${ECS_SERVER_HOST} \
                      -t ${CLIENT_IMAGE} .
                    """
                }
            }
        }

        stage('Build Server Image') {
            steps {
                dir('server') {
                    sh """
                    docker build -t ${SERVER_IMAGE} .
                    """
                }
            }
        }

        stage('Login to Amazon ECR') {
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'aws-creds'
                ]]) {

                    sh """
                    aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
                    """
                }
            }
        }

        stage('Push Client Image') {
            steps {
                sh "docker push ${CLIENT_IMAGE}"
            }
        }

        stage('Push Server Image') {
            steps {
                sh "docker push ${SERVER_IMAGE}"
            }
        }

        stage('Force ECS Deployment') {
            steps {

                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'aws-creds'
                ]]) {

                    sh """
                    aws ecs update-service \
                    --cluster ${ECS_CLUSTER} \
                    --service ${ECS_SERVICE} \
                    --force-new-deployment \
                    --region ${AWS_REGION}
                    """
                }

            }
        }

    }

    post {

        success {
            echo "Deployment completed successfully."
        }

        failure {
            echo "Deployment failed."
        }

    }
}