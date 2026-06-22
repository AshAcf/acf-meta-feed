# Avon City Ford Meta Feed Updater

This updater keeps Autoplay as the source of vehicle data but replaces its obsolete `URL` values with current `https://www.avoncityford.com/vehicles/stock/...` links.

## What it does

1. Opens the ACF inventory in a normal persistent Google Chrome profile.
2. Reads the current vehicle titles, kilometres and correct website URLs.
3. Downloads the live Autoplay CSV.
4. Matches the two sources by year, full title and kilometres.
5. Writes a corrected CSV into the `public` folder.
6. Publishes changed files to GitHub at 9:00am, 12:00pm and 4:00pm New Zealand time.

Autoplay remains the source for prices, descriptions, images and stock. Only the obsolete vehicle URL is replaced. No fuzzy title matching is used. If fewer than 40 website cards load or fewer than 90% of Autoplay rows match, the updater preserves the previous good feed.

## Files published to GitHub

- `public/acf-meta-feed.csv`: the corrected feed URL used by Meta.
- `public/feed-report.json`: update time, counts and unmatched vehicles.
- `public/url-map.json`: Autoplay vehicle IDs and their matched ACF URLs.

## One-time GitHub setup

### 1. Create a GitHub account

Go to `https://github.com` and sign in or create an account. Do not share the password, authentication code or access token with anyone.

### 2. Install GitHub Desktop

Download GitHub Desktop from `https://desktop.github.com`, install it and sign in to the same GitHub account.

### 3. Create the empty GitHub repository

1. On GitHub.com, select the **+** menu and **New repository**.
2. Enter the repository name `acf-meta-feed`.
3. Select **Public** because Meta must download the feed without signing in.
4. Do not add a README, `.gitignore` or licence.
5. Select **Create repository**.
6. Copy its HTTPS address, for example `https://github.com/YOUR-NAME/acf-meta-feed.git`.
7. Send that address to Codex. Do not send a password or token.

Codex will run `windows\connect-github.ps1` to connect and publish this existing project folder.

### 4. Turn on GitHub Pages

1. Open the repository on GitHub.com.
2. Select **Settings > Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the default branch, usually `main`.
5. Select the `/public` folder and save.

The Meta feed URL will normally be:

`https://YOUR-GITHUB-NAME.github.io/acf-meta-feed/acf-meta-feed.csv`

## First browser run

Right-click `windows\first-run.ps1` and select **Run with PowerShell**.

Chrome will open using a dedicated updater profile. If the ACF website displays a verification page, complete it once. The updater then downloads Autoplay and creates the corrected feed.

## Install automatic updates

After the first run succeeds and GitHub Desktop has published the folder:

1. Right-click `windows\install-scheduled-task.ps1`.
2. Select **Run with PowerShell**.

Windows will run `windows\update-and-publish.ps1` at 9:00am, 12:00pm and 4:00pm local time. The computer must be switched on and connected to the internet. Chrome may briefly start minimized while the inventory is read.

Logs are written to `logs\feed-updater.log`.

## Failure notifications

GitHub runs **Monitor Meta vehicle feed** every three hours. It fails when:

- The published feed is more than 20 hours old, allowing for the normal overnight gap.
- Fewer than 90% of Autoplay rows have matched website URLs.
- The feed report is invalid or contains no vehicles.

GitHub can email the account owner when this monitor fails. In GitHub, open **Settings > Notifications > System > Actions** and enable email notifications for failed workflows.

## Meta setup

In Meta Commerce Manager, replace the Autoplay scheduled feed URL with the GitHub Pages `acf-meta-feed.csv` URL. Do not add tracking parameters to the feed URL.

## Autoplay source

`http://dataapi.autoplay.co.nz/fbookAd.ashx?id=29&yardList=1684&type=6`
