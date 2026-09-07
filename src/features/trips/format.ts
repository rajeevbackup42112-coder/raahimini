const tripDateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export function formatTripDateTime(value: string) {
  return tripDateTimeFormatter.format(new Date(value));
}

export function tripLocalInputValue(value: string) {
  const shifted = new Date(new Date(value).getTime() + 330 * 60_000);
  return shifted.toISOString().slice(0, 16);
}
