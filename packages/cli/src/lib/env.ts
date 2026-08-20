export function getApiUrl() {
  return process.env.OWLCODE_API_URL ?? "http://localhost:3000";
}
