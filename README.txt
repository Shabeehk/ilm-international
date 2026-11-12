ILM International website

Live sites
  Firebase:   https://ilminternational.web.app   (main address for parents)
  Cloudflare: https://ilm-international.shabeehminnath.workers.dev   (also saves the leads)

Files (all at the top level of the repo, no folders)
  index.html, fees.html, styles.css, app.js            - the website
  logo.svg, group.svg, online.svg, quran.svg           - pictures
  worker.js, wrangler.jsonc                            - Cloudflare: saves registrations
  firebase.json                                        - Firebase Hosting settings

Download leads (spreadsheet):
  https://ilm-international.shabeehminnath.workers.dev/api/leads?key=YOUR_ADMIN_KEY

Change prices: fees.html and the top of app.js. WhatsApp number: search for 905518881481.
Update Firebase after changes: npx firebase-tools deploy --only hosting
