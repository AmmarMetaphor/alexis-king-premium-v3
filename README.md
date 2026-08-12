# Alexis King — Premium V3 Static Prototype

Ground-up rebuild based on the client-approved speaker-site architecture.

Run locally:
`python3 -m http.server 8080`

Premium V3 previews are deployed through Cloudflare Pages.

Cloudflare Pages:
- branch: main
- build command: blank
- output directory: .
- root directory: blank

Main routes:
/
/speaking
/about
/books
/assessment
/work-with-me
/speaker-kit

Funnel routes:
/assessment/results-low
/assessment/results-mid
/assessment/results-high
/course-offer
/waitlist
/thank-you

Before approval:
1. Add real photography/logos/book covers per assets/README.md.
2. Replace testimonial placeholders.
3. Select hero headline.
4. Replace provisional colors/typefaces with official brand values.
5. Verify reel permissions.
6. Connect forms/funnel logic in GoHighLevel.
