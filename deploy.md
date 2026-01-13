
# 🚀 Enterprise Deployment Guide: Yalla Label

Deploy **Yalla Label** securely to **Google Cloud Run** using a fully automated CI/CD pipeline with Cloud Build.

## 📋 1. Architecture Overview

- **Frontend**: React (Vite) Single Page Application (SPA).
- **Serving**: Nginx (Alpine Linux) containerized via Docker.
- **Compute**: Google Cloud Run (Serverless, Auto-scaling).
- **Authentication**: Client-side OAuth2 (User connects directly to GCP APIs).
- **AI**: Gemini API (Key injected at build time, secured via Referrer restrictions).

---

## 🛠️ 2. Prerequisites

Ensure you have the following installed and configured:

1.  **Google Cloud SDK (`gcloud`)**: [Install Guide](https://cloud.google.com/sdk/docs/install)
2.  **GCP Project**: An active project with billing enabled.
3.  **Gemini API Key**: Created via [Google AI Studio](https://aistudio.google.com/).

---

## ⚙️ 3. Infrastructure Bootstrap

Run the following commands in your terminal to set up the necessary Google Cloud services.

### 3.1. Set Project Context
```bash
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export REPO_NAME="app-repo"

gcloud config set project $PROJECT_ID
```

### 3.2. Enable Required APIs
```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  logging.googleapis.com \
  iam.googleapis.com
```

### 3.3. Create Artifact Registry Repository
This serves as the secure storage for your Docker images.
```bash
gcloud artifacts repositories create $REPO_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Yalla Label Container Repository"
```

---

## 📦 4. Build & Deploy

We use **Cloud Build** to build the Docker image and deploy it to **Cloud Run**.

### 4.1. Prepare Files
Ensure the following files are named correctly in your root directory:
- `Dockerfile.txt` -> **`Dockerfile`**
- `nginx.txt` -> **`nginx.conf`**
- `dockerignore.txt` -> **`.dockerignore`**

### 4.2. Submit Build
Run the build command. Replace `YOUR_ACTUAL_API_KEY` with your Gemini API key.

> **Note**: The API Key is baked into the frontend bundle. See Section 5 for security locking.

```bash
gcloud builds submit \
    --config cloudbuild.yaml \
    --substitutions=_GEMINI_API_KEY="YOUR_ACTUAL_API_KEY",_REGION="$REGION"
```

### 4.3. Verify Deployment
Once complete, Cloud Build will output a **Service URL** (e.g., `https://yalla-label-xyz-uc.a.run.app`). 
Open this URL in your browser.

---

## 🔐 5. Critical Security Configuration

Since this is a client-side application, the API Key is exposed in the browser network traffic. You **MUST** restrict it to prevent unauthorized usage.

1.  Go to **[Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)**.
2.  Select your **Gemini API Key**.
3.  Under **Application restrictions**, select **HTTP referrers (web sites)**.
4.  Add your Cloud Run URL:
    - `https://yalla-label-*.a.run.app/*` (Wildcard)
    - OR specific URL: `https://yalla-label-xyz-uc.a.run.app/*`
5.  Save changes.

**Outcome**: The key will now *only* work when requests originate from your deployed application.

---

## 👤 6. User Access Control (IAM)

The application runs using the *User's* credentials (entered at login), not the server's service account.

To use the app, end-users need a Custom IAM Role with **Least Privilege**:

```bash
# Create a safe role for Label Managers
gcloud iam roles create YallaLabelManager \
    --project=$PROJECT_ID \
    --title="Yalla Label Manager" \
    --description="Can view resources and update labels only." \
    --permissions=compute.instances.list,compute.instances.get,compute.instances.setLabels,compute.disks.list,compute.disks.get,compute.disks.setLabels,storage.buckets.list,storage.buckets.get,storage.buckets.update,logging.logEntries.list,resourcemanager.projects.get,compute.regions.list
```

Assign this role to users who need to use the tool:
```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="user:jane.doe@example.com" \
    --role="projects/$PROJECT_ID/roles/YallaLabelManager"
```
