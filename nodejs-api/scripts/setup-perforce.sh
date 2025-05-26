#!/bin/sh

set -e # Exit immediately if a command exits with a non-zero status.

# --- EXPORT PERFORCE ENVIRONMENT VARIABLES ---
export P4PORT="${P4PORT:-perforce-server:1666}"
export P4USER="${P4USER:-super}"
export P4PASSWD="${P4PASSWD:-YourStrongPassword123!}"
export P4CLIENT="${P4CLIENT:-nodejs-client}"

LOCAL_HOSTNAME="p4-node-client-host" # Ensure this matches the hostname in docker-compose.yml

echo "Waiting for Perforce server to be healthy..."
until p4 -p $P4PORT -u $P4USER -P "$P4PASSWD" info > /dev/null 2>&1; do
  echo "Perforce server not yet ready, waiting..."
  sleep 5
done
echo "Perforce server is healthy."

echo "Logging in to Perforce as user '$P4USER'..."
printf '%s' "$P4PASSWD" | p4 -p $P4PORT -u $P4USER login
echo "Perforce login successful."

echo "Configuring Perforce client workspace: $P4CLIENT"

echo "Attempting to delete existing client '$P4CLIENT' (if any)..."
p4 client -d $P4CLIENT || true
echo "Client '$P4CLIENT' deleted or did not exist."

# --- ROBUST CLIENT SPEC CREATION ---
cat << EOF > /tmp/client_spec.txt
Client: $P4CLIENT
Owner: $P4USER
Root: /workspace
Host: $LOCAL_HOSTNAME # Using specific hostname
Options: noallwrite noclobber nocompress unlocked nomodtime normdir noaltsync
SubmitOptions: submitunchanged
LineEnd: local
View:
    //depot/... //$P4CLIENT/...
EOF

p4 client -i < /tmp/client_spec.txt
rm /tmp/client_spec.txt # Clean up the temporary file
echo "Client workspace configured."

echo "--- Current Client Spec After Configuration ---"
p4 client -o $P4CLIENT
echo "-----------------------------------------------"

echo "Cleaning up local workspace to prepare for new data..."
# Ensure the local workspace is completely clean before creating new files
# This also syncs the client, so p4 reconcile will find new files.
rm -rf /workspace/$P4CLIENT/* || true
p4 sync //...#none || true # Unmap all files from the workspace
p4 revert //... || true # Revert any pending changes (should be none after sync #none)
echo "Local workspace cleaned."

echo "Generating random mock repositories and changes..."

mkdir -p /workspace/$P4CLIENT
echo "Created workspace subdirectory: /workspace/$P4CLIENT"

cd /workspace/$P4CLIENT
echo "Current working directory: $(pwd)"

# Function to generate a random alphanumeric string
generate_random_string() {
  cat /dev/urandom | tr -dc A-Za-z0-9 | head -c "$1"
}

NUM_CHANGES=5 # Number of random changes/submits to create
FILES_PER_CHANGE=3 # Number of files to create/modify per change

for i in $(seq 1 $NUM_CHANGES); do
  echo "--- Generating Change $i of $NUM_CHANGES ---"
  CHANGE_DESCRIPTION="Random change number $i"

  for j in $(seq 1 $FILES_PER_CHANGE); do
    PROJECT_NAME="project_$(generate_random_string 4)"
    FILE_NAME="$(generate_random_string 8).txt"
    SUBDIR_NAME="src/$(generate_random_string 2)" # Introduce some random subdirectories

    FILE_PATH="${PROJECT_NAME}/${SUBDIR_NAME}/${FILE_NAME}"
    CONTENT="This is random content for ${FILE_PATH} from change $i - $(date) - $(generate_random_string 32)"

    echo "Creating/modifying file: ${FILE_PATH}"
    mkdir -p "$(dirname "$FILE_PATH")"
    echo "$CONTENT" > "$FILE_PATH"
  done

  echo "Reconciling changes for Change $i..."
  p4 reconcile ... # Reconcile all files in the current client root
  if p4 changes -s pending -u $P4USER | grep -q "Change "; then
    echo "Submitting Change $i..."
    p4 submit -d "$CHANGE_DESCRIPTION"
    echo "Change $i submitted successfully."
  else
    echo "No files opened for Change $i. Skipping submit."
  fi
done

# Optionally, modify an existing file after some initial adds
echo "Modifying a known file..."
EXISTING_PROJECT="project_$(generate_random_string 4)"
EXISTING_FILE="fixed_file.js"
mkdir -p "${EXISTING_PROJECT}/src"
echo "console.log('Initial content for ${EXISTING_PROJECT}/${EXISTING_FILE}');" > "${EXISTING_PROJECT}/src/${EXISTING_FILE}"
p4 reconcile "${EXISTING_PROJECT}/src/${EXISTING_FILE}"
p4 submit -d "Initial commit for a fixed test file"

echo "Adding more content to the fixed test file..."
echo "\nconsole.log('Additional content for ${EXISTING_PROJECT}/${EXISTING_FILE} - $(date)');" >> "${EXISTING_PROJECT}/src/${EXISTING_FILE}"
p4 reconcile "${EXISTING_PROJECT}/src/${EXISTING_FILE}"
p4 submit -d "Updated fixed test file"

echo "Random mock data generation complete."