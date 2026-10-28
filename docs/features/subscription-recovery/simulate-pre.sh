#!/usr/bin/env bash
# Design-time simulation for subscription-recovery. It mirrors the intended
# learner flow with fixed facts, before any code exists. Nothing here runs the
# app or the service; every line is what the design promises the learner sees.
#
# Run: bash docs/features/subscription-recovery/simulate-pre.sh

set -euo pipefail

line() { printf '\n== %s ==\n' "$1"; }
say() { printf '%s\n' "$1"; }

line "1. October, laptop: Ana subscribes"
say "Ana opens Settings -> Provider and presses Subscribe on the System card."
say "Stripe Checkout collects her email, ana@example.com, and her card."
say "Back in the app: 'Your subscription is active. This browser now uses the system provider.'"
say "The card reads: Active until 11/11/2026."
say "Only this laptop holds a pass; Stripe holds the customer (cus_ANA) and the subscription (sub_ANA)."

line "2. November, phone: the System card, with no pass here"
say "Ana opens the same app on her phone. The System card says Not subscribed."
say "Under it, a quiet section: 'Moved to a new browser, or cleared your data?'"
say "'Ask for a link and this browser will get its own pass.'"
say "Field: 'Email used at checkout'. Button: 'Email me a link'."
say "Note under the field: 'We send one email and keep nothing.'"
say "The section is offered in both states: it also appears when this browser already holds a pass."
say "The learner's own provider section is untouched and still available."

line "3. She types the wrong address first"
say "She types ana@gmial.com and presses the button."
say "Answer, same as always: 'If that email has a subscription, a link is on its way. It expires in 30 minutes.'"
say "Nothing is sent; her inbox stays empty. The page does not say the address is unknown."

line "4. She types the right address"
say "She types ana@example.com and presses the button."
say "Same answer: 'If that email has a subscription, a link is on its way. It expires in 30 minutes.'"
say "Behind that answer, with no difference the page can show:"
say "  - the service asks Stripe for customers with that email -> cus_ANA"
say "  - it asks Stripe for that customer's subscriptions -> sub_ANA, status active, accesses granted"
say "  - it signs a 30-minute token that names the email and the request time"
say "  - it sends one message through Brevo and keeps no copy of the address"

line "5. The email"
say "From: Study tutor <no-reply@provider.test>"
say "Subject: Study tutor - your subscription link"
say "Body: 'Open this link in the browser where you want your subscription:'"
say "      https://app.example/settings/?recover=<signed token>"
say "Body: 'The link expires in 30 minutes. If you did not ask for it, you can ignore this email.'"
say "It contains no learner text, no card, no price, no name, no key."

line "6. She opens the link on the phone"
say "The app shows: 'Checking the link...'"
say "The service re-checks Stripe, then issues a fresh pass (sub_ANA, cus_ANA, 30 days)."
say "The phone stores the pass and switches the provider to the system lane."
say "The page says: 'Your subscription is active on this browser now.'"
say "The ?recover= part is removed from the address bar once the pass is stored."
say "A key this phone had stored for her own provider stays stored; switching back still works."
say "The card reads: Active until 20/12/2026, and Test connection answers from the service."

line "7. The old laptop"
say "The laptop keeps its own pass. Opening the Provider tab in the pass's last week renews it quietly;"
say "between visits the pass simply stays valid until its own expiry."
say "Both browsers name the same subscription; both keep working."
say "Nothing is revoked by the recovery, and nothing is synced: settings, cards and progress stay separate."

line "8. A link that is too old"
say "Ana opens yesterday's link."
say "The page says: 'That link has expired. Ask for a new one.'"
say "The form is right there; the 10-minute per-email cooldown may mean the next request sends nothing."
say "The page still says the same sentence, so she cannot tell whether a mail was due."

line "9. A link opened twice"
say "She opens the same 30-minute link again on a third browser."
say "It works: another pass is issued for the same live subscription."
say "No 'already used' refusal exists, and the service stored no use."

line "10. A subscription that was cancelled"
say "Same flow, but Stripe says the subscription is not active."
say "The link page says: 'This subscription is not active.'"
say "The System card stays Not subscribed and still offers Subscribe."

line "11. Two live subscriptions on one email"
say "Stripe returns sub_OLD (renews 12/11) and sub_NEW (renews 02/12), both active."
say "The service uses the most recently renewing one, sub_NEW, and signs the pass for it."
say "Manage subscription on that browser opens the portal for sub_NEW."

line "12. Limits"
say "Sixth request in an hour from one address: 'Too many requests. Try again in an hour.' (429 in the service)"
say "Second request for the same email within 10 minutes: the same 'on its way' sentence, no second email."
say "The per-email record is a hash in memory and is gone after a restart."
say "The address limit counts the requester, so it never reveals whether an email is subscribed."

line "13. Recovery not set up"
say "With no Brevo key, no recovery secret or no sender address:"
say "  - /api/config reports recovery: false"
say "  - the Provider tab shows no recovery form at all"
say "  - a direct call to the endpoint answers 503 'Recovery is not set up.'"
say "Everything else in the app behaves exactly as before this pack."

line "14. The service is down"
say "The form answers: 'The subscription service could not be reached. Try again in a moment.'"
say "No mail is claimed to be sent, and nothing is stored locally."

line "15. What must not happen"
say "The service never stores or logs the email, the token, the pass or the Stripe customer."
say "The page never differs between an unsubscribed email, a subscribed one and a failed send."
say "A recovery link never works after 30 minutes, and never works for a cancelled plan."
say "A recovered pass never enters a backup, and the backup screen never mentions it."
say "No account, password or profile appears anywhere, and 'Local only. No account.' stays true."
say "The learner's own provider lane, its key and its relay behaviour are untouched."
say "The operator's model key and the paid proxy are not involved in recovery at all."

say ""
say "Design direction confirmed: email one-time link, 30 minutes, five per address per hour,"
say "one per email per ten minutes, the same answer every time, nothing stored, recovery optional."
