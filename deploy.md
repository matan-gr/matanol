
# Enterprise Deployment Guide: Yalla Label

This guide details the secure deployment of the **Yalla Label** application to Google Cloud Run using a production-ready container pipeline.

## 1. Preparation

Rename the provided templates locally before deploying:
1.  **`Dockerfile.txt`** -> `Dockerfile`
2.  **`nginx.txt`** -> `nginx.conf`
3.  **`dockerignore.txt`** -> `.dockerignore`

## 2. Prerequisites

*   **Google Cloud Project** with Billing Enabled.
*   **Google Cloud SDK** (`gcloud`) installed.
*   **Gemini API Key**: Obtain a key from AI Studio or Vertex AI.

## 3. Infrastructure Setup

Enable the required APIs:
```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  logging.googleapis.com
```

Create an Artifact Registry repository:
```bash
gcloud artifacts repositories create app-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="Enterprise App Repo"
```

## 4. Build & Publish (Secure API Key Injection)

We use Google Cloud Build to create the Docker image. Because this is a Single Page Application (SPA), the Gemini API key must be "baked" into the JavaScript bundle at build time.

### Step 4a: Create `cloudbuild.yaml`

Create a file named `cloudbuild.yaml` in the root directory:

```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        docker build \
          --build-arg API_KEY=$_GEMINI_API_KEY \
          -t us-central1-docker.pkg.dev/$PROJECT_ID/app-repo/yalla-label:latest \
          .

  # Push the container image to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/app-repo/yalla-label:latest']

  # Deploy container image to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'yalla-label'
      - '--image'
      - 'us-central1-docker.pkg.dev/$PROJECT_ID/app-repo/yalla-label:latest'
      - '--region'
      - 'us-central1'
      - '--allow-unauthenticated'
      - '--memory'
      - '512Mi'

images:
  - 'us-central1-docker.pkg.dev/$PROJECT_ID/app-repo/yalla-label:latest'
```

### Step 4b: Run the Build

Submit the build to Cloud Build, substituting the `_GEMINI_API_KEY` variable with your actual key.

```bash
gcloud builds submit --config cloudbuild.yaml --substitutions=_GEMINI_API_KEY="YOUR_ACTUAL_API_KEY_HERE"
```

*Note: For production pipelines, it is recommended to store the API Key in Secret Manager and access it within Cloud Build.*

## 5. Security Post-Deployment

Since the API Key is embedded in the client-side code:

1.  Go to the **Google AI Studio** or **Google Cloud Console** credentials page.
2.  Locate the API Key used above.
3.  **Add an HTTP Referrer Restriction** to limit usage of this key **only** to your Cloud Run URL (e.g., `https://yalla-label-xyz-uc.a.run.app/*`).
4.  This prevents unauthorized use if the key is scraped from the browser.

## 6. Access Control

End users must have permissions on the GCP projects they intend to manage (e.g., `roles/compute.viewer`, `roles/compute.admin`). The app authenticates purely on the client-side using the User's OAuth token provided in the Login UI.
