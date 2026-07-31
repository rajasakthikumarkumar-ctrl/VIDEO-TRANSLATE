pipeline {
    agent any

    options {
        timestamps()
        ansiColor('xterm')
        timeout(time: 30, unit: 'MINUTES')
    }

    environment {
        CLIENT_IMAGE = "video-translate-client:latest"
        SERVER_IMAGE = "video-translate-server:latest"
    }

    stages {

        stage('Checkout') {
            steps {
                echo "Checking out source code..."
                checkout scm
            }
        }

        stage('Validate Client') {
            steps {
                dir('client') {
                    echo "Validating client package.json..."
                    sh '''
                        node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('Client package.json OK')"
                    '''
                }
            }
        }

        stage('Validate Server') {
            steps {
                dir('server') {
                    echo "Validating server package.json..."
                    sh '''
                        node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('Server package.json OK')"
                    '''
                }
            }
        }

        stage('Build Client Docker Image') {
            steps {
                dir('client') {
                    sh '''
                        docker build -t ${CLIENT_IMAGE} .
                    '''
                }
            }
        }

        stage('Build Server Docker Image') {
            steps {
                dir('server') {
                    sh '''
                        docker build -t ${SERVER_IMAGE} .
                    '''
                }
            }
        }

        stage('Docker Images') {
            steps {
                sh '''
                    docker images | grep video-translate || true
                '''
            }
        }

    }

    post {
        success {
            echo "Pipeline completed successfully."
        }

        failure {
            echo "Pipeline failed."
        }
    }
}