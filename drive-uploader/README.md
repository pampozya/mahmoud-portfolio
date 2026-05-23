# Google Drive Upload Monitor

Standalone browser tool for uploading a full folder to Google Drive with:

- full-folder real-time progress
- per-file real-time progress
- live upload speed
- remaining bytes and ETA

Folder structure is preserved in Google Drive.

## Run Locally

```bash
cd drive-uploader
python3 -m http.server 4177
```

Open:

```text
http://localhost:4177
```

## Google Setup

1. Create a Google Cloud OAuth Client ID with application type **Web application**.
2. Add your tool origin under **Authorized JavaScript origins**:

```text
http://localhost:4177
```

3. Enable the Google Drive API for the Google Cloud project.
4. The OAuth client ID is built into this local copy of the tool. Open the tool and click **Connect Google Drive**.

The tool uses the `drive.file` OAuth scope, so it can create and manage files uploaded by this tool without asking for full Drive access.
