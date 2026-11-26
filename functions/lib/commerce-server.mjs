/* Bundled Express Commerce Server for Firebase Cloud Functions */

// server.ts
import express from "express";
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import fs3 from "node:fs";
import path3 from "node:path";

// server/payments/adapters.ts
import crypto from "node:crypto";
function timingSafeCompareHex(a, b) {
  const bufA = Buffer.from(a.trim().toLowerCase(), "utf8");
  const bufB = Buffer.from(b.trim().toLowerCase(), "utf8");
  if (bufA.length !== bufB.length || bufA.length === 0) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
function getHeaderString(headers, name) {
  const val = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(val) ? val[0] || "" : val || "";
}
function getSlGatewaySecret(sandboxMode) {
  const envSecret = process.env.SL_GATEWAY_SECRET?.trim();
  if (envSecret) {
    return envSecret;
  }
  if (sandboxMode) {
    return SANDBOX_EPHEMERAL_KEYS.sl;
  }
  throw new Error("SL_GATEWAY_SECRET is not configured on the server.");
}
function getIntlWebhookSecret(sandboxMode) {
  const envSecret = process.env.INTL_GATEWAY_WEBHOOK_SECRET?.trim();
  if (envSecret) {
    return envSecret;
  }
  if (sandboxMode) {
    return SANDBOX_EPHEMERAL_KEYS.intl;
  }
  throw new Error("INTL_GATEWAY_WEBHOOK_SECRET is not configured on the server.");
}
var SANDBOX_EPHEMERAL_KEYS = {
  sl: crypto.randomBytes(32).toString("hex"),
  intl: crypto.randomBytes(32).toString("hex")
};
var whatsappOrderAdapter = {
  id: "whatsapp_order",
  displayName: "WhatsApp Direct Concierge Order",
  isConfiguredForLive: () => true,
  initiatePayment: (_order, settings) => ({
    paymentStatus: "pending",
    orderStatus: "new",
    instructions: `Order recorded as New. Continue on WhatsApp (+${settings.whatsappNumber}) for concierge verification & dispatch confirmation.`,
    requiresVerification: true
  })
};
var bankTransferAdapter = {
  id: "bank_transfer",
  displayName: "Bank Transfer / Direct Deposit",
  isConfiguredForLive: () => true,
  initiatePayment: (_order, settings, input) => {
    const hasProof = Boolean(input.paymentReference?.trim() || input.hasSlip);
    const details = settings.payment.bankDetails;
    return {
      paymentStatus: "pending_verification",
      orderStatus: hasProof ? "payment_verification" : "awaiting_payment",
      transactionRef: input.paymentReference?.trim() || void 0,
      instructions: `${details.bankName} \xB7 Acc: ${details.accountNumber} (${details.accountName})`,
      requiresVerification: true
    };
  }
};
var codAdapter = {
  id: "cod",
  displayName: "Payment on Delivery (Sri Lanka)",
  isConfiguredForLive: () => true,
  initiatePayment: () => ({
    paymentStatus: "pending",
    orderStatus: "pending",
    instructions: "Cash or verified mobile transfer due upon islandwide courier delivery.",
    requiresVerification: false
  })
};
var slGatewayAdapter = {
  id: "sl_gateway",
  displayName: "Sri Lankan Payment Gateway Adapter",
  isConfiguredForLive: () => Boolean(process.env.SL_GATEWAY_MERCHANT_ID?.trim() && process.env.SL_GATEWAY_SECRET?.trim()),
  initiatePayment: (order, settings) => {
    if (!settings.payment.sandboxMode && !slGatewayAdapter.isConfiguredForLive()) {
      throw new Error("Live Sri Lankan gateway requires server merchant credentials.");
    }
    return {
      paymentStatus: "pending",
      orderStatus: "awaiting_payment",
      transactionRef: `SL-INTENT-${order.orderRef}`,
      instructions: settings.payment.sandboxMode ? "Sandbox payment intent created. Awaiting verified server webhook callback." : "Redirecting to verified Sri Lankan gateway session.",
      requiresVerification: true
    };
  },
  verifyWebhook: (rawBody, headers, settings) => {
    const sig = getHeaderString(headers, "x-sl-gateway-signature");
    if (!sig) {
      throw new Error("Missing Sri Lankan gateway webhook signature.");
    }
    const secret = getSlGatewaySecret(settings.payment.sandboxMode);
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!timingSafeCompareHex(sig, expected)) {
      throw new Error("Invalid Sri Lankan gateway HMAC signature.");
    }
    const body = JSON.parse(rawBody);
    if (!body.eventId || !body.orderRef || typeof body.amount !== "number" || !body.currency) {
      throw new Error("Malformed Sri Lankan gateway webhook payload.");
    }
    const outcome = body.statusCode === "2" ? "paid" : body.statusCode === "-3" ? "refunded" : "failed";
    return {
      eventId: body.eventId,
      provider: "sl_gateway",
      orderRef: body.orderRef,
      outcome,
      amount: body.amount,
      currency: body.currency,
      transactionRef: body.transactionRef || body.eventId,
      rawSummary: `SL Gateway statusCode=${body.statusCode}`
    };
  },
  createSandboxSignedWebhook: (params) => {
    const payload = JSON.stringify({
      eventId: params.eventId,
      orderRef: params.orderRef,
      statusCode: params.outcome === "paid" ? "2" : "-2",
      amount: params.amount,
      currency: params.currency,
      transactionRef: params.transactionRef
    });
    const sig = crypto.createHmac("sha256", SANDBOX_EPHEMERAL_KEYS.sl).update(payload).digest("hex");
    return {
      payload,
      headers: { "x-sl-gateway-signature": sig }
    };
  }
};
var intlGatewayAdapter = {
  id: "intl_gateway",
  displayName: "International Payment Gateway Adapter",
  isConfiguredForLive: () => Boolean(
    process.env.INTL_GATEWAY_SECRET?.trim() && process.env.INTL_GATEWAY_WEBHOOK_SECRET?.trim()
  ),
  initiatePayment: (order, settings) => {
    if (!settings.payment.sandboxMode && !intlGatewayAdapter.isConfiguredForLive()) {
      throw new Error("Live international gateway requires server credentials.");
    }
    return {
      paymentStatus: "pending",
      orderStatus: "awaiting_payment",
      transactionRef: `INTL-INTENT-${order.orderRef}`,
      instructions: settings.payment.sandboxMode ? "Sandbox international payment intent initialized. Awaiting signed webhook." : "Hosted international payment session initialized.",
      requiresVerification: true
    };
  },
  verifyWebhook: (rawBody, headers, settings) => {
    const headerVal = getHeaderString(headers, "x-intl-signature");
    const parts = Object.fromEntries(
      headerVal.split(",").map((kv) => {
        const idx = kv.indexOf("=");
        return idx > 0 ? [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()] : [kv, ""];
      })
    );
    const timestamp = Number(parts.t);
    const v1 = parts.v1 || "";
    if (!timestamp || !v1 || Math.abs(Math.floor(Date.now() / 1e3) - timestamp) > 300) {
      throw new Error("Missing, expired, or invalid international gateway webhook timestamp.");
    }
    const secret = getIntlWebhookSecret(settings.payment.sandboxMode);
    const signedPayload = `${timestamp}.${rawBody}`;
    const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
    if (!timingSafeCompareHex(v1, expected)) {
      throw new Error("Invalid international gateway HMAC signature.");
    }
    const body = JSON.parse(rawBody);
    if (!body.eventId || !body.orderRef || typeof body.amount !== "number" || !body.currency) {
      throw new Error("Malformed international gateway webhook payload.");
    }
    const outcome = body.eventType === "payment_intent.succeeded" ? "paid" : body.eventType === "charge.refunded" ? "refunded" : "failed";
    return {
      eventId: body.eventId,
      provider: "intl_gateway",
      orderRef: body.orderRef,
      outcome,
      amount: body.amount,
      currency: body.currency,
      transactionRef: body.transactionRef || body.eventId,
      rawSummary: `Intl Gateway event=${body.eventType}`
    };
  },
  createSandboxSignedWebhook: (params) => {
    const timestamp = Math.floor(Date.now() / 1e3);
    const payload = JSON.stringify({
      eventId: params.eventId,
      orderRef: params.orderRef,
      eventType: params.outcome === "paid" ? "payment_intent.succeeded" : "payment_intent.payment_failed",
      amount: params.amount,
      currency: params.currency,
      transactionRef: params.transactionRef
    });
    const sig = crypto.createHmac("sha256", SANDBOX_EPHEMERAL_KEYS.intl).update(`${timestamp}.${payload}`).digest("hex");
    return {
      payload,
      headers: { "x-intl-signature": `t=${timestamp},v1=${sig}` }
    };
  }
};
var PAYMENT_ADAPTERS = {
  whatsapp_order: whatsappOrderAdapter,
  bank_transfer: bankTransferAdapter,
  cod: codAdapter,
  sl_gateway: slGatewayAdapter,
  intl_gateway: intlGatewayAdapter
};

// server/portfolios.ts
import crypto3 from "node:crypto";

// server/pdfGenerator.ts
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
var DEFAULT_PORTFOLIO_FIELDS = {
  sku: true,
  category: true,
  description: true,
  highlights: true,
  ingredients: true,
  origin: true,
  packSizes: true,
  packagingType: true,
  storageInstructions: true,
  shelfLife: true,
  netWeight: true,
  retailPrices: true,
  wholesalePrices: false,
  // Confidential wholesale/export pricing OFF by default
  moq: false,
  technicalSpecs: true,
  certifications: true
};
var BRAND_THEMES = {
  ceyvana: {
    id: "ceyvana",
    nameEn: "CEYVANA",
    nameSi: "\u0DC3\u0DD9\u0DBA\u0DD2\u0DC0\u0DCF\u0DB1\u0DCF (CEYVANA)",
    taglineEn: "Heritage Spices & Culinary Treasures of Ceylon",
    taglineSi: "\u0DBD\u0D82\u0D9A\u0DCF \u0DB4\u0DCF\u0DBB\u0DB8\u0DCA\u0DB4\u0DBB\u0DD2\u0D9A \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0DC3\u0DC4 \u0D86\u0DC4\u0DCF\u0DBB \u0DBB\u0DC3\u0D9A\u0DCF\u0DBB\u0D9A \u0D91\u0D9A\u0DAD\u0DD4\u0DC0",
    defaultIntroEn: "Ceyvana curates single-origin Sri Lankan spices harvested across coastal Matara gardens, central Kandy spice estates, and dry-zone farms. Graded, cleaned, and sealed at origin to preserve authentic aroma and culinary integrity.",
    defaultIntroSi: "\u0DC3\u0DD9\u0DBA\u0DD2\u0DC0\u0DCF\u0DB1\u0DCF \u0DB8\u0DCF\u0DAD\u0DBB, \u0DB8\u0DC4\u0DB1\u0DD4\u0DC0\u0DBB \u0DC3\u0DC4 \u0D8B\u0DAD\u0DD4\u0DBB\u0DD4-\u0DB8\u0DD0\u0DAF \u0DB4\u0DCA\u200D\u0DBB\u0DAF\u0DDA\u0DC1\u0DC0\u0DBD\u0DD2\u0DB1\u0DCA \u0DB1\u0DD9\u0DC5\u0DCF\u0D9C\u0DAD\u0DCA \u0DB4\u0DD2\u0DBB\u0DD2\u0DC3\u0DD2\u0DAF\u0DD4 \u0DC1\u0DCA\u200D\u0DBB\u0DD3 \u0DBD\u0DCF\u0D82\u0D9A\u0DD2\u0D9A \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0DC3\u0DCA\u0DC0\u0DB7\u0DCF\u0DC0\u0DD2\u0D9A \u0DC3\u0DD4\u0DC0\u0DB3 \u0DC3\u0DC4 \u0D9C\u0DD4\u0DAB\u0DCF\u0DAD\u0DCA\u0DB8\u0D9A\u0DB7\u0DCF\u0DC0\u0DBA \u0DBB\u0DD0\u0D9A\u0DD9\u0DB1 \u0DB4\u0DBB\u0DD2\u0DAF\u0DD2 \u0DC3\u0DD8\u0DA2\u0DD4\u0DC0\u0DB8 \u0D89\u0DAF\u0DD2\u0DBB\u0DD2\u0DB4\u0DAD\u0DCA \u0D9A\u0DBB\u0DBA\u0DD2.",
    heroImagePath: "/src/assets/images/brand_ceyvana_spices_1795545289791.jpg",
    primary: "#6E1924",
    secondary: "#3A2113",
    accent: "#C49A45",
    surface: "#FAF6F0",
    tint: "#F3ECE1",
    ink: "#22150E",
    muted: "#665043",
    border: "#DFCDAE"
  },
  ceylomira: {
    id: "ceylomira",
    nameEn: "CEYLOMIRA",
    nameSi: "\u0DC3\u0DD9\u0DBA\u0DD2\u0DBD\u0DDD\u0DB8\u0DD2\u0DBB\u0DCF (CEYLOMIRA)",
    taglineEn: "Single-Estate Ceylon Teas & Botanical Infusions",
    taglineSi: "\u0DAD\u0DDD\u0DBB\u0DCF\u0D9C\u0DAD\u0DCA \u0DC3\u0DD2\u0DBD\u0DDD\u0DB1\u0DCA \u0DAD\u0DDA \u0DC3\u0DC4 \u0DC3\u0DCA\u0DC0\u0DB7\u0DCF\u0DC0\u0DD2\u0D9A \u0DC1\u0DCF\u0D9A\u0DC3\u0DCF\u0DBB \u0DB4\u0DCF\u0DB1",
    defaultIntroEn: "Ceylomira brings together single-estate orthodox black teas, high-grown silver tips, and heritage Sri Lankan botanical infusions packed close to harvest to preserve clarity, briskness, and floral aroma.",
    defaultIntroSi: "\u0DC3\u0DD9\u0DBA\u0DD2\u0DBD\u0DDD\u0DB8\u0DD2\u0DBB\u0DCF \u0D8B\u0DA9\u0DBB\u0DA7 \u0DC3\u0DC4 \u0DB4\u0DC4\u0DAD\u0DBB\u0DA7 \u0DC0\u0DAD\u0DD4\u0DBA\u0DCF\u0DBA\u0DB1\u0DCA\u0D9C\u0DD9\u0DB1\u0DCA \u0DB1\u0DD9\u0DC5\u0DCF\u0D9C\u0DAD\u0DCA \u0DB4\u0DD2\u0DBB\u0DD2\u0DC3\u0DD2\u0DAF\u0DD4 \u0DC3\u0DD2\u0DBD\u0DDD\u0DB1\u0DCA \u0DAD\u0DDA \u0DC3\u0DC4 \u0DAF\u0DDA\u0DC1\u0DD3\u0DBA \u0D94\u0DC3\u0DD4 \u0DB4\u0DCF\u0DB1 \u0DC3\u0DCA\u0DC0\u0DB7\u0DCF\u0DC0\u0DD2\u0D9A \u0DB1\u0DD0\u0DC0\u0DD4\u0DB8\u0DCA\u0DB6\u0DC0 \u0DC3\u0DB8\u0D9F \u0DB4\u0DD2\u0DBB\u0DD2\u0DB1\u0DB8\u0DBA\u0DD2.",
    heroImagePath: "/src/assets/images/brand_ceylomira_tea_1795545290271.jpg",
    primary: "#0E3324",
    secondary: "#172820",
    accent: "#B87A43",
    surface: "#F7F4EC",
    tint: "#ECE8DC",
    ink: "#13221A",
    muted: "#4A5B50",
    border: "#D5CBB7"
  },
  "hand-crafts": {
    id: "hand-crafts",
    nameEn: "CEYLON HAND CRAFTS",
    nameSi: "\u0DBD\u0D82\u0D9A\u0DCF \u0DC4\u0DC3\u0DCA\u0DAD \u0D9A\u0DBB\u0DCA\u0DB8\u0DCF\u0DB1\u0DCA\u0DAD",
    taglineEn: "Authentic Artisan Woodwork, Brass & Heritage Craft",
    taglineSi: "\u0DC3\u0DCF\u0DB8\u0DCA\u0DB4\u0DCA\u200D\u0DBB\u0DAF\u0DCF\u0DBA\u0DD2\u0D9A \u0D9A\u0DD0\u0DA7\u0DBA\u0DB8\u0DCA, \u0DB4\u0DD2\u0DAD\u0DCA\u0DAD\u0DBD \u0DC3\u0DC4 \u0D85\u0DAD\u0DCA\u0D9A\u0DB8\u0DCA \u0DB1\u0DD2\u0DBB\u0DCA\u0DB8\u0DCF\u0DAB",
    defaultIntroEn: "Curated Sri Lankan artisanal homeware crafted by master woodcarvers, brassware guilds, and handloom weavers using seasoned local materials.",
    defaultIntroSi: "\u0DC1\u0DCA\u200D\u0DBB\u0DD3 \u0DBD\u0DCF\u0D82\u0D9A\u0DD2\u0D9A \u0DB4\u0DCF\u0DBB\u0DB8\u0DCA\u0DB4\u0DBB\u0DD2\u0D9A \u0DC1\u0DD2\u0DBD\u0DCA\u0DB4\u0DD3\u0DB1\u0DCA\u0D9C\u0DDA \u0DAF\u0DD1\u0DAD\u0DD2\u0DB1\u0DCA \u0DB1\u0DD2\u0DB8\u0DD0\u0DC0\u0DD4\u0DAB\u0DD4 \u0DBD\u0DD3 \u0D9A\u0DD0\u0DA7\u0DBA\u0DB8\u0DCA, \u0DB4\u0DD2\u0DAD\u0DCA\u0DAD\u0DBD \u0DC3\u0DC4 \u0D85\u0DAD\u0DCA\u0D9A\u0DB8\u0DCA \u0DB1\u0DD2\u0DBB\u0DCA\u0DB8\u0DCF\u0DAB \u0D91\u0D9A\u0DAD\u0DD4\u0DC0.",
    heroImagePath: "/src/assets/images/hero_ceylon_heritage_1795545289913.jpg",
    primary: "#5D402C",
    secondary: "#2B1F16",
    accent: "#B59148",
    surface: "#FAF6EE",
    tint: "#EFE8DB",
    ink: "#211811",
    muted: "#645243",
    border: "#DDD0BA"
  }
};
var FONT_KEYS = {
  serif: "SerifRegular",
  serifBold: "SerifBold",
  serifItalic: "SerifItalic",
  sans: "SansRegular",
  sansBold: "SansBold",
  siSerif: "SinhalaSerifRegular",
  siSerifBold: "SinhalaSerifBold",
  siSans: "SinhalaSansRegular",
  siSansBold: "SinhalaSansBold"
};
function resolveFontsDir() {
  const candidates = [
    path.resolve(process.cwd(), "server/fonts"),
    path.resolve(import.meta.dirname || process.cwd(), "fonts"),
    path.resolve(process.cwd(), "fonts")
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "NotoSans-Regular.ttf"))) {
      return dir;
    }
  }
  throw new Error("Embedded PDF TrueType fonts not found in server/fonts/.");
}
function registerFonts(doc) {
  const dir = resolveFontsDir();
  doc.registerFont(FONT_KEYS.serif, path.join(dir, "NotoSerif-Regular.ttf"));
  doc.registerFont(FONT_KEYS.serifBold, path.join(dir, "NotoSerif-Bold.ttf"));
  doc.registerFont(FONT_KEYS.serifItalic, path.join(dir, "NotoSerif-Italic.ttf"));
  doc.registerFont(FONT_KEYS.sans, path.join(dir, "NotoSans-Regular.ttf"));
  doc.registerFont(FONT_KEYS.sansBold, path.join(dir, "NotoSans-Bold.ttf"));
  doc.registerFont(FONT_KEYS.siSerif, path.join(dir, "NotoSerifSinhala-Regular.ttf"));
  doc.registerFont(FONT_KEYS.siSerifBold, path.join(dir, "NotoSerifSinhala-Bold.ttf"));
  doc.registerFont(FONT_KEYS.siSans, path.join(dir, "NotoSansSinhala-Regular.ttf"));
  doc.registerFont(FONT_KEYS.siSansBold, path.join(dir, "NotoSansSinhala-Bold.ttf"));
}
function normalizePdfText(raw) {
  return String(raw || "").replace(/\u00B7/g, " | ").replace(/\u2022/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u00A0/g, " ").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}
