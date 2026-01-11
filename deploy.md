
# Enterprise Deployment Guide: Matan-O-Labeler

This guide details the secure deployment of the Matan-O-Labeler application to Google Cloud Run using a production-ready container pipeline.

## 1. Preparation

Before running the build commands, ensure your file structure follows standard conventions by renaming the provided templates:

1.  **Rename `Dockerfile.txt`** to `Dockerfile`.
2.  **Rename `nginx.txt`** to `nginx.conf`.
3.  **Rename `dockerignore.txt`** to `.dockerignore`.

## 2. Prerequisites

*   **Google Cloud Project** with Billing Enabled.
*   **Google Cloud SDK** (`gcloud`) installed.
*   **Permissions**: `roles/run.admin`, `roles/storage.admin` (for building), and `roles/iam.serviceAccountUser`.

## 3. Infrastructure Setup

### Enable Required APIs
```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  logging.googleapis.com
```

### Create Artifact Registry
Create a Docker repository to store your secure images.
```bash
gcloud artifacts repositories create matan-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="Enterprise Resource Governance Images"
```

## 4. Build & Publish Container

We use Cloud Build to build the Docker image remotely. This ensures a clean environment and avoids local dependency issues.

```bash
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/[PROJECT_ID]/matan-repo/matan-o-labeler:v1.0
```

## 5. Deploy to Cloud Run

Deploy the service with strict security configurations.

### Create Service Account
Create a dedicated service account for the application identity (Least Privilege Principle).

```bash
gcloud iam service-accounts create matan-identity \
    --display-name="Matan-O-Labeler Runtime Identity"
```

**Note:** Since this is a client-side React app, the actual API calls to GCP happen in the user's browser using the token they provide. The service account here is primarily for the container runtime itself.

### Deploy Command
```bash
gcloud run deploy matan-o-labeler \
  --image us-central1-docker.pkg.dev/[PROJECT_ID]/matan-repo/matan-o-labeler:v1.0 \
  --region us-central1 \
  --service-account matan-identity@[PROJECT_ID].iam.gserviceaccount.com \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10
```

*   `--allow-unauthenticated`: Required if you want the public internet to access the UI. If this is an internal tool, remove this flag and use Identity-Aware Proxy (IAP) for zero-trust access.

## 6. Security Validation

1.  **Headers**: Inspect response headers to verify CSP and HSTS are active.
    ```bash
    curl -I [SERVICE_URL]
    ```
2.  **Health Check**:
    ```bash
    curl [SERVICE_URL]/healthz
    ```

## 7. Access Control (IAM) for Users

For the application to function, **End Users** must have permissions on the GCP projects they intend to manage.
Grant the following roles to users or groups who will log in via the app interface:
*   `roles/compute.viewer` (To read resources)
*   `roles/compute.admin` (To apply labels - ideally restrict this further with custom roles allowing only `compute.instances.setLabels`)
*   `roles/logging.viewer` (To view audit logs)
