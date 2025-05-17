#!/bin/bash

# Build and deploy to Google Cloud Run
gcloud builds submit --config cloudbuild.yaml

# Get the deployed URL
SERVICE_URL=$(gcloud run services describe pdf-converter-backend --platform managed --region us-central1 --format 'value(status.url)')

echo "Service deployed successfully!"
echo "Service URL: $SERVICE_URL" 