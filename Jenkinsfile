pipeline {
    agent any

    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
    }

    environment {
        AWS_REGION = "ap-south-1"
        AWS_ACCOUNT_ID = "030729259628"

        CLIENT_REPO = "video-translate-client"
        SERVER_REPO = "video-translate-server"

        CLIENT_IMAGE = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${CLIENT_REPO}:latest"
        SERVER_IMAGE = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${SERVER_REPO}:latest"

        ECS_CLUSTER = "video-translate-cluster"
        ECS_SERVICE = "video-translate-task-service"
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
                    docker build -t ${CLIENT_IMAGE} .
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