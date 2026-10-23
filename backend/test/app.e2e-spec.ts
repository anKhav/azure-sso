import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import request from "supertest";
import { SignedXml } from "xml-crypto";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import type { SamlFlowRecord } from "../src/saml/saml-flow.model";

describe("Azure SAML test API", () => {
  let app: INestApplication;
  let temporaryDirectory: string;
  let certificatePath: string;
  let privateKeyPath: string;
  let ownerCookie: string;
  let ownerId: string;
  let ssoAppId: string;

  beforeAll(async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "azure-saml-e2e-"));
    certificatePath = join(temporaryDirectory, "idp-cert.pem");
    privateKeyPath = join(temporaryDirectory, "idp-key.pem");
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-keyout",
        privateKeyPath,
        "-out",
        certificatePath,
        "-sha256",
        "-days",
        "1",
        "-nodes",
        "-subj",
        "/CN=Test-IdP",
      ],
      { stdio: "ignore" },
    );
    process.env.DATABASE_DIR = join(temporaryDirectory, "database");
    process.env.CERTIFICATE_UPLOAD_DIR = join(
      temporaryDirectory,
      "certificates",
    );
    process.env.BACKEND_PUBLIC_URL = "https://backend.example.test";
    process.env.FRONTEND_URL = "http://localhost:3000";
    process.env.SESSION_SECRET =
      "test-only-session-secret-with-at-least-32-characters";
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it("registers, validates, authenticates, authorizes, and logs out local users", async () => {
    await request(app.getHttpServer())
      .post("/user/register")
      .send({ email: "bad", password: "short" })
      .expect(400)
      .expect(({ body }) =>
        expect(body).toMatchObject({ error: true, code: "VALIDATION_ERROR" }),
      );

    const registration = await request(app.getHttpServer())
      .post("/user/register")
      .send({ email: "Owner@Example.com", password: "Password123!" })
      .expect(201);
    ownerCookie = registration.headers["set-cookie"][0].split(";")[0];
    ownerId = registration.body.user.id;
    expect(registration.body.user).toMatchObject({
      email: "owner@example.com",
    });
    expect(registration.body.user).not.toHaveProperty("passwordHash");

    await request(app.getHttpServer())
      .post("/user/register")
      .send({ email: "OWNER@example.com", password: "Password123!" })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe("EMAIL_ALREADY_REGISTERED"));
    await request(app.getHttpServer())
      .post("/user/login")
      .send({ email: "owner@example.com", password: "wrong-password" })
      .expect(401)
      .expect(({ body }) => expect(body.code).toBe("INVALID_CREDENTIALS"));
    await request(app.getHttpServer())
      .get(`/user/${crypto.randomUUID()}`)
      .set("Cookie", ownerCookie)
      .expect(403);
    await request(app.getHttpServer())
      .get("/user/me")
      .set("Cookie", ownerCookie)
      .expect(200)
      .expect(({ body }) => expect(body.user.id).toBe(ownerId));
    await request(app.getHttpServer())
      .post("/user/logout")
      .set("Cookie", ownerCookie)
      .set("Origin", "http://localhost:3000")
      .expect(204)
      .expect(({ headers }) =>
        expect(headers["set-cookie"][0]).toContain("Expires=Thu, 01 Jan 1970"),
      );
  });

  it("requires authentication and validates X.509 certificates for SSO apps", async () => {
    await request(app.getHttpServer()).get("/sso/app").expect(401);
    await request(app.getHttpServer())
      .post("/sso/app/create")
      .set("Cookie", ownerCookie)
      .set("Origin", "http://localhost:3000")
      .field("name", "Broken")
      .field("loginUrl", "https://login.example.test/saml2")
      .field("applicationId", "broken-client")
      .field("azureIssuer", "https://issuer.example.test/")
      .attach("certificate", Buffer.from("not a certificate"), "broken.cer")
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe("INVALID_CERTIFICATE"));

    const created = await request(app.getHttpServer())
      .post("/sso/app/create")
      .set("Cookie", ownerCookie)
      .set("Origin", "http://localhost:3000")
      .field("name", "Softimpact")
      .field("loginUrl", "https://login.example.test/saml2")
      .field("applicationId", "azure-client-id")
      .field("azureIssuer", "https://issuer.example.test/")
      .attach("certificate", certificatePath)
      .expect(201);
    ssoAppId = created.body.id;
    expect(created.body).toMatchObject({
      entityId: `https://backend.example.test/saml/metadata/${ssoAppId}`,
      acsUrl: `https://backend.example.test/saml/acs/${ssoAppId}`,
    });
    expect(created.body).not.toHaveProperty("certificatePath");
    await request(app.getHttpServer())
      .post("/sso/app/create")
      .set("Cookie", ownerCookie)
      .set("Origin", "http://localhost:3000")
      .field("name", "softIMPACT")
      .field("loginUrl", "https://login.example.test/saml2")
      .field("applicationId", "other-client")
      .field("azureIssuer", "https://issuer.example.test/")
      .attach("certificate", certificatePath)
      .expect(409);
  });

  it("generates matching metadata and correlated AuthnRequests and blocks open redirects", async () => {
    const metadata = await request(app.getHttpServer())
      .get(`/saml/metadata/${ssoAppId}`)
      .expect(200);
    expect(metadata.text).toContain(
      `entityID="https://backend.example.test/saml/metadata/${ssoAppId}"`,
    );
    expect(metadata.text).toContain(
      `Location="https://backend.example.test/saml/acs/${ssoAppId}"`,
    );
    expect(metadata.text).toContain('AuthnRequestsSigned="false"');
    expect(metadata.text).not.toContain("X509Certificate");

    await request(app.getHttpServer())
      .get("/user/sso/login")
      .query({
        appName: "Softimpact",
        redirectUrl: "https://evil.example/sso/result",
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe("INVALID_REDIRECT_URL"));
    const start = await request(app.getHttpServer())
      .get("/user/sso/login")
      .query({
        appName: "softIMPACT",
        redirectUrl: "http://localhost:3000/sso/result",
      })
      .expect(302);
    const location = new URL(start.headers.location);
    expect(location.origin + location.pathname).toBe(
      "https://login.example.test/saml2",
    );
    const requestXml = inflateRawSync(
      Buffer.from(location.searchParams.get("SAMLRequest")!, "base64"),
    ).toString("utf8");
    expect(requestXml).toContain(
      `AssertionConsumerServiceURL="https://backend.example.test/saml/acs/${ssoAppId}"`,
    );
    expect(requestXml).toContain(
      `>https://backend.example.test/saml/metadata/${ssoAppId}</saml:Issuer>`,
    );
    const flows = JSON.parse(
      readFileSync(
        join(temporaryDirectory, "database", "saml-flows.json"),
        "utf8",
      ),
    ) as SamlFlowRecord[];
    const flow = flows.find(
      (candidate) =>
        candidate.flowId === location.searchParams.get("RelayState"),
    );
    expect(flow).toMatchObject({
      appId: ssoAppId,
      operation: "login",
      redirectUrl: "http://localhost:3000/sso/result",
    });
    expect(requestXml).toContain(`ID="${flow?.requestId}"`);
  });

  it("binds registration to the authenticated local user", async () => {
    await request(app.getHttpServer())
      .post("/user/sso/register")
      .set("Cookie", ownerCookie)
      .set("Origin", "http://localhost:3000")
      .type("form")
      .send({
        userId: crypto.randomUUID(),
        appId: ssoAppId,
        redirectUrl: "http://localhost:3000/sso/result",
      })
      .expect(403);
    await request(app.getHttpServer())
      .post("/user/sso/register")
      .set("Cookie", ownerCookie)
      .set("Origin", "http://localhost:3000")
      .type("form")
      .send({
        userId: ownerId,
        appId: ssoAppId,
        redirectUrl: "http://localhost:3000/sso/result",
      })
      .expect(302);
  });

  it("accepts signed assertions for linking and login, rejects tampering, and prevents replay", async () => {
    const registrationStart = await request(app.getHttpServer())
      .post("/user/sso/register")
      .set("Cookie", ownerCookie)
      .set("Origin", "http://localhost:3000")
      .type("form")
      .send({
        userId: ownerId,
        appId: ssoAppId,
        redirectUrl: "http://localhost:3000/sso/result",
      })
      .expect(302);
    const registrationLocation = new URL(registrationStart.headers.location);
    const registrationFlow = latestFlow(
      registrationLocation.searchParams.get("RelayState")!,
    );
    const registrationResponse = signedResponse(
      registrationFlow,
      "stable-azure-subject",
    );
    const linked = await request(app.getHttpServer())
      .post(`/saml/acs/${ssoAppId}`)
      .type("form")
      .send({
        RelayState: registrationFlow.flowId,
        SAMLResponse: registrationResponse,
      })
      .expect(302);
    expect(linked.headers.location).toBe(
      "http://localhost:3000/sso/result?status=success",
    );
    expect(linked.headers["set-cookie"][0]).toContain("HttpOnly");
    await request(app.getHttpServer())
      .get("/user/sso/links")
      .set("Cookie", ownerCookie)
      .expect(200)
      .expect(({ body }) => expect(body).toHaveLength(1));

    const loginStart = await request(app.getHttpServer())
      .get("/user/sso/login")
      .query({
        appName: "Softimpact",
        redirectUrl: "http://localhost:3000/sso/result",
      })
      .expect(302);
    const loginFlow = latestFlow(
      new URL(loginStart.headers.location).searchParams.get("RelayState")!,
    );
    const login = await request(app.getHttpServer())
      .post(`/saml/acs/${ssoAppId}`)
      .type("form")
      .send({
        RelayState: loginFlow.flowId,
        SAMLResponse: signedResponse(loginFlow, "stable-azure-subject"),
      })
      .expect(302);
    expect(login.headers.location).toContain("status=success");
    expect(login.headers["set-cookie"][0]).not.toContain(
      "stable-azure-subject",
    );

    const tamperStart = await request(app.getHttpServer())
      .get("/user/sso/login")
      .query({
        appName: "Softimpact",
        redirectUrl: "http://localhost:3000/sso/result",
      })
      .expect(302);
    const tamperFlow = latestFlow(
      new URL(tamperStart.headers.location).searchParams.get("RelayState")!,
    );
    const signed = Buffer.from(
      signedResponse(tamperFlow, "stable-azure-subject"),
      "base64",
    ).toString("utf8");
    const tampered = Buffer.from(
      signed.replace("stable-azure-subject", "tampered-subject"),
    ).toString("base64");
    const rejected = await request(app.getHttpServer())
      .post(`/saml/acs/${ssoAppId}`)
      .type("form")
      .send({ RelayState: tamperFlow.flowId, SAMLResponse: tampered })
      .expect(302);
    expect(rejected.headers.location).toContain("code=SAML_VALIDATION_FAILED");
    await request(app.getHttpServer())
      .post(`/saml/acs/${ssoAppId}`)
      .type("form")
      .send({ RelayState: tamperFlow.flowId, SAMLResponse: tampered })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe("SAML_FLOW_REPLAYED"));
  });

  function latestFlow(flowId: string): SamlFlowRecord {
    const flows = JSON.parse(
      readFileSync(
        join(temporaryDirectory, "database", "saml-flows.json"),
        "utf8",
      ),
    ) as SamlFlowRecord[];
    const flow = flows.find((candidate) => candidate.flowId === flowId);
    if (!flow) throw new Error("Expected SAML flow was not persisted");
    return flow;
  }

  function signedResponse(flow: SamlFlowRecord, nameId: string): string {
    const now = new Date();
    const notBefore = new Date(now.getTime() - 30_000).toISOString();
    const expires = new Date(now.getTime() + 120_000).toISOString();
    const acs = `https://backend.example.test/saml/acs/${ssoAppId}`;
    const audience = `https://backend.example.test/saml/metadata/${ssoAppId}`;
    const assertionId = `_${crypto.randomUUID().replaceAll("-", "")}`;
    const responseId = `_${crypto.randomUUID().replaceAll("-", "")}`;
    const xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${responseId}" Version="2.0" IssueInstant="${now.toISOString()}" Destination="${acs}" InResponseTo="${flow.requestId}"><saml:Issuer>https://issuer.example.test/</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status><saml:Assertion ID="${assertionId}" Version="2.0" IssueInstant="${now.toISOString()}"><saml:Issuer>https://issuer.example.test/</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent">${nameId}</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData InResponseTo="${flow.requestId}" Recipient="${acs}" NotOnOrAfter="${expires}"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${expires}"><saml:AudienceRestriction><saml:Audience>${audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="${now.toISOString()}" SessionIndex="test-session"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion></samlp:Response>`;
    const signer = new SignedXml({
      privateKey: readFileSync(privateKeyPath, "utf8"),
    });
    signer.signatureAlgorithm =
      "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
    signer.canonicalizationAlgorithm =
      "http://www.w3.org/2001/10/xml-exc-c14n#";
    signer.addReference({
      xpath: "//*[local-name()='Assertion']",
      digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
      transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/2001/10/xml-exc-c14n#",
      ],
    });
    signer.computeSignature(xml, {
      location: {
        reference: "//*[local-name()='Assertion']/*[local-name()='Issuer']",
        action: "after",
      },
    });
    return Buffer.from(signer.getSignedXml()).toString("base64");
  }
});
