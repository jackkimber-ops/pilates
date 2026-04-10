# Google Calendar setup

This project supports optional one-way sync from studio sessions to one shared Google Calendar.

## Recommended approach

Use a Google service account for server-to-server access.

## Steps

1. Create a Google Cloud project.
2. Enable the Google Calendar API.
3. Create a service account.
4. Generate a JSON key for that service account.
5. Share the destination Google Calendar with the service account email address.

If you use Google Workspace and want events to appear as a specific user, enable domain-wide delegation and set `GOOGLE_IMPERSONATED_USER`.

## Environment variables

Set these in `.env` locally or in Vercel project settings:

```env
GOOGLE_CLIENT_EMAIL="service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID="your-calendar-id@group.calendar.google.com"
GOOGLE_IMPERSONATED_USER=""
GOOGLE_DELETE_CANCELLED_EVENTS="false"
```

## Vercel notes

- Add the variables in Vercel Project Settings -> Environment Variables
- Set them for the environments where sync should work
- Keep `GOOGLE_PRIVATE_KEY` on one line with escaped `\n`
- If any of `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, or `GOOGLE_CALENDAR_ID` is set, all three must be set

## Behaviour

- If credentials are missing, the app still works and sync is skipped
- Sync is per session
- Admins choose sync in the session form
- If `GOOGLE_DELETE_CANCELLED_EVENTS=true`, cancelled sessions delete the event instead of marking it cancelled

## Testing

1. Set the Google variables.
2. Restart the app or redeploy Vercel.
3. Create or edit a session.
4. Enable `Sync to Google Calendar`.
5. Save the session.
6. Confirm the event appears in the shared calendar.
