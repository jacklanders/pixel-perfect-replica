import { readFileSync } from "node:fs";

for (const line of readFileSync("./.env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const { saveGmailTokens, getValidAccessToken, isGmailConnected, markGmailDisconnected } =
  await import("./src/lib/server/gmail-oauth.ts");
const { getServiceClient } = await import("./src/lib/server/supabase-service.ts");

const service = getServiceClient();
const userId = "9b2c3c26-1a4e-4055-8041-d82763027c47";

await markGmailDisconnected(userId, service);

const tokenResp = {
  access_token: "test-access-abc",
  refresh_token: "test-refresh-xyz",
  expires_in: 3600,
  token_type: "Bearer",
  scope: "https://www.googleapis.com/auth/gmail.send",
};

try {
  await saveGmailTokens(userId, tokenResp, service);
  console.log("SAVE OK");

  const { data } = await service
    .from("oauth_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google_gmail")
    .maybeSingle();
  console.log("ROW FIELDS:", data ? Object.keys(data).join(",") : "none");
  console.log(
    "has refresh_token:",
    Boolean(data?.refresh_token),
    "has encrypted_access_token:",
    Boolean(data?.encrypted_access_token),
  );

  const conn = await isGmailConnected(userId, service);
  console.log("isGmailConnected:", JSON.stringify(conn));

  const access = await getValidAccessToken(userId, service);
  console.log("getValidAccessToken OK:", access === "test-access-abc");
} catch (err) {
  console.log("ERROR:", err?.message);
  console.log(err);
}

await markGmailDisconnected(userId, service);
console.log("cleanup done");
