
# Enterprise Deployment Guide: Yalla Label

This guide details the secure deployment of the **Yalla Label** application to Google Cloud Run using a production-ready container pipeline.

## 1. Preparation

Rename the provided templates:
1.  **`Dockerfile.txt`** -> `Dockerfile`
2.  **`nginx.txt`** -> `nginx.conf`
3.  **`dockerignore.txt`** -> `.dockerignore`

## 2. Prerequisites

*   **Google Cloud Project** with Billing Enabled.
*   **Google Cloud SDK** (`gcloud`) installed.
*   **Gemini API Key**: Obtain a key from AI Studio or Vertex AI.

## 3. Infrastructure Setup

Enable APIs:
```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  logging.googleapis.com
```

Create Artifact Registry:
```bash
gcloud artifacts repositories create app-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="Enterprise App Repo"
```

## 4. Build & Publish (With API Key Injection)

We use Cloud Build to build the Docker image. You **must** inject the Gemini API key during the build process so it is baked into the frontend bundle.

**Option A: Command Line Substitution**
Replace `[YOUR_GEMINI_API_KEY]` with your actual key.

```bash
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/[PROJECT_ID]/app-repo/yalla-label:v1.0 \
  --substitutions=_API_KEY=[YOUR_GEMINI_API_KEY]
```

**Option B: Using cloudbuild.yaml (Recommended)**
Create a `cloudbuild.yaml` file:

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: [
      'build', 
      '--build-arg', 'API_KEY=${_API_KEY}', 
      '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/app-repo/yalla-label:v1.0', 
      '.'
    ]
images:
  - 'us-central1-docker.pkg.dev/$PROJECT_ID/app-repo/yalla-label:v1.0'
```

Then run:
```bash
gcloud builds submit --config cloudbuild.yaml --substitutions=_API_KEY=[YOUR_KEY]
```

## 5. Deploy to Cloud Run

Deploy the service with strict security configurations.

```bash
gcloud run deploy yalla-label \
  --image us-central1-docker.pkg.dev/[PROJECT_ID]/app-repo/yalla-label:v1.0 \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10
```

## 6. Access Control

End users must have permissions on the GCP projects they intend to manage (e.g., `roles/compute.viewer`, `roles/compute.admin`). The app authenticates purely on the client-side using the User's OAuth token provided in the UI.
