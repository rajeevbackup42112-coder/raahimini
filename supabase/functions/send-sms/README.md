# Raahi Send SMS Hook

This Supabase Auth Send SMS Hook delivers Supabase-generated OTPs through Fast2SMS.

Security boundary:
- Supabase generates and verifies the OTP.
- Fast2SMS is delivery only; do not call `/dev/otp/verify`.
- The function accepts only signed Standard Webhooks requests from Supabase Auth.
- The function supports Indian mobile numbers only and never logs/stores OTP payloads.

Required Edge Function secrets:
- `FAST2SMS_API_KEY`
- `FAST2SMS_OTP_ID`
- `SEND_SMS_HOOK_SECRETS` in Supabase `v1,whsec_...` format

Deployment must use `verify_jwt=false` / `--no-verify-jwt` because the Auth Hook can run before a user JWT exists. This is safe only because Standard Webhooks signature verification remains mandatory inside `index.ts`.

Do not enable the production Auth Hook until one controlled real OTP has been delivered and verified through Supabase Auth.
