1) Starting up on a Mac

Pull down any changes you made on your other Mac so your local copy is up-to-date:

cd ~/path/to/your/project
git checkout main             # or whatever your default branch is
git pull origin main


2) Finishing up on a Mac

Save & upload your work to GitHub:
# Stage all edits
git add .

# Commit locally with a meaningful message
git commit -m "Describe what you changed"

# Push to GitHub
git push origin main

3) Deploying (manual)

Use the code currently in your working folder (which you just pulled/pushed) and update only the function you want:

# Deploy your main “FreeAgent” function
gcloud functions deploy FreeAgent \
  --runtime=nodejs20 \
  --trigger-http \
  --region=europe-west2 \
  --allow-unauthenticated \
  --source=. \
  --entry-point=myFunction

# Or, to only update authCallback:
gcloud functions deploy authCallback \
  --runtime=nodejs20 \
  --trigger-http \
  --region=europe-west2 \
  --allow-unauthenticated \
  --source=.

# Or, to only update adminDashboard:
gcloud functions deploy adminDashboard \
  --runtime=nodejs20 \
  --trigger-http \
  --region=europe-west2 \
  --allow-unauthenticated \
  --source=.

  Tip: Pointing --source=. always uses whatever’s in your current folder (i.e. your latest Git-synced code).

  4) See what’s deployed

List all your functions

# Only europe-west2
gcloud functions list --regions=europe-west2

# All regions
gcloud functions list

Pro-tips
	•	Alias your deploy
In ~/.zshrc:

alias deployFA="gcloud functions deploy FreeAgent --runtime=nodejs20 --trigger-http --region=europe-west2 --allow-unauthenticated --source=."



Pre deploy using eslint
  npm run predeploy:freeagent


Get enpoint url
gcloud functions describe adminDashboard --region=europe-west2 --format="yaml(serviceConfig.uri, serviceConfig.serviceUri)"
