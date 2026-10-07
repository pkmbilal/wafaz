// Request body for a WhatsApp authentication template with a copy-code button.
// Kept free of server-only imports so it can be unit-tested.
export function buildOtpTemplatePayload({
  toE164,
  code,
  template,
  language,
}: {
  toE164: string;
  code: string;
  template: string;
  language: string;
}) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toE164.replace(/^\+/, ""),
    type: "template",
    template: {
      name: template,
      language: { code: language },
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        // The copy-code button is a URL button whose single parameter is the code.
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
      ],
    },
  };
}
