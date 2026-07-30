// ─────────────────────────────────────────────────────────────────────────────
// Jenkinsfile  —  CI/CD pipeline for video-meet
//
// Pipeline stages:
//   1. Checkout          — pull source from GitHub
//   2. Lint & Validate   — fail fast on obvious errors
//   3. Build Client      — npm ci + npm run build (inside Docker build)
//   4. Build Server      — validate Node.js module resolution
//   5. Docker Build      — build both images with ECR tags
//   6. Push to ECR       — authenticate and push both images
//   7. Deploy to EC2     — SSH into EC2, pull images, restart containers
//
// Required Jenkins credentials (configure in Manage Jenkins → Credentials):
//   aws-credentials          — AWS Access Key ID + Secret (type: AWS)
//   ec2-ssh-key              — EC2 private key PEM (type: SSH Username with key)
//   groq-api-key             — GROQ_API_KEY value (type: Secret text)
//
// Required Jenkins plugins:
//   - Pipeline
//   - Docker Pipeline
//   - AWS Credentials
//   - SSH Agent
//   - Git
//   - Timestamper
//   - AnsiColor
// ─────────────────────────────────────────────────────────────────────────────

pipeline {

    agent any

    // ── Global options ────────────────────────────────────────────────────────
    options {
        timestamps()
        ansiColor('xterm')
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()           // prevent race conditions on EC2
    }

    // ── Pipeline-level environment variables ──────────────────────────────────
    environment {
        // ── AWS config — edit these three lines for your account ──────────────
        AWS_REGION      = 'ap-south-1'                  // your ECR region
        AWS_ACCOUNT_ID  = '123456789012'                // your AWS account ID
        EC2_HOST        = '0.0.0.0'                     // your EC2 public IP
        EC2_USER        = 'ubuntu'                      // EC2 login user

        // ── ECR repository names ──────────────────────────────────────────────
        ECR_REGISTRY    = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
        CLIENT_REPO     = "${ECR_REGISTRY}/video-meet-client"
        SERVER_REPO     = "${ECR_REGISTRY}/video-meet-server"

        // ── Image tag: use short git commit SHA for traceability ──────────────
        IMAGE_TAG       = "${env.GIT_COMMIT?.take(7) ?: 'latest'}"

        // ── React build-time URLs (browser-facing, must use EC2 public IP) ────
        REACT_APP_API_BASE    = "http://${EC2_HOST}:5001/api"
        REACT_APP_SOCKET_URL  = "http://${EC2_HOST}:5001"
    }

    stages {

        // ── Stage 1: Checkout ─────────────────────────────────────────────────
        stage('Checkout') {
            steps {
                echo '📥 Checking out source code...'
                checkout scm
                sh 'echo "Branch: ${GIT_BRANCH} | Commit: ${GIT_COMMIT}"'
            }
        }

        // ── Stage 2: Lint & Validate ──────────────────────────────────────────
        stage('Lint & Validate') {
            parallel {

                stage('Validate Client') {
                    steps {
                        dir('client') {
                            echo '🔍 Validating client package.json...'
                            sh 'node -e "JSON.parse(require(\"fs\").readFileSync(\"package.json\",\"utf8\")); console.log(\"client/package.json OK\")"'
                            sh 'cat package.json | grep "react-scripts"'
                        }
                    }
                }

                stage('Validate Server') {
                    steps {
                        dir('server') {
                            echo '🔍 Validating server package.json...'
                            sh 'node -e "JSON.parse(require(\"fs\").readFileSync(\"package.json\",\"utf8\")); console.log(\"server/package.json OK\")"'
                            // Confirm ES module type is declared
                            sh 'cat package.json | grep "\"type\": \"module\""'
                        }
                    }
                }

            }
        }

        // ── Stage 3 & 4: Docker Build (parallel) ─────────────────────────────
        // The actual npm install and npm run build happen INSIDE the Docker
        // multi-stage build, so Jenkins does not need Node.js installed.
        stage('Docker Build') {
            parallel {

                stage('Build Client Image') {
                    steps {
                        dir('client') {
                            echo "🏗️  Building client Docker image: ${CLIENT_REPO}:${IMAGE_TAG}"
                            sh """
                                docker build \\
                                    --build-arg REACT_APP_API_BASE=${REACT_APP_API_BASE} \\
                                    --build-arg REACT_APP_SOCKET_URL=${REACT_APP_SOCKET_URL} \\
                                    --tag ${CLIENT_REPO}:${IMAGE_TAG} \\
                                    --tag ${CLIENT_REPO}:latest \\
                                    --file Dockerfile \\
                                    .
                            """
                            echo "✅ Client image built successfully"
                        }
                    }
                }

                stage('Build Server Image') {
                    steps {
                        dir('server') {
                            echo "🏗️  Building server Docker image: ${SERVER_REPO}:${IMAGE_TAG}"
                            sh """
                                docker build \\
                                    --tag ${SERVER_REPO}:${IMAGE_TAG} \\
                                    --tag ${SERVER_REPO}:latest \\
                                    --file Dockerfile \\
                                    .
                            """
                            echo "✅ Server image built successfully"
                        }
                    }
                }

            }
        }

        // ── Stage 5: Push to AWS ECR ──────────────────────────────────────────
        stage('Push to ECR') {
            steps {
                withAWS(credentials: 'aws-credentials', region: "${AWS_REGION}") {
                    echo '🔐 Authenticating with AWS ECR...'
                    sh """
                        aws ecr get-login-password --region ${AWS_REGION} | \\
                        docker login --username AWS --password-stdin ${ECR_REGISTRY}
                    """

                    echo "📤 Pushing client image..."
                    sh """
                        docker push ${CLIENT_REPO}:${IMAGE_TAG}
                        docker push ${CLIENT_REPO}:latest
                    """

                    echo "📤 Pushing server image..."
                    sh """
                        docker push ${SERVER_REPO}:${IMAGE_TAG}
                        docker push ${SERVER_REPO}:latest
                    """

                    echo '✅ Both images pushed to ECR'
                }
            }
        }

        // ── Stage 6: Deploy to EC2 ────────────────────────────────────────────
        stage('Deploy to EC2') {
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'ec2-ssh-key',
                        keyFileVariable: 'SSH_KEY',
                        usernameVariable: 'SSH_USER'
                    ),
                    string(
                        credentialsId: 'groq-api-key',
                        variable: 'GROQ_API_KEY'
                    )
                ]) {
                    withAWS(credentials: 'aws-credentials', region: "${AWS_REGION}") {
                        echo "🚀 Deploying to EC2: ${EC2_HOST}"

                        // Copy the docker-compose file to EC2
                        sh """
                            scp -i ${SSH_KEY} -o StrictHostKeyChecking=no \\
                                docker-compose.yml \\
                                ${EC2_USER}@${EC2_HOST}:~/video-meet/docker-compose.yml
                        """

                        // SSH into EC2 and perform a rolling update
                        sh """
                            ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} << 'ENDSSH'

                                set -e

                                cd ~/video-meet

                                echo "🔐 Logging in to ECR..."
                                aws ecr get-login-password --region ${AWS_REGION} | \\
                                docker login --username AWS --password-stdin ${ECR_REGISTRY}

                                echo "📥 Pulling latest images..."
                                export AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID}
                                export AWS_REGION=${AWS_REGION}
                                export IMAGE_TAG=${IMAGE_TAG}
                                export GROQ_API_KEY=${GROQ_API_KEY}

                                docker compose pull

                                echo "🔄 Restarting containers..."
                                docker compose up -d --remove-orphans

                                echo "🧹 Removing dangling images..."
                                docker image prune -f

                                echo "✅ Deployment complete!"
                                docker compose ps

ENDSSH
                        """
                    }
                }
            }
        }

    } // end stages

    // ── Post-pipeline actions ─────────────────────────────────────────────────
    post {

        success {
            echo """
            ╔══════════════════════════════════════════════╗
            ║  ✅  PIPELINE SUCCEEDED                      ║
            ║  Image tag : ${IMAGE_TAG}                    ║
            ║  Client    : http://${EC2_HOST}              ║
            ║  Server    : http://${EC2_HOST}:5001/health  ║
            ╚══════════════════════════════════════════════╝
            """
        }

        failure {
            echo '❌ Pipeline FAILED — check the stage logs above.'
        }

        always {
            echo '🧹 Cleaning up local Docker credentials...'
            sh 'docker logout ${ECR_REGISTRY} || true'
        }

    }

} // end pipeline