function pickFontKey(role, bold, italic, isSinhala) {
  if (isSinhala) {
    if (role === "serif") {
      return bold ? FONT_KEYS.siSerifBold : FONT_KEYS.siSerif;
    }
    return bold ? FONT_KEYS.siSansBold : FONT_KEYS.siSans;
  }
  if (role === "serif") {
    if (bold) return FONT_KEYS.serifBold;
    if (italic) return FONT_KEYS.serifItalic;
    return FONT_KEYS.serif;
  }
  return bold ? FONT_KEYS.sansBold : FONT_KEYS.sans;
}
function splitIntoScriptSegments(text) {
  const clean = normalizePdfText(text);
  const matches = clean.match(/[\u0D80-\u0DFF\u200D]+|[^\u0D80-\u0DFF\u200D]+/g);
  if (!matches) return [];
  return matches.map((m) => ({
    text: m,
    isSinhala: /[\u0D80-\u0DFF]/.test(m)
  }));
}
function measureAndWrapMixedText(doc, rawText, maxWidth, fontSize, role = "sans", bold = false, italic = false, lineHeightRatio = 1.46) {
  const safeMaxWidth = Math.max(24, maxWidth);
  const lineHeight = fontSize * lineHeightRatio;
  const paragraphs = normalizePdfText(rawText).split(/\r?\n/);
  const lines = [];
  doc.fontSize(fontSize);
  for (const para of paragraphs) {
    const trimmedPara = para.trimEnd();
    if (!trimmedPara) {
      lines.push({ runs: [], width: 0 });
      continue;
    }
    const rawWords = trimmedPara.split(/(\s+)/).filter((t) => t.length > 0);
    let currentRuns = [];
    let currentWidth = 0;
    const pushCurrentLine = () => {
      while (currentRuns.length > 0 && /^\s+$/.test(currentRuns[currentRuns.length - 1].text)) {
        const popped = currentRuns.pop();
        currentWidth = Math.max(0, currentWidth - popped.width);
      }
      lines.push({ runs: currentRuns, width: currentWidth });
      currentRuns = [];
      currentWidth = 0;
    };
    const appendToken = (tokenText) => {
      const segs = splitIntoScriptSegments(tokenText);
      const tokenRuns = segs.map((seg) => {
        const fontKey = pickFontKey(role, bold, italic, seg.isSinhala);
        doc.font(fontKey).fontSize(fontSize);
        return {
          text: seg.text,
          isSinhala: seg.isSinhala,
          fontKey,
          width: doc.widthOfString(seg.text)
        };
      });
      const tokenWidth = tokenRuns.reduce((sum, r) => sum + r.width, 0);
      if (currentRuns.length === 0 && /^\s+$/.test(tokenText)) {
        return;
      }
      if (currentWidth + tokenWidth <= safeMaxWidth || currentRuns.length === 0) {
        if (currentRuns.length === 0 && tokenWidth > safeMaxWidth && tokenText.length > 6) {
          let chunk = "";
          for (const ch of Array.from(tokenText)) {
            const test = chunk + ch;
            const testSegs = splitIntoScriptSegments(test);
            let testW = 0;
            for (const s of testSegs) {
              doc.font(pickFontKey(role, bold, italic, s.isSinhala)).fontSize(fontSize);
              testW += doc.widthOfString(s.text);
            }
            if (testW > safeMaxWidth && chunk.length > 0) {
              appendToken(chunk);
              pushCurrentLine();
              chunk = ch;
            } else {
              chunk = test;
            }
          }
          if (chunk) {
            appendToken(chunk);
          }
          return;
        }
        currentRuns.push(...tokenRuns);
        currentWidth += tokenWidth;
      } else {
        pushCurrentLine();
        if (!/^\s+$/.test(tokenText)) {
          appendToken(tokenText);
        }
      }
    };
    for (const word of rawWords) {
      appendToken(word);
    }
    if (currentRuns.length > 0) {
      pushCurrentLine();
    }
  }
  return {
    lines,
    lineHeight,
    totalHeight: Math.max(lineHeight, lines.length * lineHeight)
  };
}
function drawMixedText(doc, rawText, x, y, options) {
  const layout = measureAndWrapMixedText(
    doc,
    rawText,
    options.width,
    options.fontSize,
    options.role ?? "sans",
    Boolean(options.bold),
    Boolean(options.italic),
    options.lineHeightRatio ?? 1.46
  );
  doc.fillColor(options.color);
  layout.lines.forEach((line, lineIdx) => {
    const lineY = y + lineIdx * layout.lineHeight;
    let cursorX = x;
    if (options.align === "center") {
      cursorX = x + Math.max(0, (options.width - line.width) / 2);
    } else if (options.align === "right") {
      cursorX = x + Math.max(0, options.width - line.width);
    }
    for (const run of line.runs) {
      doc.font(run.fontKey).fontSize(options.fontSize).fillColor(options.color).text(run.text, cursorX, lineY, { lineBreak: false });
      cursorX += run.width;
    }
  });
  return y + layout.totalHeight;
}
function isSupportedImageBuffer(buf) {
  if (buf.length < 12) return false;
  if (buf[0] === 255 && buf[1] === 216 && buf[2] === 255) return true;
  if (buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71) return true;
  return false;
}
var ALLOWED_IMAGE_HOSTS = /* @__PURE__ */ new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com"
]);
async function loadImageBuffer(srcPath) {
  if (!srcPath) return null;
  const trimmed = srcPath.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname.toLowerCase())) {
        return null;
      }
      const resp = await fetch(trimmed, { signal: AbortSignal.timeout(3e3) });
      if (!resp.ok) return null;
      const arr = await resp.arrayBuffer();
      if (arr.byteLength > 3 * 1024 * 1024) return null;
      const buf = Buffer.from(arr);
      return isSupportedImageBuffer(buf) ? buf : null;
    } catch {
      return null;
    }
  }
  const rel = trimmed.replace(/^\/+/, "");
  const candidates = [
    path.resolve(process.cwd(), rel),
    path.resolve(process.cwd(), rel.replace(/\.webp$/i, ".jpg")),
    path.resolve(process.cwd(), "public", rel)
  ];
  for (const cand of candidates) {
    if (!cand.startsWith(process.cwd() + path.sep)) continue;
    if (fs.existsSync(cand)) {
      const buf = fs.readFileSync(cand);
      if (isSupportedImageBuffer(buf)) return buf;
    }
  }
  return null;
}
function loc(field, lang) {
  if (!field) return "";
  if (lang === "si" && field.si && field.si.trim()) {
    return field.si.trim();
  }
  return (field.en || field.si || "").trim();
}
function formatPdfPrice(priceUsd, priceLkr, currency, currencyConfig) {
  if (currency === "LKR") {
    return `LKR ${Math.round(priceLkr).toLocaleString("en-US")}`;
  }
  if (currency === "USD") {
    return `$${priceUsd.toFixed(2)}`;
  }
  const symbol = currencyConfig?.symbol || currency;
  const rate = currencyConfig?.ratePerUsd || 1;
  const converted = priceUsd * rate;
  return `${symbol} ${converted.toFixed(2)}`;
}
function formatWholesalePdfPrice(exportPriceUsd, currency, currencyConfig) {
  if (currency === "LKR") {
    const rate2 = currencyConfig?.ratePerUsd || 300;
    return `LKR ${Math.round(exportPriceUsd * rate2).toLocaleString("en-US")} / kg`;
  }
  if (currency === "USD") {
    return `$${exportPriceUsd.toFixed(2)} / kg`;
  }
  const symbol = currencyConfig?.symbol || currency;
  const rate = currencyConfig?.ratePerUsd || 1;
  return `${symbol} ${(exportPriceUsd * rate).toFixed(2)} / kg`;
}
async function generateBrandPortfolioPdf(params) {
  const theme = BRAND_THEMES[params.brandId] ?? BRAND_THEMES.ceyvana;
  const lang = params.language === "si" ? "si" : "en";
  const isLandscape = params.orientation === "landscape";
  const filteredProducts = params.products.filter(
    (p) => p.brandId === params.brandId && !p.isArchived
  );
  if (filteredProducts.length === 0) {
    throw new Error(`No active verified products found for brand "${params.brandId}".`);
  }
  const imageCache = /* @__PURE__ */ new Map();
  const imagePaths = /* @__PURE__ */ new Set([theme.heroImagePath]);
  for (const p of filteredProducts) {
    if (p.mainImage) imagePaths.add(p.mainImage);
  }
  await Promise.all(
    Array.from(imagePaths).map(async (imgPath) => {
      imageCache.set(imgPath, await loadImageBuffer(imgPath));
    })
  );
  const categoryGroups = [];
  const groupMap = /* @__PURE__ */ new Map();
  for (const p of filteredProducts) {
    const slug = p.categorySlug || "signature-collection";
    const catName = loc(p.category, lang) || "Signature Collection";
    let group = groupMap.get(slug);
    if (!group) {
      group = { categorySlug: slug, categoryName: catName, items: [] };
      groupMap.set(slug, group);
      categoryGroups.push(group);
    }
    group.items.push(p);
  }
  const doc = new PDFDocument({
    size: "A4",
    layout: isLandscape ? "landscape" : "portrait",
    margins: { top: 44, bottom: 44, left: 42, right: 42 },
    bufferPages: true,
    info: {
      Title: params.title,
      Author: `${theme.nameEn} | Ceylon Heritage House`,
      Subject: `${theme.nameEn} Product Portfolio (${params.version})`,
      Creator: "Ceylon Heritage House Portfolio Engine"
    }
  });
  registerFonts(doc);
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const pdfDone = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const marginX = 42;
  const contentW = pageW - marginX * 2;
  const topSafeY = 66;
  const bottomSafeY = pageH - 56;
  const dateLabel = params.generatedAtIso.slice(0, 10);
  const yearLabel = dateLabel.slice(0, 4);
  const whatsappDisplay = params.whatsappNumber ? `+${params.whatsappNumber.replace(/^\+/, "")}` : "";
  const labels = lang === "si" ? {
    edition: "\u0DC3\u0DD2\u0D82\u0DC4\u0DBD \u0DC3\u0D82\u0DC3\u0DCA\u0D9A\u0DBB\u0DAB\u0DBA",
    catalogueBadge: "\u0DB1\u0DD2\u0DBD \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1 \u0DB1\u0DCF\u0DB8\u0DCF\u0DC0\u0DBD\u0DD2\u0DBA",
    introHeading: "\u0DC3\u0DB1\u0DCA\u0DB1\u0DCF\u0DB8 \u0DC4\u0DD0\u0DB3\u0DD2\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8 \u0DC3\u0DC4 \u0D86\u0DBA\u0DAD\u0DB1\u0DD2\u0D9A \u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4",
    companyHeading: "\u0D86\u0DBA\u0DAD\u0DB1\u0DBA \u0DC3\u0DC4 \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0\u0DAD\u0DCF \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB",
    tocHeading: "\u0D85\u0DB1\u0DCA\u0DAD\u0DBB\u0DCA\u0D9C\u0DAD\u0DBA \u0DC3\u0DC4 \u0DC0\u0DBB\u0DCA\u0D9C\u0DD3\u0D9A\u0DBB\u0DAB \u0DC3\u0DD6\u0DA0\u0DD2\u0DBA",
    productsWord: "\u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1",
    sku: "SKU \u0D9A\u0DDA\u0DAD\u0DBA",
    origin: "\u0DB8\u0DD6\u0DBD\u0DCF\u0DC1\u0DCA\u200D\u0DBB\u0DBA",
    highlights: "\u0DC0\u0DD2\u0DC1\u0DDA\u0DC2\u0DCF\u0D82\u0D9C",
    ingredients: "\u0D85\u0DB8\u0DD4\u0DAF\u0DCA\u200D\u0DBB\u0DC0\u0DCA\u200D\u0DBA",
    packagingType: "\u0D87\u0DC3\u0DD4\u0DBB\u0DD4\u0DB8\u0DCA \u0DC0\u0DBB\u0DCA\u0D9C\u0DBA",
    storage: "\u0D9C\u0DB6\u0DA9\u0DCF \u0D8B\u0DB4\u0DAF\u0DD9\u0DC3\u0DCA",
    shelfLife: "\u0D86\u0DBA\u0DD4 \u0D9A\u0DCF\u0DBD\u0DBA",
    moq: "\u0D85\u0DC0\u0DB8 \u0D87\u0DAB\u0DC0\u0DD4\u0DB8\u0DCA \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA (MOQ)",
    specs: "\u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DD2\u0D9A \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB",
    certs: "\u0DC3\u0DC4\u0DAD\u0DD2\u0D9A",
    packTableHeadPack: "\u0D87\u0DC3\u0DD4\u0DBB\u0DD4\u0DB8",
    packTableHeadWeight: "\u0DC1\u0DD4\u0DAF\u0DCA\u0DB0 \u0DB6\u0DBB",
    packTableHeadRetail: "\u0DB8\u0DD2\u0DBD",
    wholesaleLabel: "\u0DAD\u0DDC\u0D9C/\u0D85\u0DB4\u0DB1\u0DBA\u0DB1 \u0DB8\u0DD2\u0DBD (FOB)",
    confidentialNotice: "\u0DC0\u0DCA\u200D\u0DBA\u0DCF\u0DB4\u0DCF\u0DBB\u0DD2\u0D9A \u0DBB\u0DC4\u0DC3\u0DCA\u200D\u0DBA \u0DC3\u0D82\u0DC3\u0DCA\u0D9A\u0DBB\u0DAB\u0DBA - \u0D85\u0DC0\u0DC3\u0DBB\u0DBD\u0DAD\u0DCA \u0DAD\u0DDC\u0D9C \u0DB8\u0DD2\u0DBD \u0D87\u0DAD\u0DD4\u0DC5\u0DAD\u0DCA \u0DC0\u0DDA",
    pageWord: "\u0DB4\u0DD2\u0DA7\u0DD4\u0DC0",
    ofWord: "/",
    copyright: `\xA9 ${yearLabel} ${theme.nameEn} | Ceylon Heritage House. \u0DC3\u0DD2\u0DBA\u0DBD\u0DD4\u0DB8 \u0DC4\u0DD2\u0DB8\u0DD2\u0D9A\u0DB8\u0DCA \u0D87\u0DC0\u0DD2\u0DBB\u0DD2\u0DAB\u0DD2.`
  } : {
    edition: "ENGLISH EDITION",
    catalogueBadge: "OFFICIAL PRODUCT PORTFOLIO",
    introHeading: "BRAND INTRODUCTION & HERITAGE PROFILE",
    companyHeading: "COMPANY & DIRECT ORDER DESK",
    tocHeading: "PORTFOLIO INDEX & CATEGORIES",
    productsWord: "Products",
    sku: "SKU",
    origin: "Origin",
    highlights: "Highlights",
    ingredients: "Ingredients",
    packagingType: "Packaging Type",
    storage: "Storage Instructions",
    shelfLife: "Shelf Life",
    moq: "Minimum Order Qty (MOQ)",
    specs: "Technical Specifications",
    certs: "Certifications",
    packTableHeadPack: "Pack Size",
    packTableHeadWeight: "Net Weight",
    packTableHeadRetail: "Displayed Price",
    wholesaleLabel: "Authorized Export / Wholesale Reference",
    confidentialNotice: "CONFIDENTIAL TRADE EDITION - AUTHORIZED WHOLESALE PRICING INCLUDED",
    pageWord: "Page",
    ofWord: "of",
    copyright: `\xA9 ${yearLabel} ${theme.nameEn} | Ceylon Heritage House. All rights reserved.`
  };
  const drawCoverPage = () => {
    const heroBuf = imageCache.get(theme.heroImagePath) ?? null;
    if (params.coverDesign === "heritage_crest") {
      doc.rect(0, 0, pageW, pageH).fill(theme.primary);
      doc.lineWidth(1.5).strokeColor(theme.accent).rect(22, 22, pageW - 44, pageH - 44).stroke();
      doc.lineWidth(0.5).strokeColor(theme.accent).rect(28, 28, pageW - 56, pageH - 56).stroke();
      let curY = isLandscape ? 58 : 88;
      doc.lineWidth(0.8).strokeColor(theme.accent).rect(pageW / 2 - 120, curY, 240, 24).stroke();
      drawMixedText(doc, labels.catalogueBadge, pageW / 2 - 115, curY + 5, {
        width: 230,
        fontSize: 9,
        color: theme.accent,
        role: "sans",
        bold: true,
        align: "center"
      });
      curY += 56;
      curY = drawMixedText(doc, theme.nameEn, marginX, curY, {
        width: contentW,
        fontSize: isLandscape ? 38 : 44,
        color: "#FAF6F0",
        role: "serif",
        bold: true,
        align: "center"
      });
      curY += 6;
      curY = drawMixedText(doc, lang === "si" ? theme.taglineSi : theme.taglineEn, marginX + 20, curY, {
        width: contentW - 40,
        fontSize: 13,
        color: theme.accent,
        role: "serif",
        italic: true,
        align: "center"
      });
      curY += 18;
      doc.lineWidth(1).strokeColor(theme.accent).moveTo(pageW / 2 - 64, curY).lineTo(pageW / 2 + 64, curY).stroke();
      curY += 22;
      const frameW = isLandscape ? 260 : 300;
      const frameH = isLandscape ? 140 : 195;
      const frameX = (pageW - frameW) / 2;
      if (heroBuf) {
        doc.rect(frameX - 4, curY - 4, frameW + 8, frameH + 8).lineWidth(0.75).strokeColor(theme.accent).stroke();
        doc.image(heroBuf, frameX, curY, { fit: [frameW, frameH], align: "center", valign: "center" });
        curY += frameH + 26;
      } else {
        curY += 32;
      }
      curY = drawMixedText(doc, params.title, marginX + 20, curY, {
        width: contentW - 40,
        fontSize: 18,
        color: "#FAF6F0",
        role: "serif",
        bold: true,
        align: "center"
      });
      curY += 10;
      const metaLine = `${labels.edition} | ${params.version} | ${dateLabel} | ${filteredProducts.length} ${labels.productsWord}`;
      drawMixedText(doc, metaLine, marginX, curY, {
        width: contentW,
        fontSize: 9.5,
        color: "#E7DCC8",
        role: "sans",
        align: "center"
      });
      const footY = pageH - 86;
      doc.lineWidth(0.5).strokeColor(theme.accent).moveTo(60, footY - 12).lineTo(pageW - 60, footY - 12).stroke();
      const contactStrip = [params.websiteUrl, whatsappDisplay ? `WhatsApp: ${whatsappDisplay}` : ""].filter(Boolean).join("   |   ");
      drawMixedText(doc, contactStrip, marginX, footY, {
        width: contentW,
        fontSize: 9.5,
        color: "#FAF6F0",
        role: "sans",
        align: "center"
      });
    } else if (params.coverDesign === "editorial_split") {
      const leftPanelW = isLandscape ? 270 : 210;
      doc.rect(0, 0, pageW, pageH).fill(theme.surface);
      doc.rect(0, 0, leftPanelW, pageH).fill(theme.primary);
      doc.rect(leftPanelW, 0, 3, pageH).fill(theme.accent);
      let leftY = 72;
      leftY = drawMixedText(doc, labels.catalogueBadge, 24, leftY, {
        width: leftPanelW - 48,
        fontSize: 8.5,
        color: theme.accent,
        role: "sans",
        bold: true
      });
      leftY += 14;
      leftY = drawMixedText(doc, theme.nameEn, 24, leftY, {
        width: leftPanelW - 48,
        fontSize: 24,
        color: "#FAF6F0",
        role: "serif",
        bold: true
      });
      leftY += 10;
      drawMixedText(doc, lang === "si" ? theme.taglineSi : theme.taglineEn, 24, leftY, {
        width: leftPanelW - 48,
        fontSize: 10.5,
        color: "#EAE0CE",
        role: "serif",
        italic: true
      });
      const spineBottomY = pageH - 130;
      drawMixedText(
        doc,
        `${labels.edition}
${params.version}
${dateLabel}
${filteredProducts.length} ${labels.productsWord}`,
        24,
        spineBottomY,
        {
          width: leftPanelW - 48,
          fontSize: 9,
          color: "#E5DAC5",
          role: "sans"
        }
      );
      const rightX = leftPanelW + 34;
      const rightW = pageW - rightX - 34;
      let rightY = 72;
      if (heroBuf) {
        const imgH = isLandscape ? 210 : 280;
        doc.rect(rightX, rightY, rightW, imgH).fill(theme.tint);
        doc.image(heroBuf, rightX, rightY, { fit: [rightW, imgH], align: "center", valign: "center" });
        doc.lineWidth(0.75).strokeColor(theme.accent).rect(rightX, rightY, rightW, imgH).stroke();
        rightY += imgH + 34;
      } else {
        rightY += 80;
      }
      rightY = drawMixedText(doc, params.title, rightX, rightY, {
        width: rightW,
        fontSize: 22,
        color: theme.ink,
        role: "serif",
        bold: true
      });
      rightY += 14;
      doc.lineWidth(1.2).strokeColor(theme.accent).moveTo(rightX, rightY).lineTo(rightX + 80, rightY).stroke();
      rightY += 16;
      const summaryText = params.introMessage?.trim() || (lang === "si" ? theme.defaultIntroSi : theme.defaultIntroEn);
      rightY = drawMixedText(doc, summaryText, rightX, rightY, {
        width: rightW,
        fontSize: 10,
        color: theme.muted,
        role: "sans"
      });
      drawMixedText(
        doc,
        [params.websiteUrl, whatsappDisplay ? `WhatsApp: ${whatsappDisplay}` : ""].filter(Boolean).join("  |  "),
        rightX,
        pageH - 64,
        {
          width: rightW,
          fontSize: 9,
          color: theme.secondary,
          role: "sans",
          bold: true
        }
      );
    } else {
      doc.rect(0, 0, pageW, pageH).fill(theme.surface);
      doc.lineWidth(0.75).strokeColor(theme.border).rect(26, 26, pageW - 52, pageH - 52).stroke();
      let curY = isLandscape ? 70 : 120;
      curY = drawMixedText(doc, labels.catalogueBadge, marginX, curY, {
        width: contentW,
        fontSize: 9,
        color: theme.accent,
        role: "sans",
        bold: true,
        align: "center"
      });
      curY += 16;
      curY = drawMixedText(doc, theme.nameEn, marginX, curY, {
        width: contentW,
        fontSize: 40,
        color: theme.primary,
        role: "serif",
        bold: true,
        align: "center"
      });
      curY += 10;
      curY = drawMixedText(doc, lang === "si" ? theme.taglineSi : theme.taglineEn, marginX + 30, curY, {
        width: contentW - 60,
        fontSize: 12.5,
        color: theme.muted,
        role: "serif",
        italic: true,
        align: "center"
      });
      curY += 24;
      doc.lineWidth(1).strokeColor(theme.accent).moveTo(pageW / 2 - 48, curY).lineTo(pageW / 2 + 48, curY).stroke();
      curY += 28;
      if (heroBuf) {
        const imgW = isLandscape ? 250 : 280;
        const imgH = isLandscape ? 140 : 190;
        doc.image(heroBuf, (pageW - imgW) / 2, curY, {
          fit: [imgW, imgH],
          align: "center",
          valign: "center"
        });
        curY += imgH + 28;
      }
      curY = drawMixedText(doc, params.title, marginX + 20, curY, {
        width: contentW - 40,
        fontSize: 17,
        color: theme.ink,
        role: "serif",
        bold: true,
        align: "center"
      });
      curY += 10;
      drawMixedText(
        doc,
        `${labels.edition} | ${params.version} | ${dateLabel}`,
        marginX,
        curY,
        {
          width: contentW,
          fontSize: 9.5,
          color: theme.muted,
          role: "sans",
          align: "center"
        }
      );
      drawMixedText(
        doc,
        [params.websiteUrl, whatsappDisplay ? `WhatsApp: ${whatsappDisplay}` : ""].filter(Boolean).join("   |   "),
        marginX,
        pageH - 72,
        {
          width: contentW,
          fontSize: 9,
          color: theme.primary,
          role: "sans",
          align: "center"
        }
      );
    }
  };
  drawCoverPage();
  let currentPageIndex = 0;
  const addContentPage = () => {
    doc.addPage({
      size: "A4",
      layout: isLandscape ? "landscape" : "portrait",
      margins: { top: 44, bottom: 44, left: 42, right: 42 }
    });
    currentPageIndex += 1;
    doc.rect(0, 0, pageW, pageH).fill("#FFFFFF");
    doc.rect(0, 0, pageW, 6).fill(theme.primary);
    return topSafeY;
  };
  let cursorY = addContentPage();
  const tocPageIndex = currentPageIndex;
  const introText = params.introMessage?.trim() || (lang === "si" ? theme.defaultIntroSi : theme.defaultIntroEn);
  const companyText = params.companyProfile?.trim() || "Ceylon Heritage House (Pvt) Ltd - Curated origin-packed Sri Lankan spices, single-estate Ceylon teas, and heritage craft.";
  const contactText = [
    params.contactInfo?.trim() || "Colombo Heritage Dispatch & Trade Desk, Sri Lanka",
    params.websiteUrl ? `Web: ${params.websiteUrl}` : "",
    whatsappDisplay ? `WhatsApp: ${whatsappDisplay}` : ""
  ].filter(Boolean).join("\n");
  const introLayout = measureAndWrapMixedText(doc, introText, contentW - 28, 9.5, "sans", false, false);
  const companyLayout = measureAndWrapMixedText(
    doc,
    `${companyText}
${contactText}`,
    contentW - 28,
    9,
    "sans",
    false,
    false
  );
  const introBoxH = 26 + introLayout.totalHeight + 14;
  const companyBoxH = 26 + companyLayout.totalHeight + 12;
  doc.rect(marginX, cursorY, contentW, introBoxH).fill(theme.surface);
  doc.rect(marginX, cursorY, 3, introBoxH).fill(theme.primary);
  drawMixedText(doc, labels.introHeading, marginX + 14, cursorY + 10, {
    width: contentW - 28,
    fontSize: 9.5,
    color: theme.primary,
    role: "sans",
    bold: true
  });
  drawMixedText(doc, introText, marginX + 14, cursorY + 26, {
    width: contentW - 28,
    fontSize: 9.5,
    color: theme.ink,
    role: "sans"
  });
  cursorY += introBoxH + 12;
  doc.rect(marginX, cursorY, contentW, companyBoxH).fill("#FAF9F7");
  doc.lineWidth(0.5).strokeColor(theme.border).rect(marginX, cursorY, contentW, companyBoxH).stroke();
  drawMixedText(doc, labels.companyHeading, marginX + 14, cursorY + 10, {
    width: contentW - 28,
    fontSize: 9,
    color: theme.secondary,
    role: "sans",
    bold: true
  });
  drawMixedText(doc, `${companyText}
${contactText}`, marginX + 14, cursorY + 25, {
    width: contentW - 28,
    fontSize: 9,
    color: theme.muted,
    role: "sans"
  });
  cursorY += companyBoxH + 18;
  drawMixedText(doc, labels.tocHeading, marginX, cursorY, {
    width: contentW,
    fontSize: 11,
    color: theme.primary,
    role: "serif",
    bold: true
  });
  cursorY += 18;
  doc.lineWidth(0.8).strokeColor(theme.accent).moveTo(marginX, cursorY).lineTo(marginX + contentW, cursorY).stroke();
  cursorY += 10;
  const tocSlots = [];
  const reserveTocSlot = (label, isCategory) => {
    const rowH = isCategory ? 17 : 14;
    if (cursorY + rowH > bottomSafeY) {
      cursorY = addContentPage();
      drawMixedText(doc, `${labels.tocHeading} (cont.)`, marginX, cursorY, {
        width: contentW,
        fontSize: 10,
        color: theme.primary,
        role: "serif",
        bold: true
      });
      cursorY += 20;
    }
    const slot = {
      pageIndex: currentPageIndex,
      y: cursorY,
      label,
      isCategory,
      targetPageOneBased: 0
    };
    tocSlots.push(slot);
    cursorY += rowH;
    return slot;
  };
  const productTocMap = /* @__PURE__ */ new Map();
  const categoryTocMap = /* @__PURE__ */ new Map();
  for (const group of categoryGroups) {
    categoryTocMap.set(
      group.categorySlug,
      reserveTocSlot(`${group.categoryName} (${group.items.length})`, true)
    );
    for (const item of group.items) {
      const itemLabel = `${loc(item.name, lang)}${params.fields.sku && item.sku ? `  [${item.sku}]` : ""}`;
      productTocMap.set(item.id, reserveTocSlot(itemLabel, false));
    }
  }
  cursorY = addContentPage();
  const measureProductCard = (product) => {
    const pad = 14;
    const imgW = isLandscape ? 168 : 138;
    const imgH = isLandscape ? 168 : 148;
    const rightColW = contentW - pad * 2 - imgW - 18;
    const prodName = loc(product.name, lang);
    const titleLayout = measureAndWrapMixedText(doc, prodName, rightColW, 13, "serif", true, false, 1.35);
    const metaBits = [];
    if (params.fields.sku && product.sku) metaBits.push(`${labels.sku}: ${product.sku}`);
    if (params.fields.category && loc(product.category, lang)) metaBits.push(loc(product.category, lang));
    if (params.fields.origin && loc(product.origin, lang)) metaBits.push(`${labels.origin}: ${loc(product.origin, lang)}`);
    const metaLine = metaBits.join("  |  ");
    const metaLayout = metaLine ? measureAndWrapMixedText(doc, metaLine, rightColW, 8.2, "sans", true, false, 1.35) : null;
    const descText = params.fields.description ? loc(product.description, lang) : "";
    const descLayout = descText ? measureAndWrapMixedText(doc, descText, rightColW, 9, "sans", false, false, 1.44) : null;
    const specRows = [];
    const highlightsVal = params.fields.highlights ? loc(product.highlights, lang) || loc(product.tastingNotes, lang) : "";
    if (highlightsVal) specRows.push({ label: labels.highlights, value: highlightsVal });
    const ingredientsVal = params.fields.ingredients ? loc(product.ingredients, lang) : "";
    if (ingredientsVal) specRows.push({ label: labels.ingredients, value: ingredientsVal });
    const pkgTypeVal = params.fields.packagingType ? loc(product.packagingType, lang) || product.exportSpecs?.packagingNote || "" : "";
    if (pkgTypeVal) specRows.push({ label: labels.packagingType, value: pkgTypeVal });
    const storageVal = params.fields.storageInstructions ? loc(product.storageInstructions, lang) : "";
    if (storageVal) specRows.push({ label: labels.storage, value: storageVal });
    const shelfLifeVal = params.fields.shelfLife ? product.exportSpecs?.shelfLife?.trim() || "" : "";
    if (shelfLifeVal) specRows.push({ label: labels.shelfLife, value: shelfLifeVal });
    if (params.fields.moq && typeof product.moqUnits === "number" && product.moqUnits > 0) {
      specRows.push({ label: labels.moq, value: `${product.moqUnits} units` });
    }
    const techVal = params.fields.technicalSpecs ? loc(product.technicalSpecs, lang) || product.exportSpecs?.botanicalOrGrade || "" : "";
    if (techVal) specRows.push({ label: labels.specs, value: techVal });
    if (params.fields.certifications && Array.isArray(product.certifications) && product.certifications.length > 0) {
      specRows.push({ label: labels.certs, value: product.certifications.filter(Boolean).join(", ") });
    }
    if (params.fields.wholesalePrices && typeof product.exportPriceUsd === "number" && product.exportPriceUsd > 0) {
      specRows.push({
        label: labels.wholesaleLabel,
        value: formatWholesalePdfPrice(product.exportPriceUsd, params.currency, params.currencyConfig)
      });
    }
    let specsHeight = 0;
    const measuredSpecs = specRows.map((sr) => {
      const lineStr = `${sr.label}: ${sr.value}`;
      const lay = measureAndWrapMixedText(doc, lineStr, rightColW, 8.2, "sans", false, false, 1.38);
      specsHeight += lay.totalHeight + 2;
      return { ...sr, layout: lay };
    });
    const rightUpperH = titleLayout.totalHeight + (metaLayout ? metaLayout.totalHeight + 4 : 0) + (descLayout ? descLayout.totalHeight + 8 : 0) + (specsHeight > 0 ? specsHeight + 6 : 0);
    const upperBodyH = Math.max(imgH, rightUpperH);
    const activeVariants = (product.variants ?? []).filter((v) => v && (v.label || v.weightGrams));
    const showPackTable = params.fields.packSizes && activeVariants.length > 0;
    const tableRowH = 19;
    const tableH = showPackTable ? 20 + activeVariants.length * tableRowH + 6 : 0;
    const totalH = pad + upperBodyH + (tableH > 0 ? 12 + tableH : 0) + pad;
    return {
      pad,
      imgW,
      imgH,
      rightColW,
      prodName,
      titleLayout,
      metaLine,
      metaLayout,
      descText,
      descLayout,
      measuredSpecs,
      showPackTable,
      activeVariants,
      tableRowH,
      tableH,
      upperBodyH,
      totalH
    };
  };
  for (let gIdx = 0; gIdx < categoryGroups.length; gIdx++) {
    const group = categoryGroups[gIdx];
    const firstProductMetric = measureProductCard(group.items[0]);
    const catHeaderH = 32;
    if (cursorY + catHeaderH + firstProductMetric.totalH > bottomSafeY) {
      cursorY = addContentPage();
    }
    const catSlot = categoryTocMap.get(group.categorySlug);
    if (catSlot) {
      catSlot.targetPageOneBased = currentPageIndex + 1;
    }
    doc.rect(marginX, cursorY, contentW, 24).fill(theme.tint);
    doc.rect(marginX, cursorY, 4, 24).fill(theme.accent);
    drawMixedText(
      doc,
      `${group.categoryName.toUpperCase()}  (${group.items.length})`,
      marginX + 12,
      cursorY + 6,
      {
        width: contentW - 24,
        fontSize: 10,
        color: theme.primary,
        role: "serif",
        bold: true
      }
    );
    cursorY += 32;
    for (let pIdx = 0; pIdx < group.items.length; pIdx++) {
      const product = group.items[pIdx];
      const m = pIdx === 0 ? firstProductMetric : measureProductCard(product);
      if (cursorY + m.totalH > bottomSafeY) {
        cursorY = addContentPage();
      }
      const prodSlot = productTocMap.get(product.id);
      if (prodSlot) {
        prodSlot.targetPageOneBased = currentPageIndex + 1;
      }
      const cardX = marginX;
      const cardY = cursorY;
      doc.rect(cardX, cardY, contentW, m.totalH).fill("#FFFFFF");
      doc.lineWidth(0.7).strokeColor(theme.border).rect(cardX, cardY, contentW, m.totalH).stroke();
      const imgX = cardX + m.pad;
      const imgY = cardY + m.pad;
      doc.rect(imgX, imgY, m.imgW, m.imgH).fill(theme.surface);
      doc.lineWidth(0.5).strokeColor(theme.border).rect(imgX, imgY, m.imgW, m.imgH).stroke();
      const imgBuf = imageCache.get(product.mainImage) ?? null;
      if (imgBuf) {
        doc.image(imgBuf, imgX + 2, imgY + 2, {
          fit: [m.imgW - 4, m.imgH - 4],
          align: "center",
          valign: "center"
        });
      } else {
        drawMixedText(doc, theme.nameEn, imgX + 8, imgY + m.imgH / 2 - 8, {
          width: m.imgW - 16,
          fontSize: 10,
          color: theme.muted,
          role: "serif",
          bold: true,
          align: "center"
        });
      }
      const rightX = imgX + m.imgW + 18;
      let ry = cardY + m.pad;
      ry = drawMixedText(doc, m.prodName, rightX, ry, {
        width: m.rightColW,
        fontSize: 13,
        color: theme.primary,
        role: "serif",
        bold: true,
        lineHeightRatio: 1.35
      });
      if (m.metaLine) {
        ry += 2;
        ry = drawMixedText(doc, m.metaLine, rightX, ry, {
          width: m.rightColW,
          fontSize: 8.2,
          color: theme.accent,
          role: "sans",
          bold: true,
          lineHeightRatio: 1.35
        });
      }
      if (m.descText) {
        ry += 5;
        ry = drawMixedText(doc, m.descText, rightX, ry, {
          width: m.rightColW,
          fontSize: 9,
          color: theme.ink,
          role: "sans",
          lineHeightRatio: 1.44
        });
      }
      if (m.measuredSpecs.length > 0) {
        ry += 5;
        doc.lineWidth(0.4).strokeColor(theme.border).moveTo(rightX, ry).lineTo(rightX + m.rightColW, ry).stroke();
        ry += 5;
        for (const sr of m.measuredSpecs) {
          ry = drawMixedText(doc, `${sr.label}: ${sr.value}`, rightX, ry, {
            width: m.rightColW,
            fontSize: 8.2,
            color: sr.label === labels.wholesaleLabel ? theme.primary : theme.muted,
            role: "sans",
            bold: sr.label === labels.wholesaleLabel,
            lineHeightRatio: 1.38
          });
          ry += 2;
        }
      }
      if (m.showPackTable) {
        const tableX = cardX + m.pad;
        const tableW = contentW - m.pad * 2;
        let ty = cardY + m.pad + m.upperBodyH + 10;
        doc.rect(tableX, ty, tableW, 20).fill(theme.primary);
        const col1W = params.fields.sku ? tableW * 0.25 : 0;
        const colPackW = params.fields.sku ? tableW * 0.27 : tableW * 0.42;
        const colWeightW = params.fields.netWeight ? tableW * 0.22 : 0;
        let hx = tableX + 8;
        if (params.fields.sku) {
          drawMixedText(doc, labels.sku, hx, ty + 4, {
            width: col1W - 8,
            fontSize: 8,
            color: "#FAF6F0",
            role: "sans",
            bold: true
          });
          hx += col1W;
        }
        drawMixedText(doc, labels.packTableHeadPack, hx, ty + 4, {
          width: colPackW - 8,
          fontSize: 8,
          color: "#FAF6F0",
          role: "sans",
          bold: true
        });
        hx += colPackW;
        if (params.fields.netWeight) {
          drawMixedText(doc, labels.packTableHeadWeight, hx, ty + 4, {
            width: colWeightW - 8,
            fontSize: 8,
            color: "#FAF6F0",
            role: "sans",
            bold: true
          });
          hx += colWeightW;
        }
        if (params.fields.retailPrices) {
          drawMixedText(doc, labels.packTableHeadRetail, tableX + 8, ty + 4, {
            width: tableW - 16,
            fontSize: 8,
            color: "#FAF6F0",
            role: "sans",
            bold: true,
            align: "right"
          });
        }
        ty += 20;
        m.activeVariants.forEach((v, vIdx) => {
          doc.rect(tableX, ty, tableW, m.tableRowH).fill(vIdx % 2 === 0 ? theme.surface : "#FFFFFF");
          doc.lineWidth(0.35).strokeColor(theme.border).rect(tableX, ty, tableW, m.tableRowH).stroke();
          let cx = tableX + 8;
          if (params.fields.sku) {
            drawMixedText(doc, v.variantSku, cx, ty + 4, {
              width: col1W - 8,
              fontSize: 8,
              color: theme.muted,
              role: "sans"
            });
            cx += col1W;
          }
          drawMixedText(doc, v.label, cx, ty + 4, {
            width: colPackW - 8,
            fontSize: 8.2,
            color: theme.ink,
            role: "sans",
            bold: true
          });
          cx += colPackW;
          if (params.fields.netWeight) {
            const weightStr = v.weightGrams >= 1e3 ? `${(v.weightGrams / 1e3).toFixed(v.weightGrams % 1e3 === 0 ? 0 : 2)} kg` : `${v.weightGrams} g`;
            drawMixedText(doc, weightStr, cx, ty + 4, {
              width: colWeightW - 8,
              fontSize: 8.2,
              color: theme.muted,
              role: "sans"
            });
          }
          if (params.fields.retailPrices) {
            drawMixedText(
              doc,
              formatPdfPrice(v.priceUsd, v.priceLkr, params.currency, params.currencyConfig),
              tableX + 8,
              ty + 4,
              {
                width: tableW - 16,
                fontSize: 8.5,
                color: theme.primary,
                role: "sans",
                bold: true,
                align: "right"
              }
            );
          }
          ty += m.tableRowH;
        });
      }
      cursorY += m.totalH + 14;
    }
  }
  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  for (const slot of tocSlots) {
    doc.switchToPage(slot.pageIndex);
    const rowY = slot.y;
    const indentX = slot.isCategory ? marginX : marginX + 14;
    const maxLabelW = contentW - (slot.isCategory ? 48 : 62);
    if (slot.isCategory) {
      doc.rect(marginX, rowY - 1, contentW, 15).fill(theme.surface);
    }
    drawMixedText(doc, slot.label, indentX, rowY + 1, {
      width: maxLabelW,
      fontSize: slot.isCategory ? 9 : 8.5,
      color: slot.isCategory ? theme.primary : theme.ink,
      role: "sans",
      bold: slot.isCategory
    });
    drawMixedText(
      doc,
      String(slot.targetPageOneBased || tocPageIndex + 2),
      marginX,
      rowY + 1,
      {
        width: contentW - 6,
        fontSize: 8.5,
        color: slot.isCategory ? theme.primary : theme.muted,
        role: "sans",
        bold: slot.isCategory,
        align: "right"
      }
    );
  }
  for (let i = 1; i < totalPages; i++) {
    doc.switchToPage(i);
    drawMixedText(doc, theme.nameEn, marginX, 24, {
      width: contentW * 0.45,
      fontSize: 8.5,
      color: theme.primary,
      role: "serif",
      bold: true
    });
    drawMixedText(doc, `${params.title}  |  ${params.version}`, marginX, 24, {
      width: contentW,
      fontSize: 8,
      color: theme.muted,
      role: "sans",
      align: "right"
    });
    doc.lineWidth(0.5).strokeColor(theme.accent).moveTo(marginX, 42).lineTo(marginX + contentW, 42).stroke();
    const footerRuleY = pageH - 42;
    doc.lineWidth(0.5).strokeColor(theme.border).moveTo(marginX, footerRuleY).lineTo(marginX + contentW, footerRuleY).stroke();
    if (params.fields.wholesalePrices) {
      drawMixedText(doc, labels.confidentialNotice, marginX, footerRuleY - 13, {
        width: contentW,
        fontSize: 7.2,
        color: theme.primary,
        role: "sans",
        bold: true,
        align: "center"
      });
    }
    const footerLeft = [
      labels.copyright,
      params.websiteUrl,
      whatsappDisplay ? `WhatsApp: ${whatsappDisplay}` : "",
      dateLabel
    ].filter(Boolean).join("  |  ");
    drawMixedText(doc, footerLeft, marginX, footerRuleY + 7, {
      width: contentW - 85,
      fontSize: 7.4,
      color: theme.muted,
      role: "sans"
    });
    const pageStr = `${labels.pageWord} ${i + 1} ${labels.ofWord} ${totalPages}`;
    drawMixedText(doc, pageStr, marginX, footerRuleY + 7, {
      width: contentW,
      fontSize: 7.8,
      color: theme.primary,
      role: "sans",
      bold: true,
      align: "right"
    });
  }
  doc.end();
  const buffer = await pdfDone;
  return {
    buffer,
    pageCount: totalPages,
    productCount: filteredProducts.length
  };
}

