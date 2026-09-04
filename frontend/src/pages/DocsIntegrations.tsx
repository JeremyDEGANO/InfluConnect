import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Copy, Check, ExternalLink } from "lucide-react"

const Code = ({ children }: { children: string }) => {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative group">
      <pre className="bg-aurora-ink/90 text-white rounded-md p-3 text-[12px] overflow-auto leading-relaxed">
        <code>{children}</code>
      </pre>
      <Button
        type="button" variant="ghost" size="sm"
        className="absolute top-1.5 right-1.5 h-7 px-2 text-white/70 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition"
        onClick={() => { navigator.clipboard?.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  )
}

type Samples = Partial<Record<"curl"|"python"|"javascript"|"csharp"|"php"|"go"|"ruby"|"java", string>>

const LABELS: Record<string, string> = {
  curl: "cURL", python: "Python", javascript: "Node.js", csharp: "C#",
  php: "PHP", go: "Go", ruby: "Ruby", java: "Java",
}

function CodeTabs({ samples }: { samples: Samples }) {
  const langs = (Object.keys(samples) as Array<keyof Samples>).filter(k => samples[k])
  return (
    <Tabs defaultValue={langs[0]} className="w-full">
      <TabsList className="flex flex-wrap h-auto">
        {langs.map(l => <TabsTrigger key={l} value={l} className="text-xs">{LABELS[l]}</TabsTrigger>)}
      </TabsList>
      {langs.map(l => (
        <TabsContent key={l} value={l} className="mt-2">
          <Code>{samples[l]!}</Code>
        </TabsContent>
      ))}
    </Tabs>
  )
}

const API_BASE = "https://api.influconnect.app/api/v1"

const LIST_CAMPAIGNS: Samples = {
  curl: `curl ${API_BASE}/campaigns/ \\
  -H "Authorization: Bearer ic_live_xxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"`,
  python: `import requests
API_KEY = "ic_live_xxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
r = requests.get("${API_BASE}/campaigns/",
                 headers={"Authorization": f"Bearer {API_KEY}"}, timeout=10)
r.raise_for_status()
print(r.json())`,
  javascript: `const API_KEY = "ic_live_xxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const res = await fetch("${API_BASE}/campaigns/", {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
});
if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
console.log(await res.json());`,
  csharp: `using System.Net.Http.Headers;
var http = new HttpClient();
http.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", "ic_live_xxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
var json = await http.GetStringAsync("${API_BASE}/campaigns/");
Console.WriteLine(json);`,
  php: `<?php
$ch = curl_init("${API_BASE}/campaigns/");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ["Authorization: Bearer ic_live_xxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"],
]);
echo curl_exec($ch);`,
  go: `package main
import ("fmt"; "io"; "net/http")
func main() {
  req, _ := http.NewRequest("GET", "${API_BASE}/campaigns/", nil)
  req.Header.Set("Authorization", "Bearer ic_live_xxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
  res, _ := http.DefaultClient.Do(req)
  defer res.Body.Close()
  body, _ := io.ReadAll(res.Body)
  fmt.Println(string(body))
}`,
  ruby: `require "net/http"; require "uri"
uri = URI("${API_BASE}/campaigns/")
req = Net::HTTP::Get.new(uri)
req["Authorization"] = "Bearer ic_live_xxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(req) }
puts res.body`,
  java: `HttpRequest req = HttpRequest.newBuilder()
    .uri(URI.create("${API_BASE}/campaigns/"))
    .header("Authorization", "Bearer ic_live_xxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
    .GET().build();
HttpResponse<String> res = HttpClient.newHttpClient()
    .send(req, HttpResponse.BodyHandlers.ofString());
System.out.println(res.body());`,
}

const CREATE_CAMPAIGN: Samples = {
  curl: `curl -X POST ${API_BASE}/campaigns/create/ \\
  -H "Authorization: Bearer ic_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Summer launch",
    "description": "Beauty creators in France",
    "budget": "5000.00",
    "deadline": "2025-08-30",
    "content_formats": ["video","story"],
    "max_influencers": 10
  }'`,
  python: `import requests
payload = {
    "title": "Summer launch",
    "description": "Beauty creators in France",
    "budget": "5000.00",
    "deadline": "2025-08-30",
    "content_formats": ["video", "story"],
    "max_influencers": 10,
}
r = requests.post("${API_BASE}/campaigns/create/",
                  headers={"Authorization": "Bearer ic_live_..."},
                  json=payload, timeout=10)
print(r.status_code, r.json())`,
  javascript: `const res = await fetch("${API_BASE}/campaigns/create/", {
  method: "POST",
  headers: {
    Authorization: "Bearer ic_live_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Summer launch",
    description: "Beauty creators in France",
    budget: "5000.00",
    deadline: "2025-08-30",
    content_formats: ["video", "story"],
    max_influencers: 10,
  }),
});
console.log(res.status, await res.json());`,
  csharp: `var payload = new {
  title = "Summer launch", description = "Beauty creators in France",
  budget = "5000.00", deadline = "2025-08-30",
  content_formats = new[] { "video", "story" }, max_influencers = 10
};
var http = new HttpClient();
http.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", "ic_live_...");
var res = await http.PostAsJsonAsync("${API_BASE}/campaigns/create/", payload);
Console.WriteLine(await res.Content.ReadAsStringAsync());`,
}

const VERIFY_INFLUENCER: Samples = {
  curl: `curl -X POST ${API_BASE}/influencers/42/verify/ \\
  -H "Authorization: Bearer ic_live_..."`,
  python: `import requests
r = requests.post("${API_BASE}/influencers/42/verify/",
                  headers={"Authorization": "Bearer ic_live_..."}, timeout=10)
print(r.json())  # { "is_verified": true, ... }`,
  javascript: `await fetch("${API_BASE}/influencers/42/verify/", {
  method: "POST",
  headers: { Authorization: "Bearer ic_live_..." },
});`,
}

const WEBHOOK_VERIFY: Samples = {
  javascript: `import crypto from "node:crypto";
export function verify(req, secret) {
  const header = req.headers["x-influconnect-signature"];
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=")));
  const expected = crypto.createHmac("sha256", secret)
    .update(parts.t + "." + req.rawBody) // raw, unmodified bytes
    .digest("hex");
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  return crypto.timingSafeEqual(
    Buffer.from(parts.v1, "hex"), Buffer.from(expected, "hex")
  );
}`,
  python: `import hmac, hashlib, time
def verify(body: bytes, header: str, secret: str) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(","))
    if abs(time.time() - int(parts["t"])) > 300:
        return False
    mac = hmac.new(secret.encode(),
                   f"{parts['t']}.".encode() + body,
                   hashlib.sha256).hexdigest()
    return hmac.compare_digest(mac, parts["v1"])`,
  csharp: `using System.Security.Cryptography; using System.Text;
public static bool Verify(byte[] body, string header, string secret) {
  var parts = header.Split(',')
      .Select(p => p.Split('=', 2))
      .ToDictionary(p => p[0], p => p[1]);
  if (Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeSeconds() - long.Parse(parts["t"])) > 300)
      return false;
  using var h = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
  var signed = Encoding.UTF8.GetBytes(parts["t"] + ".").Concat(body).ToArray();
  var mac = Convert.ToHexString(h.ComputeHash(signed)).ToLowerInvariant();
  return CryptographicOperations.FixedTimeEquals(
      Encoding.UTF8.GetBytes(mac), Encoding.UTF8.GetBytes(parts["v1"]));
}`,
  php: `<?php
function verify(string $body, string $header, string $secret): bool {
  $parts = [];
  foreach (explode(',', $header) as $p) {
    [$k, $v] = explode('=', $p, 2);
    $parts[$k] = $v;
  }
  if (abs(time() - (int)$parts['t']) > 300) return false;
  $mac = hash_hmac('sha256', $parts['t'] . '.' . $body, $secret);
  return hash_equals($mac, $parts['v1']);
}`,
  go: `package webhook
import ("crypto/hmac"; "crypto/sha256"; "encoding/hex"; "strconv"; "strings"; "time")
func Verify(body []byte, header, secret string) bool {
    parts := map[string]string{}
    for _, p := range strings.Split(header, ",") {
        kv := strings.SplitN(p, "=", 2)
        if len(kv) == 2 { parts[kv[0]] = kv[1] }
    }
    ts, _ := strconv.ParseInt(parts["t"], 10, 64)
    if d := time.Now().Unix() - ts; d > 300 || d < -300 { return false }
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(parts["t"] + "."))
    mac.Write(body)
    return hmac.Equal([]byte(hex.EncodeToString(mac.Sum(nil))), []byte(parts["v1"]))
}`,
  ruby: `require "openssl"
def verify(body, header, secret)
  parts = header.split(",").map { |p| p.split("=", 2) }.to_h
  return false if (Time.now.to_i - parts["t"].to_i).abs > 300
  mac = OpenSSL::HMAC.hexdigest("SHA256", secret, "#{parts['t']}.#{body}")
  OpenSSL.fixed_length_secure_compare(mac, parts["v1"])
end`,
}

const PLATFORM_BASE = "https://api.influconnect.app/api"

const GET_JWT: Samples = {
  curl: `# 1) Obtenir un couple access / refresh
curl -X POST ${PLATFORM_BASE}/auth/login/ \\
  -H "Content-Type: application/json" \\
  -d '{ "username": "you@company.com", "password": "********" }'
# → { "user": {...}, "access": "<JWT, 60 min>", "refresh": "<JWT, 7 jours>" }

# 2) Appeler l'API avec le token d'accès
curl ${PLATFORM_BASE}/campaigns/ \\
  -H "Authorization: Bearer <access>"

# 3) Renouveler le token d'accès quand il expire
curl -X POST ${PLATFORM_BASE}/auth/refresh/ \\
  -H "Content-Type: application/json" \\
  -d '{ "refresh": "<refresh>" }'
# → { "access": "<nouveau JWT>" }`,
  python: `import requests

BASE = "${PLATFORM_BASE}"

# 1) Login → access (60 min) + refresh (7 jours)
r = requests.post(f"{BASE}/auth/login/",
                  json={"username": "you@company.com", "password": "********"},
                  timeout=10)
r.raise_for_status()
tokens = r.json()

# 2) Appels authentifiés
me = requests.get(f"{BASE}/auth/me/",
                  headers={"Authorization": f"Bearer {tokens['access']}"}, timeout=10)
print(me.json())

# 3) Renouvellement
r = requests.post(f"{BASE}/auth/refresh/",
                  json={"refresh": tokens["refresh"]}, timeout=10)
access = r.json()["access"]`,
  javascript: `const BASE = "${PLATFORM_BASE}";

// 1) Login → access (60 min) + refresh (7 jours)
const login = await fetch(\`\${BASE}/auth/login/\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "you@company.com", password: "********" }),
});
const { access, refresh } = await login.json();

// 2) Appels authentifiés
const me = await fetch(\`\${BASE}/auth/me/\`, {
  headers: { Authorization: \`Bearer \${access}\` },
});
console.log(await me.json());

// 3) Renouvellement
const renewed = await fetch(\`\${BASE}/auth/refresh/\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ refresh }),
});
const { access: newAccess } = await renewed.json();`,
}

const DISCOVER_SSO: Samples = {
  curl: `curl "https://api.influconnect.app/api/auth/sso/discover/?email=alice@acme.com"`,
  python: `import requests
r = requests.get("https://api.influconnect.app/api/auth/sso/discover/",
                 params={"email": "alice@acme.com"}, timeout=5)
print(r.json())  # { "sso": true, "provider": "office365", "enforce": true, "brand_name": "ACME" }`,
}

export default function DocsIntegrations() {
  const { t } = useTranslation()
  const [openingDocs, setOpeningDocs] = useState(false)
  const isAuthed = typeof window !== "undefined" && !!sessionStorage.getItem("access_token")

  const openPartnerDocs = async () => {
    const popup = window.open("about:blank", "_blank")
    if (popup) popup.opener = null
    setOpeningDocs(true)
    try {
      const { data } = await api.post("/auth/partner-docs-code/")
      const base = String(api.defaults.baseURL || "/api")
      const root = base.startsWith("http") ? base.replace(/\/api\/?$/, "") : ""
      const target = `${root}/api/partner/docs/?code=${encodeURIComponent(data.code)}`
      if (popup) popup.location.href = target
      else window.location.href = target
    } finally {
      setOpeningDocs(false)
    }
  }
  return (
    <div className="min-h-screen bg-aurora-bg-1">
      <header className="border-b border-aurora-line bg-white sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-aurora-blue to-aurora-blue-deep flex items-center justify-center text-white text-[10px] font-black">IC</div>
            <span className="font-semibold">InfluConnect · {t("docs.short", "Docs")}</span>
          </Link>
          <nav className="text-sm flex gap-4 text-aurora-ink-2">
            <a href="#auth" className="hover:text-aurora-ink">Auth</a>
            <a href="#sso" className="hover:text-aurora-ink">SSO</a>
            <a href="#domains" className="hover:text-aurora-ink">Domains</a>
            <a href="#api" className="hover:text-aurora-ink">API</a>
            <a href="#webhooks" className="hover:text-aurora-ink">Webhooks</a>
            <a href="#errors" className="hover:text-aurora-ink">Errors</a>
          </nav>
        </div>
      </header>

      <div className="container mx-auto p-6 max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("docs.title", "Integrations documentation")}</h1>
          <p className="text-aurora-ink-3 mt-2">{t("docs.intro", "Everything you need to integrate InfluConnect with your own apps: REST API, signed webhooks, and Office 365 SSO.")}</p>
        </div>

        <Card className="border-aurora-blue/30 bg-gradient-to-br from-aurora-blue/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t("docs.api_reference_title", "Live API reference")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-aurora-ink-2">
              {t("docs.api_reference_intro", "Browse and try every endpoint of the Partner API directly from your browser. Access is restricted to authenticated brand and agency workspaces — sign in first, then open the interactive reference.")}
            </p>
            {isAuthed ? (
              <Button className="inline-flex items-center gap-2" onClick={openPartnerDocs} disabled={openingDocs}>
                  <ExternalLink className="h-4 w-4" />
                  {t("docs.api_reference_open", "Open the API reference")}
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Link to="/login">
                  <Button variant="outline">
                    {t("docs.api_reference_login", "Sign in to access the reference")}
                  </Button>
                </Link>
              </div>
            )}
            <p className="text-xs text-aurora-ink-3">
              {t("docs.api_reference_scope", "Only the public Partner API (campaigns, proposals, influencers, webhooks, SSO, API keys) is exposed. Internal platform endpoints are not documented and not reachable from the outside.")}
            </p>
          </CardContent>
        </Card>

        <Card id="auth">
          <CardHeader><CardTitle>1. {t("docs.auth", "Authentication")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <h3 className="font-semibold">{t("docs.auth_apikey_title", "A. API keys (recommended for server-to-server)")}</h3>
            <p>{t("docs.auth_1", "Generate keys from Brand → Integrations → API keys. Each key carries an explicit set of scopes (least privilege). Keys are shown only at creation.")}</p>
            <p>{t("docs.auth_2", "Send the key in the Authorization header. Examples in your language:")}</p>
            <CodeTabs samples={LIST_CAMPAIGNS} />
            <p className="text-xs text-aurora-ink-3">{t("docs.auth_rate", "Rate limit: 120 requests / minute / key.")} · {t("docs.auth_ip", "Optional IP allowlist (CIDR) per key — requests from other addresses get HTTP 401.")}</p>

            <h3 className="font-semibold mt-4">{t("docs.auth_jwt_title", "B. JWT user token (platform API)")}</h3>
            <p>{t("docs.auth_jwt_1", "The /api/v1 partner endpoints only accept API keys. To call the platform API (the same endpoints the web app uses, under /api/...), authenticate as a user and obtain a JWT pair via login:")}</p>
            <CodeTabs samples={GET_JWT} />
            <ul className="text-xs list-disc pl-5 space-y-1 text-aurora-ink-3">
              <li>{t("docs.auth_jwt_login", "POST /api/auth/login/ accepts your email or username; it returns an access token (valid 60 min) and a refresh token (valid 7 days).")}</li>
              <li>{t("docs.auth_jwt_header", "Send the access token on every call: Authorization: Bearer <access>.")}</li>
              <li>{t("docs.auth_jwt_refresh", "When the access token expires (HTTP 401), POST the refresh token to /api/auth/refresh/ to get a new one.")}</li>
              <li>{t("docs.auth_jwt_2fa", "If 2FA is enabled on the account, the first call returns { totp_required: true } (or email_otp_required) — repeat the login request adding totp_code (or email_otp_code).")}</li>
            </ul>
          </CardContent>
        </Card>

        <Card id="sso">
          <CardHeader><CardTitle>2. {t("docs.sso", "SSO with Microsoft Entra ID (Office 365)")}</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-aurora-ink-2">{t("docs.sso_intro", "InfluConnect uses a single login entry point. When a user types their work email, we check whether their domain is bound to a verified SSO workspace and, if so, send them straight to Microsoft. No extra button to click.")}</p>

            <h3 className="font-semibold">{t("docs.sso_prereq_title", "Step 1 — Verify your email domain(s) (required first)")}</h3>
            <p className="text-aurora-ink-2">{t("docs.sso_prereq", "SSO cannot be enabled until at least one email domain is verified via DNS (Integrations → Domains, see section 3). You can verify several domains; any of them unlocks sign-in for its users.")}</p>

            <h3 className="font-semibold">{t("docs.sso_app_title", "Step 2 — Create the Entra application")}</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>{t("docs.sso_1", "Open Azure Portal → Microsoft Entra ID → App registrations → New registration.")}</li>
              <li>{t("docs.sso_2", "Supported account types: single tenant. Redirect URI (Web):")} <code className="text-xs">https://api.influconnect.app/api/auth/sso/office365/callback/</code></li>
              <li>{t("docs.sso_3", "After creation, copy the Application (client) ID and Directory (tenant) ID.")}</li>
              <li>{t("docs.sso_4", "Certificates & secrets → New client secret. Copy the value (not the ID).")}</li>
              <li>{t("docs.sso_5", "API permissions → Microsoft Graph (Delegated): openid, email, profile, User.Read. Grant admin consent.")}</li>
              <li>{t("docs.sso_6", "Back in InfluConnect → Integrations → SSO, paste tenant ID, client ID and client secret, then save.")}</li>
            </ol>

            <h3 className="font-semibold">{t("docs.sso_who_title", "Step 3 — Choose who can sign in")}</h3>
            <p className="text-aurora-ink-2">{t("docs.sso_who_intro", "Two provisioning modes are available in Integrations → SSO:")}</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>{t("docs.sso_mode_domain", "Whole tenant (verified domain)")}</strong> — {t("docs.sso_mode_domain_desc", "every user whose email belongs to a verified domain can sign in. They receive the configured default role (member or admin), either on all environments of your organization or on a single environment.")}
              </li>
              <li>
                <strong>{t("docs.sso_mode_groups", "Synchronized Entra groups")}</strong> — {t("docs.sso_mode_groups_desc", "only members of the Entra security groups you map can sign in. You can map several groups, each with its own role (admin/member) and scope (all environments, or a selection). Rights are re-synchronized at every login: move a user between groups in Entra and their InfluConnect access follows.")}
                <div className="mt-2">
                  <Code>{`Entra ID → App registration → Token configuration
→ Add groups claim → Security groups
(the ID token must carry the user's group Object IDs)`}</Code>
                </div>
              </li>
            </ul>

            <h3 className="font-semibold">{t("docs.sso_invite_title", "Inviting a tenant user explicitly")}</h3>
            <p className="text-aurora-ink-2">{t("docs.sso_invite", "You can also keep auto-provisioning off and invite users one by one from Brand → Team. The invitee receives an email link; when they open it and sign in with Microsoft (their domain is detected automatically on the login page), the invitation is matched by email and the granted access applies. Group mode and invitations can be combined: groups for the bulk of the tenant, invitations for exceptions.")}</p>

            <h3 className="font-semibold">{t("docs.sso_multi_title", "Multi-company (several environments)")}</h3>
            <p className="text-aurora-ink-2">{t("docs.sso_multi", "One single integration covers your whole organization: domains and the Entra application are configured once, from any environment. Access scopes (global or per-environment) are controlled by the default role or by each group mapping — you do not need one Entra app per environment.")}</p>

            <p className="text-xs text-aurora-ink-3">{t("docs.sso_security", "We validate the OIDC ID token (RS256) against your tenant's JWKS, enforce nonce and PKCE (S256). The client secret is stored encrypted with Fernet (AES-128-CBC + HMAC-SHA256). After the Microsoft callback, the browser receives a 60-second single-use code exchanged via POST — JWT tokens never transit in URLs.")}</p>
            <p>{t("docs.sso_discover", "Discovery endpoint (no auth required, no secret leaked):")}</p>
            <CodeTabs samples={DISCOVER_SSO} />
          </CardContent>
        </Card>

        <Card id="domains">
          <CardHeader><CardTitle>3. {t("docs.domains", "Domain verification (DNS TXT)")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{t("docs.domains_1", "Add a TXT record to prove ownership of an email domain. Example:")}</p>
            <Code>{`Type:  TXT
Name:  _influconnect-challenge.example.com
Value: influconnect-verification=<TOKEN_SHOWN_IN_UI>`}</Code>
            <p className="text-xs text-aurora-ink-3">{t("docs.domains_2", "We resolve the TXT record server-side. Click Verify after propagation (usually < 5 min).")}</p>
          </CardContent>
        </Card>

        <Card id="api">
          <CardHeader><CardTitle>4. {t("docs.api", "REST API v1")}</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>{t("docs.api_intro", "Base URL:")} <code>https://api.influconnect.app/api/v1</code></p>

            <h3 className="font-semibold mt-2">Campaigns</h3>
            <ul className="text-xs space-y-1">
              <li><code>GET /campaigns/</code> — list (scope <code>campaigns:read</code>)</li>
              <li><code>POST /campaigns/create/</code> — create (scope <code>campaigns:write</code>)</li>
              <li><code>GET /campaigns/{"{id}"}/</code> — retrieve</li>
              <li><code>PATCH /campaigns/{"{id}"}/status/</code> — change status (fires <code>campaign.status_changed</code>)</li>
              <li><code>GET /campaigns/{"{id}"}/report/</code> — proposals KPIs (scope <code>reporting:read</code>)</li>
            </ul>
            <h3 className="font-semibold mt-2">Proposals</h3>
            <ul className="text-xs space-y-1">
              <li><code>GET /proposals/?campaign_id=&status=</code> — list (scope <code>proposals:read</code>)</li>
              <li><code>GET /proposals/{"{id}"}/</code> — retrieve</li>
            </ul>
            <h3 className="font-semibold mt-2">Influencers</h3>
            <ul className="text-xs space-y-1">
              <li><code>GET /influencers/?theme=beauty&min_followers=10000</code> — discover (scope <code>influencers:read</code>)</li>
              <li><code>GET /influencers/{"{id}"}/</code> — profile</li>
              <li><code>GET /influencers/{"{id}"}/stats/</code> — audience &amp; engagement</li>
              <li><code>POST /influencers/{"{id}"}/verify/</code> — request verification (scope <code>influencers:verify</code>, fires <code>influencer.verified</code>)</li>
            </ul>

            <h3 className="font-semibold mt-4">{t("docs.api_example_create", "Example — create a campaign")}</h3>
            <CodeTabs samples={CREATE_CAMPAIGN} />

            <h3 className="font-semibold mt-4">{t("docs.api_example_verify", "Example — verify an influencer")}</h3>
            <CodeTabs samples={VERIFY_INFLUENCER} />
          </CardContent>
        </Card>

        <Card id="webhooks">
          <CardHeader><CardTitle>5. {t("docs.webhooks", "Webhooks")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{t("docs.webhooks_1", "Create an endpoint in Integrations → Webhooks, pick the events you care about, and store the signing secret shown once at creation.")}</p>
            <p>{t("docs.webhooks_2", "Each delivery includes:")}</p>
            <ul className="text-xs list-disc pl-5">
              <li><code>X-InfluConnect-Event</code> — event name</li>
              <li><code>X-InfluConnect-Delivery</code> — delivery ID (use for idempotency)</li>
              <li><code>X-InfluConnect-Signature</code> — <code>t=&lt;unix_ts&gt;,v1=&lt;hex_hmac_sha256&gt;</code></li>
            </ul>
            <p>{t("docs.webhooks_verify", "Verify the signature in your stack:")}</p>
            <CodeTabs samples={WEBHOOK_VERIFY} />
            <p className="text-xs text-aurora-ink-3">{t("docs.webhooks_retry", "Retries: 6 attempts with exponential backoff (30s, 2m, 10m, 1h, 6h, 24h). Respond with HTTP 2xx to acknowledge.")}</p>
            <h3 className="font-semibold mt-2">{t("docs.webhooks_events", "Available events")}</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
              <span>proposal.created</span><span>proposal.accepted</span>
              <span>proposal.declined</span><span>proposal.counter_offer</span>
              <span>content.submitted</span><span>content.validated</span>
              <span>content.rejected</span><span>contract.signed</span>
              <span>escrow.funded</span><span>payment.released</span>
              <span>campaign.status_changed</span><span>influencer.verified</span>
              <span>agency.delegation.accepted</span><span>webhook.test</span>
            </div>
          </CardContent>
        </Card>

        <Card id="errors">
          <CardHeader><CardTitle>6. {t("docs.errors", "Errors")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{t("docs.errors_1", "Errors are returned as JSON with a stable code:")}</p>
            <Code>{`{ "error": { "code": "invalid_status", "message": "Unknown status" } }`}</Code>
            <ul className="text-xs list-disc pl-5 space-y-1">
              <li><code>401</code> — missing / invalid / revoked API key, or IP not allowed</li>
              <li><code>403</code> — key valid but missing scope</li>
              <li><code>404</code> — resource not found or not owned by your brand</li>
              <li><code>429</code> — rate limit exceeded</li>
              <li><code>5xx</code> — InfluConnect issue, safe to retry with backoff</li>
            </ul>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-aurora-ink-3 pt-8">
          {t("docs.footer_help", "Questions?")} <Link to="/contact" className="text-aurora-blue hover:underline">{t("docs.footer_contact", "Contact our team")}</Link>
        </p>
      </div>
    </div>
  )
}
