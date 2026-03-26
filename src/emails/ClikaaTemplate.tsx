/**
 * ClikaaTemplate — master branded email template
 *
 * Rendered to an HTML string server-side via renderClikaaEmail().
 * No external email library required — plain HTML/inline-CSS only.
 */

export interface ClikaaEmailData {
  /** Pre-header text shown in inbox previews (optional) */
  preheader?: string
  /** Heading shown below the logo */
  heading: string
  /** One or more body paragraphs */
  body: string | string[]
  /** Primary CTA button */
  cta?: {
    label: string
    url: string
  }
  /** Footer line beneath the CTA (e.g. "You received this because…") */
  footerNote?: string
}

// ---------------------------------------------------------------------------
// Inline styles — monochromatic Clikaa palette
// ---------------------------------------------------------------------------

const S = {
  /** Full-page wrapper */
  page: [
    'margin:0;padding:0;',
    'background-color:#f5f5f5;',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;',
  ].join(''),

  /** Centred card */
  card: [
    'max-width:560px;',
    'margin:40px auto;',
    'background:#ffffff;',
    'border-radius:12px;',
    'overflow:hidden;',
    'box-shadow:0 1px 4px rgba(0,0,0,0.08);',
  ].join(''),

  /** Logo strip */
  header: [
    'padding:32px 40px 24px;',
    'text-align:center;',
    'border-bottom:1px solid #f0f0f0;',
  ].join(''),

  logoImg: [
    'height:28px;',
    'width:auto;',
    'display:inline-block;',
  ].join(''),

  /** Body area */
  body: 'padding:36px 40px 0;',

  heading: [
    'margin:0 0 16px;',
    'font-size:22px;',
    'font-weight:700;',
    'color:#111111;',
    'letter-spacing:-0.3px;',
    'line-height:1.3;',
  ].join(''),

  paragraph: [
    'margin:0 0 16px;',
    'font-size:15px;',
    'line-height:1.6;',
    'color:#444444;',
  ].join(''),

  /** CTA button */
  ctaWrap: 'padding:28px 40px 0;text-align:left;',

  ctaBtn: [
    'display:inline-block;',
    'padding:13px 28px;',
    'background-color:#000000;',
    'color:#ffffff !important;',
    'font-size:15px;',
    'font-weight:600;',
    'text-decoration:none;',
    'border-radius:8px;',
    'letter-spacing:0.1px;',
  ].join(''),

  /** Divider */
  divider: [
    'margin:32px 40px 0;',
    'border:none;',
    'border-top:1px solid #f0f0f0;',
  ].join(''),

  /** Footer */
  footer: [
    'padding:20px 40px 32px;',
    'font-size:12px;',
    'color:#aaaaaa;',
    'line-height:1.5;',
  ].join(''),
}

// ---------------------------------------------------------------------------
// Logo — inline SVG wordmark (monochrome, safe across email clients)
// Fallback text used if the hosted logo URL is not configured.
// ---------------------------------------------------------------------------

const LOGO_URL =
  process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/logo.svg`
    : null

function logoTag(): string {
  if (LOGO_URL) {
    return `<img src="${LOGO_URL}" alt="Clikaa" height="28" style="${S.logoImg}" />`
  }
  return `<span style="font-size:20px;font-weight:700;color:#111111;letter-spacing:-0.5px;">Clikaa</span>`
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function renderClikaaEmail(data: ClikaaEmailData): string {
  const { preheader, heading, body, cta, footerNote } = data

  const paragraphs = (Array.isArray(body) ? body : [body])
    .map((p) => `<p style="${S.paragraph}">${p}</p>`)
    .join('')

  const ctaBlock = cta
    ? `<div style="${S.ctaWrap}">
        <a href="${cta.url}" target="_blank" style="${S.ctaBtn}">${cta.label}</a>
       </div>`
    : ''

  const preheaderSpan = preheader
    ? `<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;</span>`
    : ''

  const footer = footerNote
    ? `<hr style="${S.divider}" />
       <div style="${S.footer}">${footerNote}</div>`
    : `<div style="padding-bottom:32px;"></div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${heading}</title>
</head>
<body style="${S.page}">
  ${preheaderSpan}

  <!-- Card -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:0 16px;">
        <div style="${S.card}">

          <!-- Logo header -->
          <div style="${S.header}">
            ${logoTag()}
          </div>

          <!-- Body -->
          <div style="${S.body}">
            <h1 style="${S.heading}">${heading}</h1>
            ${paragraphs}
          </div>

          <!-- CTA -->
          ${ctaBlock}

          <!-- Footer -->
          ${footer}

        </div>
      </td>
    </tr>
  </table>
</body>
</html>`
}