// server/store.ts
import crypto2 from "node:crypto";
import fs2 from "node:fs";
import path2 from "node:path";

// server/shipping.ts
function resolveConfiguredCurrency(code, settings) {
  const requested = String(code || "LKR").trim().toUpperCase();
  const list = settings.currencies?.length ? settings.currencies : [
    { code: "LKR", symbol: "LKR", name: "Sri Lankan Rupee", ratePerUsd: settings.shipping.usdToLkrRate || 300, enabled: true },
    { code: "USD", symbol: "$", name: "US Dollar", ratePerUsd: 1, enabled: true }
  ];
  const found = list.find((c) => c.code.toUpperCase() === requested && c.enabled);
  if (!found) {
    throw new Error(`Currency ${requested} is not enabled by administrator.`);
  }
  return found;
}
function convertUsdToConfiguredCurrency(usdAmount, currencyCfg, lkrExact) {
  const code = currencyCfg.code.toUpperCase();
  if (code === "LKR") {
    return typeof lkrExact === "number" ? Math.round(lkrExact) : Math.round(usdAmount * Math.max(1, currencyCfg.ratePerUsd || 300));
  }
  if (code === "USD") {
    return Number(usdAmount.toFixed(2));
  }
  const rate = Number(currencyCfg.ratePerUsd);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid administrator exchange rate configured for ${code}.`);
  }
  return Number((usdAmount * rate).toFixed(2));
}
function calculateAuthoritativeShipping(params) {
  const {
    subtotalLkr,
    totalWeightGrams,
    country,
    deliveryMethod,
    localZoneId,
    currency,
    settings
  } = params;
  const { shipping } = settings;
  const fx = Math.max(100, shipping.usdToLkrRate || 300);
  const currencyCfg = resolveConfiguredCurrency(currency, settings);
  const normalizedCountry = country.trim().toLowerCase();
  const isSriLanka = normalizedCountry === "sri lanka" || normalizedCountry === "lk";
  if (isSriLanka) {
    if (deliveryMethod !== "local_standard" && deliveryMethod !== "local_express") {
      throw new Error("Selected delivery method is not valid for Sri Lanka.");
    }
    const zone = shipping.localZones.find((z) => z.id === localZoneId && z.enabled) ?? shipping.localZones.find((z) => z.enabled);
    if (!zone) {
      throw new Error("No active Sri Lankan delivery zones configured.");
    }
    const extraKg = Math.max(0, Math.ceil((totalWeightGrams - 1e3) / 1e3));
    const baseLkr = zone.baseRateLkr + extraKg * zone.extraPerKgLkr;
    const freeQualified = shipping.freeShippingThresholdLkr > 0 && subtotalLkr >= shipping.freeShippingThresholdLkr;
    let feeLkr2 = freeQualified ? 0 : baseLkr;
    if (deliveryMethod === "local_express") {
      feeLkr2 += Math.max(0, shipping.localExpressSurchargeLkr);
    }
    const feeUsd2 = Number((feeLkr2 / fx).toFixed(2));
    return {
      feeLkr: feeLkr2,
      feeUsd: feeUsd2,
      feeInCurrency: convertUsdToConfiguredCurrency(feeUsd2, currencyCfg, feeLkr2),
      freeShippingApplied: freeQualified && deliveryMethod === "local_standard",
      isQuotePending: false,
      label: deliveryMethod === "local_express" ? `${zone.name} (Priority Express)` : `${zone.name} (Standard Courier)`
    };
  }
  if (deliveryMethod === "local_standard" || deliveryMethod === "local_express") {
    throw new Error("Please choose an international delivery option for destinations outside Sri Lanka.");
  }
  const matchedRate = shipping.internationalRates.find(
    (r) => r.enabled && r.country.toLowerCase() === normalizedCountry
  ) ?? shipping.internationalRates.find(
    (r) => r.enabled && r.country.toLowerCase() === "rest of world"
  );
  if (deliveryMethod === "international_quote") {
    if (!shipping.internationalQuoteEnabled) {
      throw new Error("International shipping quotations are currently disabled.");
    }
    return {
      feeLkr: 0,
      feeUsd: 0,
      feeInCurrency: 0,
      freeShippingApplied: false,
      isQuotePending: true,
      label: `Export Shipping Quotation (${country.trim()})`,
      policyNote: matchedRate?.policyNote
    };
  }
  if (!matchedRate) {
    throw new Error(`No courier rate configured for ${country}. Please request a shipping quotation.`);
  }
  const halfKgUnits = Math.max(1, Math.ceil(totalWeightGrams / 500));
  const feeUsd = Number(
    (matchedRate.baseUsd + Math.max(0, halfKgUnits - 1) * matchedRate.extraPer500gUsd).toFixed(2)
  );
  const feeLkr = Math.round(feeUsd * fx);
  return {
    feeLkr,
    feeUsd,
    feeInCurrency: convertUsdToConfiguredCurrency(feeUsd, currencyCfg, feeLkr),
    freeShippingApplied: false,
    isQuotePending: false,
    label: `International Air Express (${matchedRate.country})`,
    policyNote: matchedRate.policyNote
  };
}

// server/store.ts
var ROOT_DIR = process.cwd();
var DEFAULT_DATA_DIR = process.env.FUNCTION_TARGET ? "/tmp/ceylon-heritage-data" : path2.join(ROOT_DIR, ".data");
var DATA_DIR = path2.resolve(process.env.COMMERCE_DATA_DIR || DEFAULT_DATA_DIR);
var STORE_FILE = path2.join(DATA_DIR, "commerce-store.json");
var SLIPS_DIR = path2.join(DATA_DIR, "slips");
var PORTFOLIOS_DIR = path2.join(DATA_DIR, "portfolios");
var PRODUCTS_JSON_PATH = path2.resolve(ROOT_DIR, "src/data/products.json");
var FIREBASE_CONFIG_PATH = path2.resolve(ROOT_DIR, "firebase-applet-config.json");
var BOOTSTRAP_ADMIN_EMAIL = "brandallanka@gmail.com";
var VALID_ADMIN_ROLES = ["super_admin", "catalog_manager", "order_manager"];
function sanitizePlainText(raw, maxLen) {
  return String(raw ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}
function resolveAdminRole(store, rawEmail) {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!email) return null;
  if (email === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
    return "super_admin";
  }
  const mappedRole = store.adminRolesByEmail?.[email];
  if (mappedRole && VALID_ADMIN_ROLES.includes(mappedRole)) {
    return mappedRole;
  }
  if (store.adminAllowlistEmails.some((e) => e.toLowerCase() === email)) {
    return "super_admin";
  }
  return null;
}
function recordAdminAuditLog(store, entry) {
  const actorEmail = entry.actorEmail.toLowerCase();
  const actorRole = entry.actorRole ?? resolveAdminRole(store, actorEmail) ?? "super_admin";
  const record = {
    id: `aud-${crypto2.randomUUID().slice(0, 12)}`,
    actorEmail,
    actorRole,
    action: sanitizePlainText(entry.action, 80),
    targetType: entry.targetType,
    targetId: sanitizePlainText(entry.targetId, 120),
    summary: sanitizePlainText(entry.summary, 280),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  store.auditLogs = [record, ...store.auditLogs ?? []].slice(0, 500);
  return record;
}
function safeEqualToken(expected, provided) {
  if (!expected || !provided) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return crypto2.timingSafeEqual(a, b);
}
var DEFAULT_COUNTRY_POLICY = "Shipping rates apply ex-Colombo dispatch. Import duties, destination taxes, and customs clearance charges are handled by the buyer unless expressly agreed on a formal proforma invoice. Transit times are confirmed only upon carrier booking.";
var DEFAULT_CURRENCIES = [
  { code: "LKR", symbol: "LKR", name: "Sri Lankan Rupee", ratePerUsd: 300, enabled: true, isDefault: true },
  { code: "USD", symbol: "$", name: "US Dollar", ratePerUsd: 1, enabled: true },
  { code: "EUR", symbol: "\u20AC", name: "Euro", ratePerUsd: 0.92, enabled: false },
  { code: "GBP", symbol: "\xA3", name: "British Pound", ratePerUsd: 0.79, enabled: false },
  { code: "AED", symbol: "AED", name: "UAE Dirham", ratePerUsd: 3.67, enabled: false },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", ratePerUsd: 1.54, enabled: false }
];
var VALID_BUSINESS_TYPES = [
  "Importer",
  "Distributor",
  "Wholesaler",
  "Retailer",
  "Private Label Buyer",
  "Other"
];
var DEFAULT_COMMERCE_SETTINGS = {
  whatsappNumber: "94770000000",
  brandWhatsappNumbers: {
    ceyvana: "94770000000",
    ceylomira: "94770000000",
    "hand-crafts": "94770000000"
  },
  currencies: DEFAULT_CURRENCIES,
  exportConfig: {
    defaultMoqUnits: 25,
    packagingFormats: [
      "Retail Sealed Pouches (50g\u2013500g)",
      "1kg Barrier Foil Pouches",
      "5kg Bulk Trade Bags",
      "25kg Multi-wall Kraft Sacks",
      "Private Label (Buyer Artwork & OEM)"
    ],
    ratePolicyNote: "Export pricing and MOQs serve as planning references. Final country-specific quotations include verified freight terms without unverified delivery time or customs duty promises.",
    fxServiceNote: "Additional currencies use administrator-configured exchange rates relative to USD until a verified exchange-rate service is connected."
  },
  portfolioSettings: {
    requireRegistrationForPublicDownload: false,
    allowCustomPublicCatalogSelection: true
  },
  payment: {
    whatsappOrderEnabled: true,
    bankTransferEnabled: true,
    codEnabled: false,
    slGatewayEnabled: false,
    intlGatewayEnabled: false,
    sandboxMode: true,
    bankDetails: {
      bankName: "Commercial Bank of Ceylon PLC",
      accountName: "Ceylon Heritage House (Pvt) Ltd",
      accountNumber: "1000482910",
      branchName: "Colombo Fort Main Branch",
      swiftCode: "CCEYLKLX",
      instructions: "Include your Order Reference (e.g., CH-2026-1003) as the transfer remark and submit your bank reference or slip below. Orders remain in Payment Verification until confirmed by our Colombo finance desk."
    }
  },
  shipping: {
    freeShippingThresholdLkr: 15e3,
    localExpressSurchargeLkr: 550,
    internationalQuoteEnabled: true,
    usdToLkrRate: 300,
    localZones: [
      {
        id: "colombo-suburbs",
        name: "Colombo 01\u201315 & Suburbs",
        baseRateLkr: 350,
        extraPerKgLkr: 100,
        enabled: true
      },
      {
        id: "western-province",
        name: "Western Province (Gampaha / Kalutara)",
        baseRateLkr: 450,
        extraPerKgLkr: 150,
        enabled: true
      },
      {
        id: "islandwide",
        name: "Islandwide Courier (All Other Districts)",
        baseRateLkr: 600,
        extraPerKgLkr: 180,
        enabled: true
      }
    ],
    internationalRates: [
      {
        country: "United Kingdom",
        baseUsd: 24,
        extraPer500gUsd: 11,
        enabled: true,
        policyNote: "Dispatched via international air courier or commercial freight quotation. UK VAT/import clearance applies upon arrival per buyer import registration."
      },
      {
        country: "United States",
        baseUsd: 28,
        extraPer500gUsd: 13,
        enabled: true,
        policyNote: "Commercial invoice & packing list provided per US import entry requirements. Buyer confirms FDA Prior Notice / broker handling before dispatch."
      },
      {
        country: "Australia",
        baseUsd: 22,
        extraPer500gUsd: 10,
        enabled: true,
        policyNote: "Sealed retail & wholesale botanicals packed per commercial invoice; Australian biosecurity inspection and import charges remain buyer responsibility."
      },
      {
        country: "United Arab Emirates",
        baseUsd: 18,
        extraPer500gUsd: 8,
        enabled: true,
        policyNote: "Regional air express & trade pallet quotations from Colombo. Destination municipality inspection & customs duty governed by UAE importer of record."
      },
      {
        country: "Singapore",
        baseUsd: 16,
        extraPer500gUsd: 7,
        enabled: true,
        policyNote: "Consolidated air freight or courier dispatch upon confirmed quotation. Singapore GST and customs clearance handled by consignee."
      },
      {
        country: "India",
        baseUsd: 14,
        extraPer500gUsd: 6,
        enabled: true,
        policyNote: "Cross-strait air courier and commercial sea/air freight options quoted upon review with importer licensing confirmation."
      },
      {
        country: "Germany",
        baseUsd: 25,
        extraPer500gUsd: 11,
        enabled: true,
        policyNote: "EU EORI consignee details requested prior to commercial export dispatch. Import VAT & customs duties paid by importer upon entry."
      },
      {
        country: "Canada",
        baseUsd: 28,
        extraPer500gUsd: 13,
        enabled: true,
        policyNote: "Commercial air dispatch or bulk quotation with buyer-arranged CBSA customs brokerage."
      },
      {
        country: "Japan",
        baseUsd: 23,
        extraPer500gUsd: 10,
        enabled: true,
        policyNote: "Quoted with commercial specification sheets; Japanese importer confirms botanical import clearance prior to dispatch."
      },
      {
        country: "Rest of World",
        baseUsd: 32,
        extraPer500gUsd: 14,
        enabled: true,
        policyNote: DEFAULT_COUNTRY_POLICY
      }
    ]
  }
};
function createInitialStore() {
  return {
    nextOrderSeq: 1003,
    nextEnquirySeq: 2001,
    nextPortfolioSeq: 1001,
    nextCatalogueRequestSeq: 3001,
    settings: structuredClone(DEFAULT_COMMERCE_SETTINGS),
    adminAllowlistEmails: [BOOTSTRAP_ADMIN_EMAIL],
    adminRolesByEmail: {
      [BOOTSTRAP_ADMIN_EMAIL.toLowerCase()]: "super_admin"
    },
    auditLogs: [],
    stockOverrides: {},
    exportOverrides: {},
    orders: {},
    customers: {},
    enquiries: {},
    portfolios: {},
    catalogueRequests: {},
    idempotencyIndex: {},
    processedWebhookEvents: {}
  };
}
function ensureDirectories() {
  fs2.mkdirSync(DATA_DIR, { recursive: true });
  fs2.mkdirSync(SLIPS_DIR, { recursive: true });
  fs2.mkdirSync(PORTFOLIOS_DIR, { recursive: true });
}
function mergeCurrencies(saved, usdToLkrRate) {
  const baseList = structuredClone(DEFAULT_CURRENCIES);
  const byCode = /* @__PURE__ */ new Map();
  for (const item of baseList) {
    byCode.set(item.code, item);
  }
  for (const raw of saved ?? []) {
    const code = String(raw.code || "").trim().toUpperCase();
    if (!code) continue;
    const prev = byCode.get(code);
    byCode.set(code, {
      code,
      symbol: String(raw.symbol || prev?.symbol || code).slice(0, 8),
      name: String(raw.name || prev?.name || code).slice(0, 50),
      ratePerUsd: code === "USD" ? 1 : code === "LKR" ? Math.max(1, Number(raw.ratePerUsd) || usdToLkrRate || 300) : Math.max(1e-4, Number(raw.ratePerUsd) || prev?.ratePerUsd || 1),
      enabled: code === "LKR" || code === "USD" ? raw.enabled !== false : Boolean(raw.enabled),
      isDefault: prev?.isDefault
    });
  }
  return Array.from(byCode.values());
}
function readStoreSync() {
  ensureDirectories();
  if (!fs2.existsSync(STORE_FILE)) {
    const fresh = createInitialStore();
    fs2.writeFileSync(STORE_FILE, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }
  const raw = fs2.readFileSync(STORE_FILE, "utf8");
  const parsed = JSON.parse(raw);
  const usdToLkr = parsed.settings?.shipping?.usdToLkrRate ?? DEFAULT_COMMERCE_SETTINGS.shipping.usdToLkrRate;
  const intlRates = (parsed.settings?.shipping?.internationalRates ?? DEFAULT_COMMERCE_SETTINGS.shipping.internationalRates).map((r) => {
    const def = DEFAULT_COMMERCE_SETTINGS.shipping.internationalRates.find(
      (d) => d.country.toLowerCase() === r.country.toLowerCase()
    );
    return {
      ...r,
      policyNote: r.policyNote ?? def?.policyNote ?? DEFAULT_COUNTRY_POLICY
    };
  });
  return {
    nextOrderSeq: parsed.nextOrderSeq ?? 1003,
    nextEnquirySeq: parsed.nextEnquirySeq ?? 2001,
    nextPortfolioSeq: parsed.nextPortfolioSeq ?? 1001,
    nextCatalogueRequestSeq: parsed.nextCatalogueRequestSeq ?? 3001,
    settings: {
      ...DEFAULT_COMMERCE_SETTINGS,
      ...parsed.settings,
      brandWhatsappNumbers: {
        ...DEFAULT_COMMERCE_SETTINGS.brandWhatsappNumbers,
        ...parsed.settings?.brandWhatsappNumbers ?? {}
      },
      portfolioSettings: {
        ...DEFAULT_COMMERCE_SETTINGS.portfolioSettings,
        ...parsed.settings?.portfolioSettings ?? {}
      },
      currencies: mergeCurrencies(parsed.settings?.currencies, usdToLkr),
      exportConfig: {
        ...DEFAULT_COMMERCE_SETTINGS.exportConfig,
        ...parsed.settings?.exportConfig
      },
      payment: {
        ...DEFAULT_COMMERCE_SETTINGS.payment,
        ...parsed.settings?.payment,
        whatsappOrderEnabled: parsed.settings?.payment?.whatsappOrderEnabled !== false,
        bankDetails: {
          ...DEFAULT_COMMERCE_SETTINGS.payment.bankDetails,
          ...parsed.settings?.payment?.bankDetails
        }
      },
      shipping: {
        ...DEFAULT_COMMERCE_SETTINGS.shipping,
        ...parsed.settings?.shipping,
        internationalRates: intlRates
      }
    },
    adminAllowlistEmails: parsed.adminAllowlistEmails?.length ? parsed.adminAllowlistEmails : [BOOTSTRAP_ADMIN_EMAIL],
    adminRolesByEmail: {
      ...Object.fromEntries(
        (parsed.adminAllowlistEmails ?? []).map((e) => [String(e).toLowerCase(), "super_admin"])
      ),
      ...parsed.adminRolesByEmail ?? {},
      [BOOTSTRAP_ADMIN_EMAIL.toLowerCase()]: "super_admin"
    },
    auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs.slice(0, 500) : [],
    stockOverrides: parsed.stockOverrides ?? {},
    exportOverrides: parsed.exportOverrides ?? {},
    orders: parsed.orders ?? {},
    customers: parsed.customers ?? {},
    enquiries: parsed.enquiries ?? {},
    portfolios: parsed.portfolios ?? {},
    catalogueRequests: parsed.catalogueRequests ?? {},
    idempotencyIndex: parsed.idempotencyIndex ?? {},
    processedWebhookEvents: parsed.processedWebhookEvents ?? {}
  };
}
function writeStoreSync(store) {
  ensureDirectories();
  const tmpPath = `${STORE_FILE}.${process.pid}.tmp`;
  fs2.writeFileSync(tmpPath, JSON.stringify(store, null, 2), "utf8");
  fs2.renameSync(tmpPath, STORE_FILE);
}
var storeQueue = Promise.resolve();
function withStoreLock(fn) {
  const run = storeQueue.then(async () => {
    const current = readStoreSync();
    const result = await fn(current);
    writeStoreSync(current);
    return result;
  });
  storeQueue = run.catch(() => void 0);
  return run;
}
function getStoreReadonly() {
  return readStoreSync();
}
function decodeFirestoreValue(val) {
  if ("stringValue" in val) return val.stringValue;
  if ("booleanValue" in val) return val.booleanValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return Number(val.doubleValue);
  if ("arrayValue" in val) {
    return (val.arrayValue?.values ?? []).map(decodeFirestoreValue);
  }
  if ("mapValue" in val) {
    const out = {};
    for (const [k, v] of Object.entries(val.mapValue?.fields ?? {})) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  return void 0;
}
var catalogCache = null;
function readFallbackProducts() {
  const raw = fs2.readFileSync(PRODUCTS_JSON_PATH, "utf8");
  return JSON.parse(raw);
}
function computeDefaultExportUsd(product) {
  const sorted = [...product.variants].sort((a, b) => b.weightGrams - a.weightGrams);
  const largest = sorted[0] ?? product.variants[0];
  if (!largest) return 15;
  const perKg = largest.priceUsd / Math.max(50, largest.weightGrams) * 1e3 * 0.85;
  return Number(perKg.toFixed(2));
}
async function getAuthoritativeProducts(store) {
  const activeStore = store ?? readStoreSync();
  const now = Date.now();
  let baseProducts = catalogCache && now - catalogCache.fetchedAt < 15e3 ? catalogCache.products : null;
  if (!baseProducts) {
    try {
      const cfg = JSON.parse(fs2.readFileSync(FIREBASE_CONFIG_PATH, "utf8"));
      const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/${encodeURIComponent(cfg.firestoreDatabaseId)}/documents/products?pageSize=100`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(3e3) });
      if (resp.ok) {
        const json = await resp.json();
        const decoded = (json.documents ?? []).map((d) => decodeFirestoreValue({ mapValue: { fields: d.fields ?? {} } })).filter((p) => p && p.id && !p.isArchived);
        if (decoded.length > 0) {
          baseProducts = decoded;
          catalogCache = { products: decoded, fetchedAt: now };
        }
      }
    } catch {
    }
  }
  if (!baseProducts) {
    baseProducts = readFallbackProducts();
  }
  return baseProducts.map((p) => {
    const expOverride = activeStore.exportOverrides[p.id];
    const defaultPacks = p.bulkPackSizes && p.bulkPackSizes.length > 0 ? p.bulkPackSizes : [
      ...p.variants.map((v) => `${v.label} Retail Barrier Pouch`),
      "1kg Trade Foil Pouch",
      "5kg Export Bulk Pouch"
    ];
    return {
      ...p,
      exportable: expOverride ? expOverride.exportable : p.exportable !== false,
      moqUnits: expOverride?.moqUnits ?? p.moqUnits ?? activeStore.settings.exportConfig.defaultMoqUnits,
      exportPriceUsd: expOverride?.exportPriceUsd ?? p.exportPriceUsd ?? computeDefaultExportUsd(p),
      bulkPackSizes: expOverride?.bulkPackSizes && expOverride.bulkPackSizes.length > 0 ? expOverride.bulkPackSizes : defaultPacks,
      variants: p.variants.map((v) => {
        const override = activeStore.stockOverrides[v.variantSku];
        return override ? {
          ...v,
          stockQuantity: Math.max(0, override.stockQuantity),
          available: override.available && override.stockQuantity > 0
        } : v;
      })
    };
  });
}
function clearCatalogCache() {
  catalogCache = null;
}
function detectMagicMime(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 255 && buf[1] === 216 && buf[2] === 255) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71) {
    return { ext: "png", mime: "image/png" };
  }
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return { ext: "webp", mime: "image/webp" };
  }
  if (buf.subarray(0, 4).toString("ascii") === "%PDF") {
    return { ext: "pdf", mime: "application/pdf" };
  }
  return null;
}
function savePaymentSlip(base64Input) {
  ensureDirectories();
  const cleaned = base64Input.includes(",") ? base64Input.slice(base64Input.indexOf(",") + 1) : base64Input;
  const buf = Buffer.from(cleaned.trim(), "base64");
  if (buf.length === 0 || buf.length > 2 * 1024 * 1024) {
    throw new Error("Payment slip must be a non-empty file under 2MB.");
  }
  const detected = detectMagicMime(buf);
  if (!detected) {
    throw new Error("Payment slip must be a valid JPEG, PNG, WebP, or PDF file.");
  }
  const safeFile = `slip-${crypto2.randomUUID()}.${detected.ext}`;
  const resolved = path2.resolve(SLIPS_DIR, safeFile);
  if (!resolved.startsWith(SLIPS_DIR + path2.sep)) {
    throw new Error("Invalid payment slip path.");
  }
  fs2.writeFileSync(resolved, buf);
  return safeFile;
}
function resolveSafeSlipPath(fileName) {
  ensureDirectories();
  const base = path2.basename(fileName);
  if (!/^slip-[a-f0-9-]+\.(jpg|png|webp|pdf)$/i.test(base)) {
    return null;
  }
  const resolved = path2.resolve(SLIPS_DIR, base);
  if (!resolved.startsWith(SLIPS_DIR + path2.sep) || !fs2.existsSync(resolved)) {
    return null;
  }
  return resolved;
}
function savePortfolioPdfFile(fileName, pdfBuffer) {
  ensureDirectories();
  const base = path2.basename(fileName);
  if (!/^portfolio-[a-z0-9-]+\.pdf$/i.test(base)) {
    throw new Error("Invalid portfolio PDF file name.");
  }
  if (!pdfBuffer || pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("Generated portfolio binary must be a valid PDF.");
  }
  const resolved = path2.resolve(PORTFOLIOS_DIR, base);
  if (!resolved.startsWith(PORTFOLIOS_DIR + path2.sep)) {
    throw new Error("Invalid portfolio PDF destination path.");
  }
  fs2.writeFileSync(resolved, pdfBuffer);
  return base;
}
function resolveSafePortfolioPdfPath(fileName) {
  ensureDirectories();
  const base = path2.basename(fileName);
  if (!/^portfolio-[a-z0-9-]+\.pdf$/i.test(base)) {
    return null;
  }
  const resolved = path2.resolve(PORTFOLIOS_DIR, base);
  if (!resolved.startsWith(PORTFOLIOS_DIR + path2.sep) || !fs2.existsSync(resolved)) {
    return null;
  }
  return resolved;
}
function computeCatalogFingerprint(products) {
  const canonical = [...products].filter((p) => !p.isArchived).sort((a, b) => a.id.localeCompare(b.id)).map((p) => ({
    id: p.id,
    sku: p.sku,
    brandId: p.brandId,
    name: p.name,
    category: p.category,
    description: p.description,
    tastingNotes: p.tastingNotes,
    origin: p.origin,
    highlights: p.highlights,
    ingredients: p.ingredients,
    storageInstructions: p.storageInstructions,
    packagingType: p.packagingType,
    technicalSpecs: p.technicalSpecs,
    certifications: p.certifications,
    exportable: p.exportable,
    moqUnits: p.moqUnits,
    exportPriceUsd: p.exportPriceUsd,
    bulkPackSizes: p.bulkPackSizes,
    exportSpecs: p.exportSpecs,
    variants: p.variants.map((v) => ({
      sku: v.variantSku,
      label: v.label,
      g: v.weightGrams,
      lkr: v.priceLkr,
      usd: v.priceUsd,
      avail: v.available
    }))
  }));
  return crypto2.createHash("sha256").update(JSON.stringify(canonical)).digest("hex").slice(0, 16);
}
async function computeOrderQuote(params) {
  if (!Array.isArray(params.items) || params.items.length === 0 || params.items.length > 50) {
    throw new Error("Cart must contain between 1 and 50 items.");
  }
  const activeStore = params.store ?? readStoreSync();
  const currencyCfg = resolveConfiguredCurrency(params.currency, activeStore.settings);
  const resolvedCurrency = currencyCfg.code;
  const catalog = await getAuthoritativeProducts(activeStore);
  const merged = /* @__PURE__ */ new Map();
  for (const raw of params.items) {
    if (!raw || typeof raw.productId !== "string" || typeof raw.variantSku !== "string" || typeof raw.qty !== "number" || !Number.isInteger(raw.qty) || raw.qty < 1 || raw.qty > 100) {
      throw new Error("Every cart item must have a valid SKU and integer quantity between 1 and 100.");
    }
    const existing = merged.get(raw.variantSku);
    const nextQty = (existing?.qty ?? 0) + raw.qty;
    if (nextQty > 100) {
      throw new Error(`Maximum quantity per variant is 100 (${raw.variantSku}).`);
    }
    merged.set(raw.variantSku, {
      productId: raw.productId,
      variantSku: raw.variantSku,
      qty: nextQty
    });
  }
  const resolvedItems = [];
  let subtotalLkr = 0;
  let subtotalUsd = 0;
  let totalWeightGrams = 0;
  let itemCount = 0;
  for (const reqItem of merged.values()) {
    const product = catalog.find((p) => p.id === reqItem.productId && !p.isArchived);
    if (!product) {
      throw new Error(`Product ${reqItem.productId} is not available.`);
    }
    const variant = product.variants.find((v) => v.variantSku === reqItem.variantSku);
    if (!variant || !variant.available) {
      throw new Error(`Pack variant ${reqItem.variantSku} is currently unavailable.`);
    }
    if (variant.stockQuantity < reqItem.qty) {
      throw new Error(
        `Insufficient stock for ${product.name.en} (${variant.label}). Requested ${reqItem.qty}, only ${variant.stockQuantity} left.`
      );
    }
    const unitPrice = convertUsdToConfiguredCurrency(
      variant.priceUsd,
      currencyCfg,
      variant.priceLkr
    );
    subtotalLkr += variant.priceLkr * reqItem.qty;
    subtotalUsd += variant.priceUsd * reqItem.qty;
    totalWeightGrams += variant.weightGrams * reqItem.qty;
    itemCount += reqItem.qty;
    resolvedItems.push({
      productId: product.id,
      brandId: product.brandId,
      variantSku: variant.variantSku,
      name: `${product.name.en} (${variant.label})`,
      packSize: variant.label,
      weightGrams: variant.weightGrams,
      qty: reqItem.qty,
      unitPrice,
      unitPriceLkr: variant.priceLkr,
      unitPriceUsd: variant.priceUsd
    });
  }
  subtotalUsd = Number(subtotalUsd.toFixed(2));
  const subtotal = convertUsdToConfiguredCurrency(subtotalUsd, currencyCfg, subtotalLkr);
  const shippingResult = calculateAuthoritativeShipping({
    subtotalLkr,
    totalWeightGrams,
    country: params.country || "Sri Lanka",
    deliveryMethod: params.deliveryMethod,
    localZoneId: params.localZoneId,
    currency: resolvedCurrency,
    settings: activeStore.settings
  });
  const totalAmount = resolvedCurrency === "LKR" ? Math.round(subtotal + shippingResult.feeInCurrency) : Number((subtotal + shippingResult.feeInCurrency).toFixed(2));
  return {
    currency: resolvedCurrency,
    items: resolvedItems,
    subtotalLkr,
    subtotalUsd,
    subtotal,
    totalWeightGrams,
    shippingFee: shippingResult.feeInCurrency,
    shippingLabel: shippingResult.label,
    shippingPolicyNote: shippingResult.policyNote,
    freeShippingApplied: shippingResult.freeShippingApplied,
    isQuotePending: shippingResult.isQuotePending,
    totalAmount,
    itemCount
  };
}
var CommerceHttpError = class extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
};
async function createServerOrder(input) {
  const rawAny = input;
  if ("cardNumber" in rawAny || "cvv" in rawAny || "cardCvc" in rawAny) {
    throw new CommerceHttpError(400, "Raw card details must never be submitted to this endpoint.");
  }
  if (!input.idempotencyKey || typeof input.idempotencyKey !== "string" || input.idempotencyKey.trim().length < 8 || input.idempotencyKey.trim().length > 128) {
    throw new CommerceHttpError(400, "A valid submission idempotency key is required.");
  }
  const isWhatsappQuickOrder = input.paymentMethod === "whatsapp_order";
  const cleanName = sanitizePlainText(input.customerName, 120);
  const rawEmail = sanitizePlainText(input.email, 180).toLowerCase();
  const cleanEmail = rawEmail || (isWhatsappQuickOrder ? "whatsapp-concierge@ceylonheritage.local" : "");
  const cleanPhone = sanitizePlainText(input.phone, 40);
  const cleanCountry = sanitizePlainText(input.country || (isWhatsappQuickOrder ? "Sri Lanka" : ""), 80);
  const cleanAddress = sanitizePlainText(input.address, 300);
  const cleanCity = sanitizePlainText(input.city || (isWhatsappQuickOrder ? "Direct Dispatch" : ""), 80);
  const cleanPostal = sanitizePlainText(input.postalCode || (isWhatsappQuickOrder ? "00000" : ""), 30);
  const cleanNotes = sanitizePlainText(input.orderNotes, 500);
  const cleanRef = sanitizePlainText(input.paymentReference, 120);
  if (cleanName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanPhone.length < 6 || cleanCountry.length < 2 || cleanAddress.length < 4 || cleanCity.length < 2 || cleanPostal.length < 2) {
    throw new CommerceHttpError(400, "Please complete all required customer and delivery address fields.");
  }
  const requestedCurrency = String(input.currency || "LKR").trim().toUpperCase();
  return withStoreLock(async (store) => {
    let currency;
    try {
      currency = resolveConfiguredCurrency(requestedCurrency, store.settings).code;
    } catch (err) {
      throw new CommerceHttpError(400, err instanceof Error ? err.message : "Unsupported currency.");
    }
    const idemKey = input.idempotencyKey.trim();
    const existingId = store.idempotencyIndex[idemKey];
    if (existingId && store.orders[existingId]) {
      throw new CommerceHttpError(409, "Duplicate order submission prevented.", {
        existingOrderRef: store.orders[existingId].orderRef
      });
    }
    const method = input.paymentMethod;
    if (method === "whatsapp_order") {
      if (store.settings.payment.whatsappOrderEnabled === false) {
        throw new CommerceHttpError(400, "WhatsApp ordering is currently disabled.");
      }
    } else if (method === "bank_transfer" && !store.settings.payment.bankTransferEnabled) {
      throw new CommerceHttpError(400, "Bank Transfer is currently disabled.");
    } else if (method === "cod") {
      if (!store.settings.payment.codEnabled) {
        throw new CommerceHttpError(400, "Payment on Delivery is currently disabled by administrator.");
      }
      if (cleanCountry.toLowerCase() !== "sri lanka") {
        throw new CommerceHttpError(400, "Payment on Delivery is only available within Sri Lanka.");
      }
    } else if (method === "sl_gateway" && !store.settings.payment.slGatewayEnabled) {
      throw new CommerceHttpError(400, "Sri Lankan payment gateway is not enabled.");
    } else if (method === "intl_gateway" && !store.settings.payment.intlGatewayEnabled) {
      throw new CommerceHttpError(400, "International payment gateway is not enabled.");
    } else if (!["whatsapp_order", "bank_transfer", "cod", "sl_gateway", "intl_gateway"].includes(method)) {
      throw new CommerceHttpError(400, "Unsupported payment method.");
    }
    let quote;
    try {
      quote = await computeOrderQuote({
        items: input.items,
        currency,
        country: cleanCountry,
        deliveryMethod: input.deliveryMethod,
        localZoneId: input.localZoneId,
        store
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid cart items.";
      const status = msg.includes("Insufficient stock") ? 409 : 400;
      throw new CommerceHttpError(status, msg);
    }
    let slipFile;
    if (input.paymentSlipBase64) {
      try {
        slipFile = savePaymentSlip(input.paymentSlipBase64);
      } catch (err) {
        throw new CommerceHttpError(
          400,
          err instanceof Error ? err.message : "Invalid payment slip file."
        );
      }
    }
    const catalog = await getAuthoritativeProducts(store);
    for (const item of quote.items) {
      const prod = catalog.find((p) => p.id === item.productId);
      const variant = prod?.variants.find((v) => v.variantSku === item.variantSku);
      const currentQty = variant?.stockQuantity ?? 0;
      const nextQty = currentQty - item.qty;
      if (nextQty < 0) {
        throw new CommerceHttpError(
          409,
          `Insufficient stock for ${item.name}. Available: ${currentQty}.`
        );
      }
      store.stockOverrides[item.variantSku] = {
        stockQuantity: nextQty,
        available: nextQty > 0
      };
    }
    const seq = store.nextOrderSeq++;
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const orderRef = `CH-${year}-${seq}`;
    const orderId = `ord-${year}-${seq}-${crypto2.randomBytes(2).toString("hex")}`;
    const receiptToken = crypto2.randomBytes(24).toString("hex");
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const monthKey = nowIso.slice(0, 7);
    const adapter = PAYMENT_ADAPTERS[method];
    const draftOrder = {
      id: orderId,
      orderRef,
      customerId: `cust-${crypto2.createHash("sha256").update(cleanEmail).digest("hex").slice(0, 12)}`,
      customerName: cleanName,
      customerEmail: cleanEmail,
      phone: cleanPhone,
      country: cleanCountry,
      address: cleanAddress,
      city: cleanCity,
      postalCode: cleanPostal,
      orderNotes: cleanNotes || void 0,
      deliveryMethod: input.deliveryMethod,
      localZoneId: input.localZoneId,
      paymentMethod: method,
      paymentReference: cleanRef || void 0,
      paymentSlipFile: slipFile,
      shippingStatus: "not_dispatched",
      currency,
      subtotal: quote.subtotal,
      shippingFee: quote.shippingFee,
      totalAmount: quote.totalAmount,
      totalWeightGrams: quote.totalWeightGrams,
      itemCount: quote.itemCount,
      items: quote.items,
      orderStatus: "pending",
      paymentStatus: "pending",
      receiptToken,
      monthKey,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    const paymentInit = adapter.initiatePayment(draftOrder, store.settings, {
      paymentReference: cleanRef,
      hasSlip: Boolean(slipFile)
    });
    draftOrder.paymentStatus = paymentInit.paymentStatus;
    draftOrder.orderStatus = method === "whatsapp_order" ? "new" : quote.isQuotePending ? "awaiting_payment" : paymentInit.orderStatus;
    if (paymentInit.transactionRef && !draftOrder.paymentReference) {
      draftOrder.paymentReference = paymentInit.transactionRef;
    }
    const initialHistory = {
      id: `pay-${crypto2.randomUUID().slice(0, 8)}`,
      eventType: "order_initiated",
      method,
      status: draftOrder.paymentStatus,
      amount: draftOrder.totalAmount,
      currency,
      transactionRef: draftOrder.paymentReference,
      note: paymentInit.instructions,
      actor: "customer_checkout",
      createdAt: nowIso
    };
    draftOrder.paymentHistory = [initialHistory];
    const custId = draftOrder.customerId;
    const prevCust = store.customers[custId];
    store.customers[custId] = {
      id: custId,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      country: cleanCountry,
      city: cleanCity,
      orderCount: (prevCust?.orderCount ?? 0) + 1,
      createdAt: prevCust?.createdAt ?? nowIso
    };
    store.orders[orderId] = draftOrder;
    store.idempotencyIndex[idemKey] = orderId;
    return draftOrder;
  });
}
async function attachBankTransferProof(params) {
  const cleanRef = String(params.paymentReference || "").trim().slice(0, 120);
  if (!cleanRef && !params.paymentSlipBase64) {
    throw new CommerceHttpError(400, "Provide a payment reference or upload a payment slip.");
  }
  return withStoreLock((store) => {
    const order = Object.values(store.orders).find((o) => o.orderRef === params.orderRef);
    if (!order || !safeEqualToken(order.receiptToken, params.receiptToken)) {
      throw new CommerceHttpError(403, "Invalid order receipt token.");
    }
    if (order.paymentMethod !== "bank_transfer") {
      throw new CommerceHttpError(400, "Payment slip submission only applies to Bank Transfer orders.");
    }
    if (order.paymentStatus === "paid" || order.orderStatus === "cancelled") {
      throw new CommerceHttpError(400, "This order can no longer be updated for bank verification.");
    }
    if (params.paymentSlipBase64) {
      order.paymentSlipFile = savePaymentSlip(params.paymentSlipBase64);
    }
    if (cleanRef) {
      order.paymentReference = cleanRef;
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    order.orderStatus = "payment_verification";
    order.paymentStatus = "pending_verification";
    order.updatedAt = nowIso;
    order.paymentHistory = [
      ...order.paymentHistory ?? [],
      {
        id: `pay-${crypto2.randomUUID().slice(0, 8)}`,
        eventType: "bank_proof_submitted",
        method: "bank_transfer",
        status: "pending_verification",
        amount: order.totalAmount,
        currency: order.currency,
        transactionRef: order.paymentReference,
        note: order.paymentSlipFile ? "Customer submitted reference & slip" : "Customer submitted reference",
        actor: "customer",
        createdAt: nowIso
      }
    ];
    return order;
  });
}
async function processVerifiedWebhook(params) {
  const adapter = PAYMENT_ADAPTERS[params.provider];
  if (!adapter?.verifyWebhook) {
    throw new CommerceHttpError(400, "This payment method does not support webhooks.");
  }
  return withStoreLock((store) => {
    let event;
    try {
      event = adapter.verifyWebhook(params.rawBody, params.headers, store.settings);
    } catch (err) {
      throw new CommerceHttpError(401, err instanceof Error ? err.message : "Invalid webhook signature.");
    }
    if (store.processedWebhookEvents[event.eventId]) {
      const existingOrder = Object.values(store.orders).find(
        (o) => o.orderRef === store.processedWebhookEvents[event.eventId].orderRef
      );
      if (existingOrder) {
        return { duplicate: true, order: existingOrder };
      }
      throw new CommerceHttpError(409, "Duplicate webhook event rejected.");
    }
    const order = Object.values(store.orders).find((o) => o.orderRef === event.orderRef);
    if (!order) {
      throw new CommerceHttpError(404, `Order ${event.orderRef} not found.`);
    }
    if (order.currency !== event.currency || Math.abs(order.totalAmount - event.amount) > 0.01) {
      throw new CommerceHttpError(
        400,
        `Webhook amount/currency mismatch. Expected ${order.currency} ${order.totalAmount}, received ${event.currency} ${event.amount}.`
      );
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    store.processedWebhookEvents[event.eventId] = {
      orderRef: order.orderRef,
      provider: params.provider,
      processedAt: nowIso
    };
    if (event.outcome === "paid") {
      order.paymentStatus = "paid";
      if (order.orderStatus === "awaiting_payment" || order.orderStatus === "payment_verification" || order.orderStatus === "pending") {
        order.orderStatus = "confirmed";
      }
    } else if (event.outcome === "refunded") {
      order.paymentStatus = "refunded";
      order.refundedAmount = order.totalAmount;
    } else {
      order.paymentStatus = "failed";
      order.orderStatus = "awaiting_payment";
    }
    order.paymentReference = event.transactionRef;
    order.updatedAt = nowIso;
    order.paymentHistory = [
      ...order.paymentHistory ?? [],
      {
        id: `pay-${crypto2.randomUUID().slice(0, 8)}`,
        eventType: `webhook_${event.outcome}`,
        method: params.provider,
        status: order.paymentStatus,
        amount: event.amount,
        currency: event.currency,
        transactionRef: event.transactionRef,
        note: event.rawSummary,
        actor: `webhook:${params.provider}`,
        createdAt: nowIso
      }
    ];
    return { duplicate: false, order };
  });
}
async function adminUpdateOrder(params) {
  return withStoreLock(async (store) => {
    const order = store.orders[params.orderId] ?? Object.values(store.orders).find((o) => o.orderRef === params.orderId);
    if (!order) {
      throw new CommerceHttpError(404, "Order not found.");
    }
    const prevStatus = order.orderStatus;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    if (params.orderStatus) {
      if (params.orderStatus === "cancelled" && prevStatus !== "cancelled") {
        const catalog = await getAuthoritativeProducts(store);
        for (const item of order.items) {
          const prod = catalog.find((p) => p.id === item.productId);
          const variant = prod?.variants.find((v) => v.variantSku === item.variantSku);
          const currentQty = variant?.stockQuantity ?? 0;
          const restored = currentQty + item.qty;
          store.stockOverrides[item.variantSku] = {
            stockQuantity: restored,
            available: restored > 0
          };
        }
      }
      order.orderStatus = params.orderStatus;
      if ((params.orderStatus === "shipped" || params.orderStatus === "dispatched") && (!order.shippingStatus || order.shippingStatus === "not_dispatched")) {
        order.shippingStatus = "in_transit";
      }
      if (params.orderStatus === "delivered" || params.orderStatus === "completed") {
        order.shippingStatus = "delivered";
      }
    }
    if (params.shippingStatus) {
      order.shippingStatus = params.shippingStatus;
    }
    if (typeof params.trackingNumber === "string") {
      order.trackingNumber = sanitizePlainText(params.trackingNumber, 100);
    }
    if (typeof params.carrier === "string") {
      order.carrier = sanitizePlainText(params.carrier, 80);
    }
    if (typeof params.adminNotes === "string") {
      order.adminNotes = sanitizePlainText(params.adminNotes, 500);
    }
    order.updatedAt = nowIso;
    recordAdminAuditLog(store, {
      actorEmail: params.actorEmail,
      action: "order_status_updated",
      targetType: "order",
      targetId: order.orderRef,
      summary: `Order ${prevStatus} -> ${order.orderStatus}; Shipping -> ${order.shippingStatus || "not_dispatched"}`
    });
    return order;
  });
}
async function adminVerifyBankTransfer(params) {
  return withStoreLock((store) => {
    const order = store.orders[params.orderId] ?? Object.values(store.orders).find((o) => o.orderRef === params.orderId);
    if (!order) {
      throw new CommerceHttpError(404, "Order not found.");
    }
    if (params.decision === "approve" && order.paymentStatus === "paid") {
      throw new CommerceHttpError(409, "Payment for this order has already been verified.");
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const cleanRef = (params.transactionRef || order.paymentReference || "").trim().slice(0, 120);
    if (cleanRef) {
      order.paymentReference = cleanRef;
    }
    if (params.decision === "approve") {
      order.paymentStatus = "paid";
      order.orderStatus = "confirmed";
    } else {
      order.paymentStatus = "failed";
      order.orderStatus = "awaiting_payment";
    }
    order.updatedAt = nowIso;
    order.paymentHistory = [
      ...order.paymentHistory ?? [],
      {
        id: `pay-${crypto2.randomUUID().slice(0, 8)}`,
        eventType: params.decision === "approve" ? "bank_transfer_verified" : "bank_transfer_rejected",
        method: order.paymentMethod || "bank_transfer",
        status: order.paymentStatus,
        amount: order.totalAmount,
        currency: order.currency,
        transactionRef: cleanRef || void 0,
        note: params.note ? sanitizePlainText(params.note, 200) : void 0,
        actor: params.actorEmail,
        createdAt: nowIso
      }
    ];
    recordAdminAuditLog(store, {
      actorEmail: params.actorEmail,
      action: params.decision === "approve" ? "bank_transfer_approved" : "bank_transfer_rejected",
      targetType: "payment",
      targetId: order.orderRef,
      summary: `${params.decision.toUpperCase()} payment ${order.currency} ${order.totalAmount}${cleanRef ? ` (Ref: ${cleanRef})` : ""}`
    });
    return order;
  });
}
async function adminRecordRefund(params) {
  if (typeof params.amount !== "number" || !Number.isFinite(params.amount) || params.amount <= 0) {
    throw new CommerceHttpError(400, "Refund amount must be positive.");
  }
  return withStoreLock((store) => {
    const order = store.orders[params.orderId] ?? Object.values(store.orders).find((o) => o.orderRef === params.orderId);
    if (!order) {
      throw new CommerceHttpError(404, "Order not found.");
    }
    if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") {
      throw new CommerceHttpError(400, "Only paid or partially refunded orders can be refunded.");
    }
    const prevRefunded = order.refundedAmount ?? 0;
    const nextRefunded = Number((prevRefunded + params.amount).toFixed(2));
    if (nextRefunded > order.totalAmount + 0.01) {
      throw new CommerceHttpError(400, "Refund amount cannot exceed total paid amount.");
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    order.refundedAmount = Math.min(order.totalAmount, nextRefunded);
    order.refundReason = params.reason.trim().slice(0, 240);
    const nextPaymentStatus = order.refundedAmount >= order.totalAmount - 0.01 ? "refunded" : "partially_refunded";
    order.paymentStatus = nextPaymentStatus;
    order.updatedAt = nowIso;
    order.paymentHistory = [
      ...order.paymentHistory ?? [],
      {
        id: `pay-${crypto2.randomUUID().slice(0, 8)}`,
        eventType: "refund_recorded",
        method: order.paymentMethod || "bank_transfer",
        status: nextPaymentStatus,
        amount: params.amount,
        currency: order.currency,
        transactionRef: params.transactionRef ? sanitizePlainText(params.transactionRef, 120) : void 0,
        note: order.refundReason,
        actor: params.actorEmail,
        createdAt: nowIso
      }
    ];
    recordAdminAuditLog(store, {
      actorEmail: params.actorEmail,
      action: "refund_recorded",
      targetType: "payment",
      targetId: order.orderRef,
      summary: `Refund ${order.currency} ${params.amount} (${nextPaymentStatus}) \u2014 ${order.refundReason}`
    });
    return order;
  });
}
function validateOptionalWebsiteUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return void 0;
  }
  if (trimmed.length > 240) {
    throw new CommerceHttpError(400, "Website URL must be 240 characters or fewer.");
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new CommerceHttpError(
      400,
      "Website must be a valid URL starting with https:// or http://."
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new CommerceHttpError(
      400,
      "Only https:// or http:// website links are permitted."
    );
  }
  return parsed.toString();
}
async function createInternationalEnquiry(input) {
  const companyName = sanitizePlainText(input.companyName, 140);
  const contactName = sanitizePlainText(input.contactName, 120);
  const email = sanitizePlainText(input.email, 180).toLowerCase();
  const phone = sanitizePlainText(input.phone, 40);
  const country = sanitizePlainText(input.country, 80);
  const website = validateOptionalWebsiteUrl(input.website);
  const businessType = input.businessType;
  const brandInterest = sanitizePlainText(input.brandInterest || "Ceyvana & Ceylomira", 80);
  const requiredQuantities = sanitizePlainText(input.requiredQuantities, 160);
  const packagingRequirements = sanitizePlainText(input.packagingRequirements, 200);
  const destinationCountry = sanitizePlainText(input.destinationCountry, 80);
  const message = sanitizePlainText(input.message, 2500);
  if (companyName.length < 2) {
    throw new CommerceHttpError(400, "Company name is required.");
  }
  if (contactName.length < 2) {
    throw new CommerceHttpError(400, "Contact person name is required.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new CommerceHttpError(400, "Please enter a valid business email address.");
  }
  if (country.length < 2 || destinationCountry.length < 2) {
    throw new CommerceHttpError(400, "Origin country and destination country are required.");
  }
  if (!VALID_BUSINESS_TYPES.includes(businessType)) {
    throw new CommerceHttpError(400, "Please select a valid business type.");
  }
  if (requiredQuantities.length < 1 || packagingRequirements.length < 2 || message.length < 5) {
    throw new CommerceHttpError(
      400,
      "Please specify required quantities, packaging requirements, and enquiry message."
    );
  }
  const productInterests = Array.isArray(input.productInterests) ? Array.from(
    new Set(
      input.productInterests.map((p) => String(p || "").trim().slice(0, 120)).filter(Boolean)
    )
  ).slice(0, 25) : [];
  return withStoreLock((store) => {
    const seq = store.nextEnquirySeq++;
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const enquiryRef = `INT-${year}-${seq}`;
    const id = `enq-int-${year}-${seq}-${crypto2.randomBytes(2).toString("hex")}`;
    const trackingToken = crypto2.randomBytes(16).toString("hex");
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      enquiryRef,
      trackingToken,
      type: input.type === "wholesale" ? "wholesale" : "export",
      companyName,
      contactName,
      email,
      phone: phone || void 0,
      country,
      website,
      businessType,
      brandInterest,
      productInterests,
      requiredQuantities,
      packagingRequirements,
      destinationCountry,
      message,
      status: "new",
      createdAt: nowIso,
      updatedAt: nowIso
    };
    store.enquiries[id] = record;
    return record;
  });
}
function trackInternationalEnquiry(params) {
  const refLower = String(params.enquiryRef || "").trim().toLowerCase();
  const credLower = String(params.credential || "").trim().toLowerCase();
  if (!refLower || !credLower) {
    throw new CommerceHttpError(400, "Enquiry reference and business email or tracking token are required.");
  }
  const store = getStoreReadonly();
  const match = Object.values(store.enquiries).find(
    (e) => e.enquiryRef.toLowerCase() === refLower
  );
  if (!match) {
    throw new CommerceHttpError(404, "Enquiry reference not found.");
  }
  const emailMatches = match.email.toLowerCase() === credLower;
  const tokenMatches = safeEqualToken(match.trackingToken.toLowerCase(), credLower);
  if (!emailMatches && !tokenMatches) {
    throw new CommerceHttpError(403, "Business email or tracking token does not match this enquiry.");
  }
  const countryPolicy = store.settings.shipping.internationalRates.find(
    (r) => r.country.toLowerCase() === match.destinationCountry.toLowerCase()
  )?.policyNote ?? store.settings.shipping.internationalRates.find(
    (r) => r.country.toLowerCase() === "rest of world"
  )?.policyNote;
  return {
    enquiryRef: match.enquiryRef,
    companyName: match.companyName,
    contactName: match.contactName,
    businessType: match.businessType,
    brandInterest: match.brandInterest,
    productInterests: match.productInterests,
    requiredQuantities: match.requiredQuantities,
    packagingRequirements: match.packagingRequirements,
    destinationCountry: match.destinationCountry,
    destinationPolicy: countryPolicy,
    status: match.status,
    adminResponse: match.adminResponse,
    respondedAt: match.respondedAt,
    quotation: match.quotation,
    createdAt: match.createdAt,
    updatedAt: match.updatedAt
  };
}
async function adminRespondToInternationalEnquiry(params) {
  const allowedStatuses = [
    "new",
    "reviewed",
    "quoted",
    "responded",
    "archived"
  ];
  if (!allowedStatuses.includes(params.status)) {
    throw new CommerceHttpError(400, "Invalid enquiry status.");
  }
  return withStoreLock((store) => {
    const existing = store.enquiries[params.id] ?? Object.values(store.enquiries).find((e) => e.enquiryRef === params.id);
    if (!existing) {
      throw new CommerceHttpError(404, "International enquiry not found.");
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    existing.status = params.status;
    if (typeof params.adminResponse === "string") {
      existing.adminResponse = sanitizePlainText(params.adminResponse, 2500);
      if (existing.adminResponse) {
        existing.respondedBy = params.actorEmail;
        existing.respondedAt = nowIso;
      }
    }
    if (params.quotation) {
      const currCode = params.quotation.currency ? resolveConfiguredCurrency(params.quotation.currency, store.settings).code : existing.quotation?.currency || "USD";
      existing.quotation = {
        currency: currCode,
        quotedAmount: typeof params.quotation.quotedAmount === "number" && Number.isFinite(params.quotation.quotedAmount) && params.quotation.quotedAmount >= 0 ? Number(params.quotation.quotedAmount.toFixed(2)) : void 0,
        shippingEstimateAmount: typeof params.quotation.shippingEstimateAmount === "number" && Number.isFinite(params.quotation.shippingEstimateAmount) && params.quotation.shippingEstimateAmount >= 0 ? Number(params.quotation.shippingEstimateAmount.toFixed(2)) : void 0,
        minOrderQty: params.quotation.minOrderQty ? sanitizePlainText(params.quotation.minOrderQty, 120) : void 0,
        shippingPolicy: params.quotation.shippingPolicy ? sanitizePlainText(params.quotation.shippingPolicy, 500) : void 0,
        validityNote: params.quotation.validityNote ? sanitizePlainText(params.quotation.validityNote, 240) : void 0,
        quotedAt: nowIso
      };
    }
    existing.updatedAt = nowIso;
    recordAdminAuditLog(store, {
      actorEmail: params.actorEmail,
      action: "international_enquiry_updated",
      targetType: "enquiry",
      targetId: existing.enquiryRef,
      summary: `Status -> ${existing.status}${existing.quotation ? `; Quoted ${existing.quotation.currency} ${existing.quotation.quotedAmount ?? "TBD"}` : ""}`
    });
    return existing;
  });
}
function escapeCsvCell(raw) {
  const str = String(raw ?? "").replace(/\r\n/g, " ").replace(/[\r\n]/g, " ");
  const neutralized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${neutralized.replace(/"/g, '""')}"`;
}
function buildInternationalEnquiriesCsv(records) {
  const headers = [
    "EnquiryRef",
    "Status",
    "CompanyName",
    "ContactName",
    "Email",
    "Phone",
    "OriginCountry",
    "DestinationCountry",
    "BusinessType",
    "Website",
    "BrandInterest",
    "ProductInterests",
    "RequiredQuantities",
    "PackagingRequirements",
    "Message",
    "QuotedCurrency",
    "QuotedAmount",
    "ShippingEstimate",
    "ConfirmedMOQ",
    "AdminResponse",
    "CreatedAt"
  ];
  const rows = records.map((r) => [
    r.enquiryRef,
    r.status,
    r.companyName,
    r.contactName,
    r.email,
    r.phone || "",
    r.country,
    r.destinationCountry,
    r.businessType,
    r.website || "",
    r.brandInterest,
    r.productInterests.join("; "),
    r.requiredQuantities,
    r.packagingRequirements,
    r.message,
    r.quotation?.currency || "",
    r.quotation?.quotedAmount ?? "",
    r.quotation?.shippingEstimateAmount ?? "",
    r.quotation?.minOrderQty || "",
    r.adminResponse || "",
    r.createdAt
  ]);
  return [headers.join(","), ...rows.map((row) => row.map(escapeCsvCell).join(","))].join("\n");
}
async function adminUpdateExportOverrides(updates, actorEmail = BOOTSTRAP_ADMIN_EMAIL) {
  return withStoreLock((store) => {
    for (const u of updates) {
      if (!u.productId) continue;
      store.exportOverrides[u.productId] = {
        exportable: Boolean(u.exportable),
        moqUnits: Math.max(1, Math.round(Number(u.moqUnits) || 25)),
        exportPriceUsd: Math.max(0.1, Number(Number(u.exportPriceUsd || 10).toFixed(2))),
        bulkPackSizes: Array.isArray(u.bulkPackSizes) ? u.bulkPackSizes.map((s) => sanitizePlainText(s, 80)).filter(Boolean).slice(0, 10) : []
      };
    }
    recordAdminAuditLog(store, {
      actorEmail,
      action: "export_catalog_synced",
      targetType: "export",
      targetId: `${updates.length}_products`,
      summary: `Synchronized export MOQ/pricing overrides for ${updates.length} product(s).`
    });
    return store.exportOverrides;
  });
}

// server/portfolios.ts
var VALID_BRANDS = ["ceyvana", "ceylomira", "hand-crafts"];
var VALID_COVERS = [
  "heritage_crest",
  "editorial_split",
  "gallery_minimal"
];
function resolveBrandWhatsapp(brandId, settings) {
  const brandSpecific = settings.brandWhatsappNumbers?.[brandId];
  return (brandSpecific || settings.whatsappNumber || "94770000000").replace(/[^0-9]/g, "");
}
function defaultBrandPortfolioTitle(brandId, language) {
  if (language === "si") {
    if (brandId === "ceyvana") return "\u0DC3\u0DD9\u0DBA\u0DD2\u0DC0\u0DCF\u0DB1\u0DCF \u0DB1\u0DD2\u0DBD \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1 \u0DB1\u0DCF\u0DB8\u0DCF\u0DC0\u0DBD\u0DD2\u0DBA";
    if (brandId === "ceylomira") return "\u0DC3\u0DD9\u0DBA\u0DD2\u0DBD\u0DDD\u0DB8\u0DD2\u0DBB\u0DCF \u0DB1\u0DD2\u0DBD \u0DAD\u0DDA \u0DB1\u0DCF\u0DB8\u0DCF\u0DC0\u0DBD\u0DD2\u0DBA";
    return "\u0DBD\u0D82\u0D9A\u0DCF \u0DC4\u0DC3\u0DCA\u0DAD \u0D9A\u0DBB\u0DCA\u0DB8\u0DCF\u0DB1\u0DCA\u0DAD \u0DB1\u0DCF\u0DB8\u0DCF\u0DC0\u0DBD\u0DD2\u0DBA";
  }
  if (brandId === "ceyvana") return "Ceyvana Official Spice Portfolio";
  if (brandId === "ceylomira") return "Ceylomira Official Tea Portfolio";
  return "Ceylon Hand Crafts Heritage Portfolio";
}
function nextSemanticVersionForBrand(existingPortfolios, brandId, language) {
  const same = existingPortfolios.filter((p) => p.brandId === brandId && p.language === language);
  if (same.length === 0) return "v1.0";
  let maxMinor = 0;
  for (const p of same) {
    const match = /^v1\.(\d+)/i.exec(p.version);
    if (match) {
      maxMinor = Math.max(maxMinor, Number(match[1]) || 0);
    }
  }
  return `v1.${same.length > maxMinor ? same.length : maxMinor + 1}`;
}
function filterBrandScopedProducts(params) {
  const brandOnly = params.allProducts.filter(
    (p) => p.brandId === params.brandId && !p.isArchived
  );
  if (params.scope === "categories" && params.categorySlugs.length > 0) {
    const set = new Set(params.categorySlugs);
    return brandOnly.filter((p) => set.has(p.categorySlug));
  }
  if (params.scope === "products" && params.productIds.length > 0) {
    const set = new Set(params.productIds);
    return brandOnly.filter((p) => set.has(p.id));
  }
  return brandOnly;
}
async function listAdminPortfolios() {
  const store = getStoreReadonly();
  const allProducts = await getAuthoritativeProducts(store);
  const list = Object.values(store.portfolios).map((p) => {
    const scoped = filterBrandScopedProducts({
      allProducts,
      brandId: p.brandId,
      scope: p.scope,
      categorySlugs: p.categorySlugs,
      productIds: p.productIds
    });
    const currentFingerprint = computeCatalogFingerprint(scoped);
    return {
      ...p,
      needsRegeneration: currentFingerprint !== p.catalogFingerprint
    };
  });
  return list.sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)));
}
function listPublishedPortfolios() {
  const store = getStoreReadonly();
  return Object.values(store.portfolios).filter((p) => p.status === "published").sort((a, b) => String(b.publishedAt || b.generatedAt).localeCompare(String(a.publishedAt || a.generatedAt)));
}
async function generateAdminPortfolio(params) {
  const { input } = params;
  if (!VALID_BRANDS.includes(input.brandId)) {
    throw new CommerceHttpError(400, "Please select a valid brand for portfolio generation.");
  }
  const language = input.language === "si" ? "si" : "en";
  const scope = input.scope === "categories" || input.scope === "products" ? input.scope : "all";
  const coverDesign = VALID_COVERS.includes(input.coverDesign) ? input.coverDesign : "heritage_crest";
  const orientation = input.orientation === "landscape" ? "landscape" : "portrait";
  const categorySlugs = Array.isArray(input.categorySlugs) ? Array.from(new Set(input.categorySlugs.map((s) => sanitizePlainText(s, 80)).filter(Boolean))) : [];
  const productIds = Array.isArray(input.productIds) ? Array.from(new Set(input.productIds.map((s) => sanitizePlainText(s, 80)).filter(Boolean))) : [];
  const fields = {
    ...DEFAULT_PORTFOLIO_FIELDS,
    ...input.fields ?? {},
    wholesalePrices: Boolean(input.fields?.wholesalePrices ?? false)
  };
  return withStoreLock(async (store) => {
    const authProducts = Array.isArray(input.productsOverride) && input.productsOverride.length > 0 ? input.productsOverride : await getAuthoritativeProducts(store);
    const scopedProducts = filterBrandScopedProducts({
      allProducts: authProducts,
      brandId: input.brandId,
      scope,
      categorySlugs,
      productIds
    });
    if (scopedProducts.length === 0) {
      throw new CommerceHttpError(
        400,
        `No verified products matched the selected scope for brand "${input.brandId}".`
      );
    }
    const reqCurrency = String(input.currency || "USD").trim().toUpperCase();
    const currencyCfg = store.settings.currencies.find((c) => c.code === reqCurrency) ?? store.settings.currencies.find((c) => c.code === "USD");
    const seq = store.nextPortfolioSeq++;
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const id = `pf-${input.brandId}-${language}-${year}-${seq}-${crypto3.randomBytes(2).toString("hex")}`;
    const existingForBrand = Object.values(store.portfolios);
    const version = sanitizePlainText(input.version, 24) || nextSemanticVersionForBrand(existingForBrand, input.brandId, language);
    const title = sanitizePlainText(input.title, 140) || defaultBrandPortfolioTitle(input.brandId, language);
    const whatsappNumber = sanitizePlainText(input.whatsappNumber, 24).replace(/[^0-9]/g, "") || resolveBrandWhatsapp(input.brandId, store.settings);
    const websiteUrl = sanitizePlainText(input.websiteUrl, 160) || params.originUrl;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const pdfResult = await generateBrandPortfolioPdf({
      brandId: input.brandId,
      language,
      currency: currencyCfg?.code || reqCurrency,
      currencyConfig: currencyCfg,
      title,
      version,
      coverDesign,
      orientation,
      introMessage: sanitizePlainText(input.introMessage, 900),
      companyProfile: sanitizePlainText(input.companyProfile, 500),
      contactInfo: sanitizePlainText(input.contactInfo, 300),
      websiteUrl,
      whatsappNumber,
      omittedFieldNote: sanitizePlainText(input.omittedFieldNote, 240),
      fields,
      products: scopedProducts,
      generatedAtIso: nowIso
    });
    const pdfFileName = savePortfolioPdfFile(`portfolio-${id}.pdf`, pdfResult.buffer);
    const catalogFingerprint = computeCatalogFingerprint(scopedProducts);
    const record = {
      id,
      brandId: input.brandId,
      language,
      currency: currencyCfg?.code || reqCurrency,
      title,
      version,
      status: "draft",
      scope,
      categorySlugs,
      productIds,
      coverDesign,
      orientation,
      introMessage: sanitizePlainText(input.introMessage, 900),
      companyProfile: sanitizePlainText(input.companyProfile, 500),
      contactInfo: sanitizePlainText(input.contactInfo, 300),
      websiteUrl,
      whatsappNumber,
      omittedFieldNote: sanitizePlainText(input.omittedFieldNote, 240) || void 0,
      fields,
      productCount: pdfResult.productCount,
      catalogFingerprint,
      pdfFileName,
      pageCount: pdfResult.pageCount,
      fileSizeBytes: pdfResult.buffer.byteLength,
      generatedBy: params.actorEmail,
      generatedAt: nowIso,
      updatedAt: nowIso,
      needsRegeneration: false
    };
    store.portfolios[id] = record;
    recordAdminAuditLog(store, {
      actorEmail: params.actorEmail,
      action: "portfolio_generated",
      targetType: "portfolio",
      targetId: `${record.brandId}:${record.version}`,
      summary: `Generated ${record.language.toUpperCase()} PDF draft "${record.title}" (${record.pageCount} pages, ${record.productCount} products).`
    });
    return record;
  });
}
async function updateAdminPortfolioStatus(params) {
  if (!["draft", "published", "unpublished"].includes(params.status)) {
    throw new CommerceHttpError(400, "Invalid portfolio status.");
  }
  return withStoreLock((store) => {
    const existing = store.portfolios[params.id];
    if (!existing) {
      throw new CommerceHttpError(404, "Portfolio record not found.");
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    existing.status = params.status;
    existing.updatedAt = nowIso;
    if (params.status === "published" && !existing.publishedAt) {
      existing.publishedAt = nowIso;
    }
    recordAdminAuditLog(store, {
      actorEmail: params.actorEmail,
      action: `portfolio_${params.status}`,
      targetType: "portfolio",
      targetId: `${existing.brandId}:${existing.version}`,
      summary: `Changed portfolio "${existing.title}" (${existing.version}) status -> ${params.status}.`
    });
    return existing;
  });
}
async function buildPublicCustomPortfolioPdf(params) {
  if (!VALID_BRANDS.includes(params.brandId)) {
    throw new CommerceHttpError(400, "Please choose a valid brand.");
  }
  const store = getStoreReadonly();
  if (store.settings.portfolioSettings?.allowCustomPublicCatalogSelection === false) {
    throw new CommerceHttpError(
      403,
      "Custom category/product PDF builder is currently disabled by administrator."
    );
  }
  if (store.settings.portfolioSettings?.requireRegistrationForPublicDownload) {
    throw new CommerceHttpError(
      403,
      "Administrator requires submitting a Catalogue Request before custom PDF download."
    );
  }
  const authProducts = await getAuthoritativeProducts(store);
  const scoped = filterBrandScopedProducts({
    allProducts: authProducts,
    brandId: params.brandId,
    scope: params.scope,
    categorySlugs: params.categorySlugs ?? [],
    productIds: params.productIds ?? []
  });
  if (scoped.length === 0) {
    throw new CommerceHttpError(400, "No verified products selected for this brand.");
  }
  const language = params.language === "si" ? "si" : "en";
  const reqCurrency = String(params.currency || "USD").trim().toUpperCase();
  const currencyCfg = store.settings.currencies.find((c) => c.code === reqCurrency && c.enabled) ?? store.settings.currencies.find((c) => c.code === "USD");
  const safeFields = {
    ...DEFAULT_PORTFOLIO_FIELDS,
    // Public on-demand PDFs NEVER include confidential wholesale pricing or unrequested MOQs
    wholesalePrices: false,
    moq: false
  };
  const result = await generateBrandPortfolioPdf({
    brandId: params.brandId,
    language,
    currency: currencyCfg?.code || "USD",
    currencyConfig: currencyCfg,
    title: defaultBrandPortfolioTitle(params.brandId, language),
    version: "Public Edition",
    coverDesign: "heritage_crest",
    orientation: "portrait",
    websiteUrl: params.originUrl,
    whatsappNumber: resolveBrandWhatsapp(params.brandId, store.settings),
    fields: safeFields,
    products: scoped,
    generatedAtIso: (/* @__PURE__ */ new Date()).toISOString()
  });
  return {
    ...result,
    fileName: `${params.brandId}-portfolio-${language}.pdf`
  };
}
async function createCatalogueRequest(input) {
  if (!VALID_BRANDS.includes(input.brandId)) {
    throw new CommerceHttpError(400, "Please select a valid brand.");
  }
  const customerName = sanitizePlainText(input.customerName, 120);
  const email = sanitizePlainText(input.email, 180).toLowerCase();
  const country = sanitizePlainText(input.country, 80);
  const companyName = sanitizePlainText(input.companyName, 140);
  const whatsappNumber = sanitizePlainText(input.whatsappNumber, 40);
  const notes = sanitizePlainText(input.notes, 1e3);
  const language = input.language === "si" ? "si" : "en";
  const scope = input.scope === "categories" || input.scope === "products" ? input.scope : "all";
  if (customerName.length < 2) {
    throw new CommerceHttpError(400, "Please provide your full name.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new CommerceHttpError(400, "Please provide a valid email address.");
  }
  if (country.length < 2) {
    throw new CommerceHttpError(400, "Please select or enter your country.");
  }
  const requestedCategories = Array.isArray(input.requestedCategories) ? Array.from(new Set(input.requestedCategories.map((c) => sanitizePlainText(c, 80)).filter(Boolean))).slice(0, 20) : [];
  const requestedProducts = Array.isArray(input.requestedProducts) ? Array.from(new Set(input.requestedProducts.map((p) => sanitizePlainText(p, 120)).filter(Boolean))).slice(0, 30) : [];
  return withStoreLock((store) => {
    const seq = store.nextCatalogueRequestSeq++;
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const requestRef = `CAT-${year}-${seq}`;
    const id = `catreq-${year}-${seq}-${crypto3.randomBytes(2).toString("hex")}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      requestRef,
      brandId: input.brandId,
      language,
      customerName,
      email,
      country,
      companyName: companyName || void 0,
      whatsappNumber: whatsappNumber || void 0,
      scope,
      requestedCategories,
      requestedProducts,
      notes: notes || void 0,
      status: "new",
      createdAt: nowIso,
      updatedAt: nowIso
    };
    store.catalogueRequests[id] = record;
    return record;
  });
}
function listAdminCatalogueRequests() {
  const store = getStoreReadonly();
  return Object.values(store.catalogueRequests).sort(
    (a, b) => String(b.createdAt).localeCompare(String(a.createdAt))
  );
}
async function updateAdminCatalogueRequest(params) {
  if (!["new", "reviewed", "sent", "archived"].includes(params.status)) {
    throw new CommerceHttpError(400, "Invalid catalogue request status.");
  }
  return withStoreLock((store) => {
    const existing = store.catalogueRequests[params.id] ?? Object.values(store.catalogueRequests).find((r) => r.requestRef === params.id);
    if (!existing) {
      throw new CommerceHttpError(404, "Catalogue request not found.");
    }
    if (params.assignedPortfolioId) {
      const pf = store.portfolios[params.assignedPortfolioId];
      if (!pf) {
        throw new CommerceHttpError(404, "Assigned portfolio version was not found.");
      }
      if (pf.brandId !== existing.brandId) {
        throw new CommerceHttpError(
          400,
          `Assigned portfolio (${pf.brandId}) must match requested brand (${existing.brandId}).`
        );
      }
      if (pf.status !== "published") {
        throw new CommerceHttpError(
          400,
          "Only a Published portfolio version may be assigned to a customer request."
        );
      }
      existing.assignedPortfolioId = pf.id;
      existing.assignedPortfolioVersion = pf.version;
    }
    if (typeof params.adminNotes === "string") {
      existing.adminNotes = sanitizePlainText(params.adminNotes, 1e3);
    }
    existing.status = params.status;
    existing.updatedBy = params.actorEmail;
    existing.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    recordAdminAuditLog(store, {
      actorEmail: params.actorEmail,
      action: "catalogue_request_updated",
      targetType: "catalogue_request",
      targetId: existing.requestRef,
      summary: `Updated ${existing.requestRef} -> ${existing.status}${existing.assignedPortfolioVersion ? ` (${existing.assignedPortfolioVersion})` : ""}.`
    });
    return existing;
  });
}

// server.ts
function escapeXml(raw) {
  return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function resolveRequestOrigin(req) {
  if (process.env.APP_URL && /^https?:\/\//i.test(process.env.APP_URL)) {
    return process.env.APP_URL.replace(/\/+$/, "");
  }
  const host = req.get("host") || "localhost:3000";
  const proto = req.headers["x-forwarded-proto"] ? String(req.headers["x-forwarded-proto"]).split(",")[0].trim() : req.protocol || "http";
  return `${proto}://${host}`;
}
function isAllowedOriginHeader(originHeader, req) {
  try {
    const parsed = new URL(originHeader);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const reqHost = (req.get("host") || "").toLowerCase();
    if (reqHost && parsed.host.toLowerCase() === reqHost) {
      return true;
    }
    if (process.env.APP_URL) {
      try {
        const appHost = new URL(process.env.APP_URL).host.toLowerCase();
        if (parsed.host.toLowerCase() === appHost) return true;
      } catch {
      }
    }
    const hostname = parsed.hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".run.app");
  } catch {
    return false;
  }
}
function createSlidingWindowRateLimiter(maxRequests, windowMs) {
  const hits = /* @__PURE__ */ new Map();
  return (req, res, next) => {
    const xff = req.headers["x-forwarded-for"];
    const clientIp = (typeof xff === "string" ? xff.split(",")[0].trim() : req.ip || "unknown") || "unknown";
    const now = Date.now();
    const recent = (hits.get(clientIp) ?? []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1e3));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: "Too many requests. Please wait a moment before trying again."
      });
      return;
    }
    recent.push(now);
    hits.set(clientIp, recent);
    if (hits.size > 2e3) {
      for (const [k, v] of hits.entries()) {
        if (v.every((ts) => now - ts >= windowMs)) hits.delete(k);
      }
    }
    next();
  };
}
var ROOT_DIR2 = process.cwd();
var FIREBASE_CONFIG = JSON.parse(
  fs3.readFileSync(path3.resolve(ROOT_DIR2, "firebase-applet-config.json"), "utf8")
);
var ACTIVE_FIREBASE_PROJECT_ID = (process.env.FIREBASE_PROJECT_ID || "").trim() || FIREBASE_CONFIG.projectId;
var ACTIVE_FIREBASE_DATABASE_ID = (process.env.FIREBASE_DATABASE_ID || "").trim() || FIREBASE_CONFIG.firestoreDatabaseId || "(default)";
var adminApp = getApps().length ? getApp() : initializeApp({ projectId: ACTIVE_FIREBASE_PROJECT_ID });
var adminAuth = getAuth(adminApp);
var adminAppCheck = getAppCheck(adminApp);
var HTML_DOCUMENT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://www.google.com https://recaptcha.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https: blob:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://www.google.com https://recaptcha.net wss:",
  "frame-src 'self' blob: https://*.firebaseapp.com https://accounts.google.com https://www.google.com https://recaptcha.net",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");
function createApp(securityOverrides) {
  const app = express();
  app.disable("x-powered-by");
  const verifyIdTokenFn = securityOverrides?.verifyIdToken ?? ((token) => adminAuth.verifyIdToken(token));
  const verifyAppCheckTokenFn = securityOverrides?.verifyAppCheckToken ?? ((token) => adminAppCheck.verifyToken(token));
  function requireAdminAuth(allowedRoles) {
    return async (req, res, next) => {
      const authHeader = req.headers.authorization || "";
      const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
      if (!match) {
        res.status(401).json({ error: "Missing administrator authorization token." });
        return;
      }
      try {
        const decoded = await verifyIdTokenFn(match[1]);
        const email = (decoded.email || "").toLowerCase();
        if (!decoded.email_verified || !email) {
          res.status(403).json({ error: "Verified email required for admin access." });
          return;
        }
        const store = getStoreReadonly();
        const role = resolveAdminRole(store, email);
        if (!role) {
          res.status(403).json({ error: "Account does not have active administrator permissions." });
          return;
        }
        const firebaseClaims = decoded.firebase;
        const mfaVerified = Boolean(firebaseClaims?.sign_in_second_factor);
        if (process.env.ADMIN_REQUIRE_MFA === "true" && !mfaVerified) {
          res.status(403).json({
            error: "Multi-factor authentication (MFA) is required for administrator access.",
            code: "MFA_REQUIRED"
          });
          return;
        }
        if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
          res.status(403).json({
            error: `Insufficient administrator role privileges (${role}) for this operation.`
          });
          return;
        }
        req.adminEmail = email;
        req.adminRole = role;
        req.adminMfaVerified = mfaVerified;
        next();
      } catch {
        res.status(401).json({ error: "Invalid or expired Firebase ID token." });
      }
    };
  }
  async function verifyOptionalAppCheck(req, res, next) {
    if (process.env.ENFORCE_APP_CHECK !== "true") {
      next();
      return;
    }
    const token = String(req.headers["x-firebase-appcheck"] || "").trim();
    if (!token) {
      res.status(401).json({ error: "Valid Firebase App Check token is required." });
      return;
    }
    try {
      await verifyAppCheckTokenFn(token);
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired Firebase App Check token." });
    }
  }
  const writeRateLimiter = createSlidingWindowRateLimiter(
    Math.max(1, Number(process.env.RATE_LIMIT_WRITE_MAX || 25)),
    6e4
  );
  const readRateLimiter = createSlidingWindowRateLimiter(
    Math.max(1, Number(process.env.RATE_LIMIT_READ_MAX || 60)),
    6e4
  );
  app.use((req, res, next) => {
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
    if (req.secure || forwardedProto === "https") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    if (req.path.startsWith("/api/")) {
      const isPdfEndpoint = req.path.endsWith("/pdf") || req.path === "/api/portfolios/custom-pdf";
      res.setHeader(
        "Content-Security-Policy",
        isPdfEndpoint ? "default-src 'none'; frame-ancestors 'self'" : "default-src 'none'; frame-ancestors 'none'"
      );
      res.setHeader("Cache-Control", "no-store");
    } else if (req.method === "GET" && !req.path.startsWith("/assets/") && !req.path.startsWith("/src/") && !req.path.startsWith("/@")) {
      res.setHeader("Content-Security-Policy", HTML_DOCUMENT_CSP);
    }
    next();
  });
  app.use("/api", (req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !req.path.startsWith("/payments/webhook/")) {
      const originHeader = req.headers.origin;
      if (typeof originHeader === "string" && !isAllowedOriginHeader(originHeader, req)) {
        res.status(403).json({ error: "Cross-origin mutation rejected." });
        return;
      }
    }
    next();
  });
  app.use(
    express.json({
      limit: "4mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf.toString("utf8");
      }
    })
  );
  app.get("/robots.txt", (req, res) => {
    const origin = resolveRequestOrigin(req);
    const body = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /cart",
      "Disallow: /api/",
      "",
      `Sitemap: ${origin}/sitemap.xml`,
      ""
    ].join("\n");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(body);
  });
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const origin = resolveRequestOrigin(req);
      const store = getStoreReadonly();
      const products = (await getAuthoritativeProducts(store)).filter((p) => !p.isArchived);
      const staticEntries = [
        { path: "/", changefreq: "weekly", priority: "1.0" },
        { path: "/ceyvana", changefreq: "weekly", priority: "0.9" },
        { path: "/ceylomira", changefreq: "weekly", priority: "0.9" },
        { path: "/portfolio", changefreq: "weekly", priority: "0.9" },
        { path: "/wholesale", changefreq: "weekly", priority: "0.8" },
        { path: "/about", changefreq: "monthly", priority: "0.7" },
        { path: "/stories", changefreq: "weekly", priority: "0.7" },
        { path: "/contact", changefreq: "monthly", priority: "0.7" },
        { path: "/hand-crafts", changefreq: "monthly", priority: "0.5" },
        { path: "/privacy", changefreq: "yearly", priority: "0.4" },
        { path: "/terms", changefreq: "yearly", priority: "0.4" }
      ];
      const productEntries = products.map((p) => ({
        path: `/product/${encodeURIComponent(p.slug)}`,
        changefreq: "weekly",
        priority: "0.8"
      }));
      const allEntries = [...staticEntries, ...productEntries];
      const urlBlocks = allEntries.flatMap((entry) => {
        const enUrl = `${origin}${entry.path}`;
        const siPath = entry.path === "/" ? "/si" : `/si${entry.path}`;
        const siUrl = `${origin}${siPath}`;
        const alternates = [
          `    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(enUrl)}" />`,
          `    <xhtml:link rel="alternate" hreflang="si" href="${escapeXml(siUrl)}" />`,
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(enUrl)}" />`
        ].join("\n");
        return [
          `  <url>
    <loc>${escapeXml(enUrl)}</loc>
${alternates}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
          `  <url>
    <loc>${escapeXml(siUrl)}</loc>
${alternates}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
        ];
      }).join("\n");
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlBlocks}
</urlset>
`;
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=1800");
      res.send(xml);
    } catch {
      res.status(500).send("Unable to generate sitemap.");
    }
  });
  app.get("/api/health", (_req, res) => {
    const store = getStoreReadonly();
    res.json({
      ok: true,
      service: "ceylon-heritage-commerce",
      projectId: ACTIVE_FIREBASE_PROJECT_ID,
      databaseId: ACTIVE_FIREBASE_DATABASE_ID,
      sandboxMode: store.settings.payment.sandboxMode,
      slGatewayConfigured: PAYMENT_ADAPTERS.sl_gateway.isConfiguredForLive(),
      intlGatewayConfigured: PAYMENT_ADAPTERS.intl_gateway.isConfiguredForLive(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.get("/api/commerce/config", async (_req, res) => {
    try {
      const store = getStoreReadonly();
      const catalog = await getAuthoritativeProducts(store);
      const liveStockBySku = {};
      for (const p of catalog) {
        for (const v of p.variants) {
          liveStockBySku[v.variantSku] = {
            stockQuantity: v.stockQuantity,
            available: v.available
          };
        }
      }
      res.json({
        whatsappNumber: store.settings.whatsappNumber,
        brandWhatsappNumbers: store.settings.brandWhatsappNumbers,
        portfolioSettings: store.settings.portfolioSettings,
        currencies: store.settings.currencies,
        exportConfig: store.settings.exportConfig,
        payment: {
          ...store.settings.payment,
          slGatewayConfigured: PAYMENT_ADAPTERS.sl_gateway.isConfiguredForLive(),
          intlGatewayConfigured: PAYMENT_ADAPTERS.intl_gateway.isConfiguredForLive()
        },
        shipping: store.settings.shipping,
        liveStockBySku
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load config." });
    }
  });
  app.get("/api/export/catalog", async (_req, res) => {
    try {
      const store = getStoreReadonly();
      const products = (await getAuthoritativeProducts(store)).filter(
        (p) => !p.isArchived && p.exportable !== false
      );
      res.json({
        products,
        currencies: store.settings.currencies.filter((c) => c.enabled),
        exportConfig: store.settings.exportConfig,
        internationalRates: store.settings.shipping.internationalRates.filter((r) => r.enabled)
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load export catalog." });
    }
  });
  app.post("/api/commerce/quote", readRateLimiter, async (req, res) => {
    try {
      const body = req.body;
      const quote = await computeOrderQuote({
        items: body.items ?? [],
        currency: String(body.currency || "LKR").toUpperCase(),
        country: String(body.country || "Sri Lanka"),
        deliveryMethod: body.deliveryMethod || "local_standard",
        localZoneId: body.localZoneId
      });
      res.json(quote);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid quote request.";
      const status = msg.includes("Insufficient stock") ? 409 : 400;
      res.status(status).json({ error: msg });
    }
  });
  app.post(
    "/api/enquiries/international",
    writeRateLimiter,
    verifyOptionalAppCheck,
    async (req, res) => {
      try {
        const record = await createInternationalEnquiry(req.body);
        res.status(201).json({ enquiry: record });
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: err instanceof Error ? err.message : "Unable to submit enquiry." });
      }
    }
  );
  app.get("/api/enquiries/track", readRateLimiter, (req, res) => {
    try {
      const enquiryRef = String(req.query.enquiryRef || "").trim();
      const credential = String(req.query.credential || req.query.email || req.query.token || "").trim();
      const tracked = trackInternationalEnquiry({ enquiryRef, credential });
      res.json({ enquiry: tracked });
    } catch (err) {
      if (err instanceof CommerceHttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: "Unable to track enquiry." });
    }
  });
  app.get("/api/portfolios/published", (_req, res) => {
    const store = getStoreReadonly();
    const published = listPublishedPortfolios().map((p) => ({
      ...p,
      // Never expose confidential wholesale field flag summary or internal paths unnecessarily
      pdfUrl: `/api/portfolios/published/${encodeURIComponent(p.id)}/pdf`
    }));
    res.json({
      portfolios: published,
      portfolioSettings: store.settings.portfolioSettings
    });
  });
  app.get("/api/portfolios/published/:id/pdf", (req, res) => {
    const store = getStoreReadonly();
    if (store.settings.portfolioSettings?.requireRegistrationForPublicDownload) {
      res.status(403).json({
        error: "Public direct downloads require completing the Catalogue Request form per administrator policy."
      });
      return;
    }
    const pf = store.portfolios[String(req.params.id || "")];
    if (!pf || pf.status !== "published") {
      res.status(404).json({ error: "Published portfolio PDF not found." });
      return;
    }
    const resolved = resolveSafePortfolioPdfPath(pf.pdfFileName);
    if (!resolved) {
      res.status(404).json({ error: "Portfolio PDF file is missing on disk." });
      return;
    }
    const isPreview = req.query.preview === "1";
    const downloadName = `${pf.brandId}-portfolio-${pf.language}-${pf.version.replace(/[^a-z0-9._-]/gi, "")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${isPreview ? "inline" : "attachment"}; filename="${downloadName}"`
    );
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(resolved);
  });
  app.post("/api/portfolios/custom-pdf", writeRateLimiter, async (req, res) => {
    try {
      const body = req.body;
      const result = await buildPublicCustomPortfolioPdf({
        brandId: body.brandId,
        language: body.language === "si" ? "si" : "en",
        currency: body.currency,
        scope: body.scope === "categories" || body.scope === "products" ? body.scope : "all",
        categorySlugs: body.categorySlugs,
        productIds: body.productIds,
        originUrl: resolveRequestOrigin(req)
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${body.preview ? "inline" : "attachment"}; filename="${result.fileName}"`
      );
      res.setHeader("Cache-Control", "no-store");
      res.send(result.buffer);
    } catch (err) {
      if (err instanceof CommerceHttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: err instanceof Error ? err.message : "Unable to generate PDF." });
    }
  });
  app.post(
    "/api/catalogue-requests",
    writeRateLimiter,
    verifyOptionalAppCheck,
    async (req, res) => {
      try {
        const record = await createCatalogueRequest(req.body);
        res.status(201).json({ request: record });
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        res.status(400).json({
          error: err instanceof Error ? err.message : "Unable to submit catalogue request."
        });
      }
    }
  );
  app.post(
    "/api/orders",
    writeRateLimiter,
    verifyOptionalAppCheck,
    async (req, res) => {
      try {
        const order = await createServerOrder(req.body);
        res.status(201).json({ order });
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({ error: err.message, ...err.details ?? {} });
          return;
        }
        res.status(500).json({ error: err instanceof Error ? err.message : "Order creation failed." });
      }
    }
  );
  app.post(
    "/api/orders/:orderRef/bank-reference",
    writeRateLimiter,
    verifyOptionalAppCheck,
    async (req, res) => {
      try {
        const body = req.body;
        const order = await attachBankTransferProof({
          orderRef: String(req.params.orderRef),
          receiptToken: String(body.receiptToken || ""),
          paymentReference: body.paymentReference,
          paymentSlipBase64: body.paymentSlipBase64
        });
        res.json({ order });
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update proof." });
      }
    }
  );
  app.post("/api/orders/:orderRef/whatsapp-intent", writeRateLimiter, async (req, res) => {
    try {
      const { receiptToken } = req.body;
      await withStoreLock((store) => {
        const order = Object.values(store.orders).find((o) => o.orderRef === req.params.orderRef);
        if (!order || !safeEqualToken(order.receiptToken, receiptToken)) {
          throw new CommerceHttpError(403, "Invalid receipt token.");
        }
        order.whatsappHandoffAt = (/* @__PURE__ */ new Date()).toISOString();
      });
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof CommerceHttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: "Unable to log WhatsApp handoff." });
    }
  });
  app.get("/api/orders/lookup", readRateLimiter, (req, res) => {
    const orderRef = String(req.query.orderRef || "").trim();
    const token = String(req.query.token || "").trim();
    if (!orderRef || !token) {
      res.status(400).json({ error: "Order reference and receipt token are required." });
      return;
    }
    const store = getStoreReadonly();
    const order = Object.values(store.orders).find((o) => o.orderRef === orderRef);
    if (!order || !safeEqualToken(order.receiptToken, token)) {
      res.status(404).json({ error: "Order receipt not found." });
      return;
    }
    res.json({ order });
  });
  app.post("/api/payments/webhook/:provider", async (req, res) => {
    const provider = req.params.provider;
    const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
    try {
      const result = await processVerifiedWebhook({
        provider,
        rawBody,
        headers: req.headers
      });
      res.status(result.duplicate ? 409 : 200).json({
        duplicate: result.duplicate,
        orderRef: result.order.orderRef,
        paymentStatus: result.order.paymentStatus,
        orderStatus: result.order.orderStatus
      });
    } catch (err) {
      if (err instanceof CommerceHttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: err instanceof Error ? err.message : "Webhook rejected." });
    }
  });
  app.get("/api/admin/session", requireAdminAuth(), (req, res) => {
    res.json({
      session: {
        email: req.adminEmail,
        role: req.adminRole,
        mfaVerified: Boolean(req.adminMfaVerified),
        mfaRequired: process.env.ADMIN_REQUIRE_MFA === "true",
        appCheckEnforced: process.env.ENFORCE_APP_CHECK === "true"
      }
    });
  });
  app.get(
    "/api/admin/audit-logs",
    requireAdminAuth(["super_admin"]),
    (req, res) => {
      const store = getStoreReadonly();
      const q = String(req.query.q || "").trim().toLowerCase();
      const targetType = String(req.query.targetType || "all");
      let logs = store.auditLogs ?? [];
      if (targetType !== "all") {
        logs = logs.filter((entry) => entry.targetType === targetType);
      }
      if (q) {
        logs = logs.filter(
          (entry) => entry.actorEmail.toLowerCase().includes(q) || entry.action.toLowerCase().includes(q) || entry.targetId.toLowerCase().includes(q) || entry.summary.toLowerCase().includes(q)
        );
      }
      res.json({ logs: logs.slice(0, 200) });
    }
  );
  app.get(
    "/api/admin/orders",
    requireAdminAuth(["super_admin", "order_manager"]),
    (req, res) => {
      const store = getStoreReadonly();
      const q = String(req.query.q || "").trim().toLowerCase();
      const brand = String(req.query.brand || "all");
      const status = String(req.query.status || "all");
      const dateFrom = String(req.query.dateFrom || "").trim();
      const dateTo = String(req.query.dateTo || "").trim();
      let list = Object.values(store.orders).sort(
        (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );
      if (q) {
        list = list.filter(
          (o) => o.orderRef.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || (o.customerEmail || "").toLowerCase().includes(q) || (o.phone || "").toLowerCase().includes(q) || (o.paymentReference || "").toLowerCase().includes(q)
        );
      }
      if (brand !== "all") {
        list = list.filter((o) => o.items.some((i) => i.brandId === brand));
      }
      if (status !== "all") {
        list = list.filter((o) => o.orderStatus === status);
      }
      if (dateFrom) {
        list = list.filter((o) => String(o.createdAt || "").slice(0, 10) >= dateFrom);
      }
      if (dateTo) {
        list = list.filter((o) => String(o.createdAt || "").slice(0, 10) <= dateTo);
      }
      res.json({ orders: list, customers: Object.values(store.customers) });
    }
  );
  app.patch(
    "/api/admin/orders/:id/status",
    requireAdminAuth(["super_admin", "order_manager"]),
    async (req, res) => {
      try {
        const body = req.body;
        const updated = await adminUpdateOrder({
          orderId: String(req.params.id),
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          orderStatus: body.orderStatus,
          shippingStatus: body.shippingStatus,
          trackingNumber: body.trackingNumber,
          carrier: body.carrier,
          adminNotes: body.adminNotes
        });
        res.json({ order: updated });
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: err instanceof Error ? err.message : "Update failed." });
      }
    }
  );
  app.post(
    "/api/admin/orders/:id/verify-payment",
    requireAdminAuth(["super_admin", "order_manager"]),
    async (req, res) => {
      try {
        const body = req.body;
        if (body.decision !== "approve" && body.decision !== "reject") {
          res.status(400).json({ error: "Decision must be approve or reject." });
          return;
        }
        const updated = await adminVerifyBankTransfer({
          orderId: String(req.params.id),
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          decision: body.decision,
          transactionRef: body.transactionRef,
          note: body.note
        });
        res.json({ order: updated });
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: err instanceof Error ? err.message : "Verification failed." });
      }
    }
  );
  app.post(
    "/api/admin/orders/:id/refund",
    requireAdminAuth(["super_admin", "order_manager"]),
    async (req, res) => {
      try {
        const body = req.body;
        const updated = await adminRecordRefund({
          orderId: String(req.params.id),
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          amount: Number(body.amount),
          reason: String(body.reason || "Customer refund"),
          transactionRef: body.transactionRef
        });
        res.json({ order: updated });
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: err instanceof Error ? err.message : "Refund failed." });
      }
    }
  );
  function filterEnquiriesFromQuery(req) {
    const store = getStoreReadonly();
    const q = String(req.query.q || "").trim().toLowerCase();
    const status = String(req.query.status || "all");
    const businessType = String(req.query.businessType || "all");
    const country = String(req.query.country || "all").toLowerCase();
    let list = Object.values(store.enquiries).sort(
      (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );
    if (q) {
      list = list.filter(
        (e) => e.enquiryRef.toLowerCase().includes(q) || e.companyName.toLowerCase().includes(q) || e.contactName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.destinationCountry.toLowerCase().includes(q)
      );
    }
    if (status !== "all") {
      list = list.filter((e) => e.status === status);
    }
    if (businessType !== "all") {
      list = list.filter((e) => e.businessType === businessType);
    }
    if (country !== "all") {
      list = list.filter((e) => e.destinationCountry.toLowerCase() === country);
    }
    return list;
  }
  app.get(
    "/api/admin/enquiries",
    requireAdminAuth(["super_admin", "order_manager", "catalog_manager"]),
    (req, res) => {
      const list = filterEnquiriesFromQuery(req);
      res.json({ enquiries: list });
    }
  );
  app.get(
    "/api/admin/enquiries/export",
    requireAdminAuth(["super_admin", "order_manager"]),
    (req, res) => {
      const list = filterEnquiriesFromQuery(req);
      const csv = buildInternationalEnquiriesCsv(list);
      void withStoreLock((store) => {
        recordAdminAuditLog(store, {
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          action: "international_enquiries_exported",
          targetType: "export",
          targetId: `${list.length}_records`,
          summary: `Exported ${list.length} international buyer enquiry record(s) to CSV.`
        });
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="international-enquiries-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv"`
      );
      res.send(csv);
    }
  );
  app.patch(
    "/api/admin/enquiries/:id",
    requireAdminAuth(["super_admin", "order_manager"]),
    async (req, res) => {
      try {
        const body = req.body;
        const updated = await adminRespondToInternationalEnquiry({
          id: String(req.params.id),
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          status: body.status || "reviewed",
          adminResponse: body.adminResponse,
          quotation: body.quotation
        });
        res.json({ enquiry: updated });
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: err instanceof Error ? err.message : "Unable to update enquiry." });
      }
    }
  );
  app.post(
    "/api/admin/export-sync",
    requireAdminAuth(["super_admin", "catalog_manager"]),
    async (req, res) => {
      const { updates } = req.body;
      if (!Array.isArray(updates)) {
        res.status(400).json({ error: "updates array is required." });
        return;
      }
      const exportOverrides = await adminUpdateExportOverrides(
        updates,
        req.adminEmail || BOOTSTRAP_ADMIN_EMAIL
      );
      clearCatalogCache();
      res.json({ ok: true, exportOverrides });
    }
  );
  app.get(
    "/api/admin/slips/:fileName",
    requireAdminAuth(["super_admin", "order_manager"]),
    (req, res) => {
      const resolved = resolveSafeSlipPath(String(req.params.fileName || ""));
      if (!resolved) {
        res.status(404).json({ error: "Payment slip not found." });
        return;
      }
      res.sendFile(resolved);
    }
  );
  app.get(
    "/api/admin/settings",
    requireAdminAuth(["super_admin", "catalog_manager", "order_manager"]),
    (_req, res) => {
      const store = getStoreReadonly();
      res.json({
        settings: store.settings,
        slGatewayConfigured: PAYMENT_ADAPTERS.sl_gateway.isConfiguredForLive(),
        intlGatewayConfigured: PAYMENT_ADAPTERS.intl_gateway.isConfiguredForLive()
      });
    }
  );
  app.put(
    "/api/admin/settings",
    requireAdminAuth(["super_admin"]),
    async (req, res) => {
      try {
        const incoming = req.body;
        const saved = await withStoreLock((store) => {
          if (!incoming.payment.sandboxMode) {
            if (incoming.payment.slGatewayEnabled && !PAYMENT_ADAPTERS.sl_gateway.isConfiguredForLive()) {
              throw new CommerceHttpError(
                400,
                "Cannot activate live Sri Lankan gateway without server merchant credentials."
              );
            }
            if (incoming.payment.intlGatewayEnabled && !PAYMENT_ADAPTERS.intl_gateway.isConfiguredForLive()) {
              throw new CommerceHttpError(
                400,
                "Cannot activate live international gateway without server credentials."
              );
            }
          }
          const sanitizedCurrencies = (incoming.currencies?.length ? incoming.currencies : store.settings.currencies).map((c) => {
            const code = String(c.code || "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
            if (!code || code.length < 3) {
              throw new CommerceHttpError(400, "Currency code must be a valid 3-letter ISO code.");
            }
            const rate = code === "USD" ? 1 : Number(c.ratePerUsd);
            if (!Number.isFinite(rate) || rate <= 0) {
              throw new CommerceHttpError(
                400,
                `Administrator exchange rate for ${code} must be greater than 0.`
              );
            }
            return {
              code,
              symbol: sanitizePlainText(c.symbol || code, 8) || code,
              name: sanitizePlainText(c.name || code, 50) || code,
              ratePerUsd: code === "LKR" ? incoming.shipping?.usdToLkrRate || rate : rate,
              enabled: code === "LKR" || code === "USD" ? true : Boolean(c.enabled)
            };
          });
          const sanitizePhone = (raw, fallback) => String(raw || fallback || "94770000000").replace(/[^0-9]/g, "").slice(0, 20);
          const fallbackWhatsapp = sanitizePhone(
            incoming.whatsappNumber,
            store.settings.whatsappNumber
          );
          store.settings = {
            whatsappNumber: fallbackWhatsapp,
            brandWhatsappNumbers: {
              ceyvana: sanitizePhone(
                incoming.brandWhatsappNumbers?.ceyvana,
                store.settings.brandWhatsappNumbers?.ceyvana ?? fallbackWhatsapp
              ),
              ceylomira: sanitizePhone(
                incoming.brandWhatsappNumbers?.ceylomira,
                store.settings.brandWhatsappNumbers?.ceylomira ?? fallbackWhatsapp
              ),
              "hand-crafts": sanitizePhone(
                incoming.brandWhatsappNumbers?.["hand-crafts"],
                store.settings.brandWhatsappNumbers?.["hand-crafts"] ?? fallbackWhatsapp
              )
            },
            currencies: sanitizedCurrencies,
            exportConfig: incoming.exportConfig ?? store.settings.exportConfig,
            portfolioSettings: {
              requireRegistrationForPublicDownload: Boolean(
                incoming.portfolioSettings?.requireRegistrationForPublicDownload
              ),
              allowCustomPublicCatalogSelection: incoming.portfolioSettings?.allowCustomPublicCatalogSelection !== false
            },
            payment: {
              ...incoming.payment,
              whatsappOrderEnabled: incoming.payment?.whatsappOrderEnabled !== false
            },
            shipping: incoming.shipping
          };
          recordAdminAuditLog(store, {
            actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
            action: "commerce_settings_updated",
            targetType: "settings",
            targetId: "global",
            summary: `Updated payment/shipping/currency config (sandboxMode=${String(incoming.payment.sandboxMode)}, cod=${String(incoming.payment.codEnabled)}).`
          });
          return store.settings;
        });
        res.json({ settings: saved });
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: err instanceof Error ? err.message : "Failed to save settings." });
      }
    }
  );
  app.post(
    "/api/admin/stock-sync",
    requireAdminAuth(["super_admin", "catalog_manager"]),
    async (req, res) => {
      const { updates } = req.body;
      if (!Array.isArray(updates)) {
        res.status(400).json({ error: "updates array is required." });
        return;
      }
      await withStoreLock((store) => {
        for (const u of updates) {
          if (u.variantSku) {
            store.stockOverrides[u.variantSku] = {
              stockQuantity: Math.max(0, Math.round(Number(u.stockQuantity) || 0)),
              available: Boolean(u.available)
            };
          }
        }
        recordAdminAuditLog(store, {
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          action: "inventory_stock_synced",
          targetType: "stock",
          targetId: `${updates.length}_skus`,
          summary: `Updated authoritative stock overrides for ${updates.length} SKU variant(s).`
        });
      });
      clearCatalogCache();
      res.json({ ok: true });
    }
  );
  app.post(
    "/api/admin/admins-sync",
    requireAdminAuth(["super_admin"]),
    async (req, res) => {
      const { emails, entries } = req.body;
      if (!Array.isArray(emails) && !Array.isArray(entries)) {
        res.status(400).json({ error: "emails or entries array required." });
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      const roleMap = {
        [BOOTSTRAP_ADMIN_EMAIL.toLowerCase()]: "super_admin"
      };
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          const email = String(entry?.email || "").trim().toLowerCase();
          const role = entry?.role;
          if (!emailRegex.test(email)) continue;
          roleMap[email] = email === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ? "super_admin" : role === "catalog_manager" || role === "order_manager" || role === "super_admin" ? role : "order_manager";
        }
      } else if (Array.isArray(emails)) {
        for (const rawEmail of emails) {
          const email = String(rawEmail || "").trim().toLowerCase();
          if (!emailRegex.test(email)) continue;
          roleMap[email] = email === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ? "super_admin" : "super_admin";
        }
      }
      await withStoreLock((store) => {
        store.adminAllowlistEmails = Object.keys(roleMap);
        store.adminRolesByEmail = roleMap;
        recordAdminAuditLog(store, {
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          action: "admin_allowlist_synced",
          targetType: "admin_users",
          targetId: `${store.adminAllowlistEmails.length}_accounts`,
          summary: `Synchronized ${store.adminAllowlistEmails.length} verified admin access record(s).`
        });
      });
      res.json({ ok: true });
    }
  );
  app.post(
    "/api/admin/payments/simulate-webhook",
    requireAdminAuth(["super_admin"]),
    async (req, res) => {
      try {
        const body = req.body;
        const store = getStoreReadonly();
        if (!store.settings.payment.sandboxMode) {
          res.status(400).json({ error: "Sandbox simulator is only permitted in sandbox mode." });
          return;
        }
        const order = Object.values(store.orders).find((o) => o.orderRef === body.orderRef);
        if (!order) {
          res.status(404).json({ error: "Order reference not found." });
          return;
        }
        const adapter = PAYMENT_ADAPTERS[body.provider];
        if (!adapter?.createSandboxSignedWebhook) {
          res.status(400).json({ error: "Invalid gateway adapter." });
          return;
        }
        const eventId = body.eventId || `evt-${Date.now()}`;
        const signed = adapter.createSandboxSignedWebhook({
          eventId,
          orderRef: order.orderRef,
          outcome: body.outcome,
          amount: order.totalAmount,
          currency: order.currency,
          transactionRef: body.transactionRef || `SBX-${Date.now()}`
        });
        const result = await processVerifiedWebhook({
          provider: body.provider,
          rawBody: signed.payload,
          headers: signed.headers
        });
        await withStoreLock((locked) => {
          recordAdminAuditLog(locked, {
            actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
            action: "sandbox_webhook_simulated",
            targetType: "payment",
            targetId: order.orderRef,
            summary: `Simulated ${body.provider} webhook (${body.outcome}) with event ${eventId}.`
          });
        });
        res.status(result.duplicate ? 409 : 200).json({
          duplicate: result.duplicate,
          order: result.order,
          eventId
        });
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: err instanceof Error ? err.message : "Simulation failed." });
      }
    }
  );
  app.get(
    "/api/admin/portfolios",
    requireAdminAuth(["super_admin", "catalog_manager", "order_manager"]),
    async (_req, res) => {
      try {
        const portfolios = await listAdminPortfolios();
        res.json({ portfolios });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load portfolios." });
      }
    }
  );
  app.post(
    "/api/admin/portfolios/generate",
    requireAdminAuth(["super_admin", "catalog_manager"]),
    async (req, res) => {
      try {
        const portfolio = await generateAdminPortfolio({
          input: req.body,
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          originUrl: resolveRequestOrigin(req)
        });
        res.status(201).json({ portfolio });
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: err instanceof Error ? err.message : "Portfolio generation failed." });
      }
    }
  );
  app.post(
    "/api/admin/portfolios/:id/status",
    requireAdminAuth(["super_admin", "catalog_manager"]),
    async (req, res) => {
      try {
        const { status } = req.body;
        const updated = await updateAdminPortfolioStatus({
          id: String(req.params.id),
          status: status || "draft",
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL
        });
        res.json({ portfolio: updated });
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: err instanceof Error ? err.message : "Status update failed." });
      }
    }
  );
  app.get(
    "/api/admin/portfolios/:id/pdf",
    requireAdminAuth(["super_admin", "catalog_manager", "order_manager"]),
    (req, res) => {
      const store = getStoreReadonly();
      const pf = store.portfolios[String(req.params.id || "")];
      if (!pf) {
        res.status(404).json({ error: "Portfolio not found." });
        return;
      }
      const resolved = resolveSafePortfolioPdfPath(pf.pdfFileName);
      if (!resolved) {
        res.status(404).json({ error: "Portfolio PDF file missing on disk." });
        return;
      }
      const isPreview = req.query.preview === "1";
      const downloadName = `${pf.brandId}-portfolio-${pf.language}-${pf.version.replace(/[^a-z0-9._-]/gi, "")}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${isPreview ? "inline" : "attachment"}; filename="${downloadName}"`
      );
      res.sendFile(resolved);
    }
  );
  app.get(
    "/api/admin/catalogue-requests",
    requireAdminAuth(["super_admin", "catalog_manager", "order_manager"]),
    (_req, res) => {
      res.json({ requests: listAdminCatalogueRequests() });
    }
  );
  app.patch(
    "/api/admin/catalogue-requests/:id",
    requireAdminAuth(["super_admin", "catalog_manager", "order_manager"]),
    async (req, res) => {
      try {
        const body = req.body;
        const updated = await updateAdminCatalogueRequest({
          id: String(req.params.id),
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          status: body.status || "reviewed",
          assignedPortfolioId: body.assignedPortfolioId,
          adminNotes: body.adminNotes
        });
        res.json({ request: updated });
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: err instanceof Error ? err.message : "Unable to update request." });
      }
    }
  );
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
  });
  return app;
}
async function startServer() {
  const app = createApp();
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    const distDir = path3.resolve(ROOT_DIR2, "dist");
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders: (res, filePath) => {
          const normalized = filePath.replace(/\\/g, "/");
          if (normalized.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          } else if (normalized.includes("/assets/") || /\.(webp|woff2|js|css)$/i.test(normalized)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        }
      })
    );
    app.get("*", (req, res) => {
      if (req.path.startsWith("/assets/") || req.path.startsWith("/src/assets/")) {
        res.status(404).end();
        return;
      }
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path3.join(distDir, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  const port = Number(process.env.PORT || 3e3);
  app.listen(port, "0.0.0.0", () => {
    console.log(`Ceylon Heritage Commerce Server listening on port ${port}`);
  });
}
if (!process.env.COMMERCE_TEST_MODE && !process.env.FUNCTION_TARGET) {
  void startServer();
}
export {
  createApp
};
