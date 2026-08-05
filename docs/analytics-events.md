# Analytics event catalog

Add events only when a feature PR has a clear decision or usability question to answer. PostHog is initialized only after explicit visitor consent and Clerk session readiness. It has autocapture, automatic page views, session replay, and person-property enrichment disabled.

Consent is stored locally as `granted` or `denied`. It defaults to pending, and pending or denied visitors send no events. A person is identified only after a signed-in Clerk session is ready, using Clerk's opaque user ID; names, email addresses, credentials, race data, crew details, free text, and other protected content must never be sent.

Every event includes the non-sensitive `app_environment` and `release_sha` tags from the deployed web environment. The PostHog project key is public by design; configure it and the host only in the matching Railway environment.

| Event | Trigger | Properties | Privacy notes | Owner |
| --- | --- | --- | --- | --- |
| `app_viewed` | Once after a consented visitor's Clerk session state is ready | `app_environment`, `release_sha` | No route, user content, contact data, or race/crew data. The opaque Clerk user ID is used only as the PostHog distinct ID after sign-in. | Web platform |
