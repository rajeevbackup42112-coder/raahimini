const indiaDateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export function formatCarpoolDateTime(value: string) {
  return indiaDateTime.format(new Date(value));
}
