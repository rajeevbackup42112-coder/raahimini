export function mapReleaseControlError(message: string): [string, number, string] | null {
  const rules: [string, number, string][] = [
    ["PLATFORM_ADMIN_REQUIRED", 403, "Only the Global Admin can change Product release switches."],
    ["SERVICE_PRODUCT_NOT_FOUND", 404, "This Service Product was not found."],
    ["FEATURE_SWITCH_REASON_REQUIRED", 400, "Add a short reason for this release-control change."],
    ["IDEMPOTENCY_CONFLICT", 409, "This action key was already used with different details."],
  ];
  return rules.find(([code]) => message.includes(code)) ?? null;
}