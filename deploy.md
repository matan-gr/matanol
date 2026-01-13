
# 🚀 Quick Start Deployment: Yalla Label

Deploy **Yalla Label** to Google Cloud Run in minutes.

## 1. One-Time Setup

Run this block in your terminal (Google Cloud Shell recommended) to set up your project infrastructure.

```bash
# --- Configuration ---
export PROJECT_ID="your-project-id"  # <--- REPLACE THIS
export REGION="us-central1"
export REPO_NAME="app-repo"

# --- Initialization ---
gcloud config set project $PROJECT_ID

# Enable APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  logging.googleapis.com \
  iam.googleapis.com

# Create Docker Repository
gcloud artifacts repositories create $REPO_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Yalla Label Repository" || echo "Repo exists, skipping..."
```

---

## 2. Deploy

Run this single command to build and deploy the app.
Replace `YOUR_AI_STUDIO_KEY` with your actual key from [Google AI Studio](https://aistudio.google.com/).

```bash
gcloud builds submit \
    --config cloudbuild.yaml \
    --substitutions=_GEMINI_API_KEY="YOUR_AI_STUDIO_KEY",_REGION="us-central1"
```

✅ **Done!** Click the URL output at the end of the build (e.g., `https://yalla-label-xyz-uc.a.run.app`).

---

## 3. (Optional) Enterprise Security

For production environments, lock down your API key and set up user roles.

### A. Lock the API Key
1. Go to **[GCP Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)**.
2. Edit your **Gemini API Key**.
3. Under **Application restrictions**, choose **HTTP referrers**.
4. Add your new Cloud Run URL (found in step 2).

### B. Create a Safe User Role
If you want to give team members access without making them Project Owners, run this:

```bash
# Create "Label Manager" Role
gcloud iam roles create YallaLabelManager \
    --project=$PROJECT_ID \
    --title="Yalla Label Manager" \
    --permissions=compute.instances.list,compute.instances.get,compute.instances.setLabels,compute.disks.list,compute.disks.get,compute.disks.setLabels,storage.buckets.list,storage.buckets.get,storage.buckets.update,logging.logEntries.list,resourcemanager.projects.get,compute.regions.list

# Assign to User
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="user:jane.doe@example.com" \
    --role="projects/$PROJECT_ID/roles/YallaLabelManager"
```
